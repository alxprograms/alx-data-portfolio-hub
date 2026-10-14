import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";
import ts from "typescript";
import { encryptToken } from "../src/lib/gmail/security.ts";

// Exercise actual route/action code with isolated Google, session and database adapters.
// No Google requests, real credentials, database changes or emails are involved.
const require = createRequire(import.meta.url);
function load(path, mocks) {
  const code = ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  const loaded = { exports: {} };
  new Function("require", "module", "exports", code)((name) => name in mocks ? mocks[name] : require(name), loaded, loaded.exports);
  return loaded.exports;
}

const key = randomBytes(32);
const staff = { id: "staff-user", email: "staff@alxafrica.com" };
const flow = { state: "safe-state", nonce: "safe-nonce", verifier: "pkce-verifier", userId: staff.id, version: "version-1", redirectUri: "http://localhost:3000/api/google/gmail/callback", expires: Date.now() + 600_000 };
const scope = "https://www.googleapis.com/auth/gmail.send";
const constants = { EMAIL_SETTINGS: "/staff/settings/email", GMAIL_COOKIE: "gmail-connect", GMAIL_CALLBACK: "/api/google/gmail/callback", GMAIL_SCOPE: scope };

function callbackFixture(overrides = {}) {
  const calls = [];
  const cookie = { get: () => ({ value: JSON.stringify(overrides.flow ?? flow) }), set: (...args) => calls.push(["cookie", ...args]) };
  const oauth = {
    getToken: async (input) => { calls.push(["exchange", input]); return { tokens: { refresh_token: "secret-refresh-token", id_token: "id-token", scope, ...overrides.tokens } }; },
    verifyIdToken: async () => ({ getPayload: () => ({ email: "program@alxafrica.com", email_verified: true, nonce: flow.nonce, ...overrides.identity }) }),
  };
  const route = load("../src/app/api/google/gmail/callback/route.ts", {
    "next/server": { NextResponse: { redirect: (url) => ({ url: url.toString(), headers: new Headers() }) } },
    "next/headers": { cookies: async () => cookie }, "next/cache": { revalidatePath() {} },
    "@/lib/supabase/server": { createClient: async () => ({ auth: { getUser: async () => ({ data: { user: overrides.user === undefined ? staff : overrides.user } }) } }) },
    "@/lib/auth/staff": { isStaffUser: (user) => user?.email?.endsWith("@alxafrica.com") },
    "@/lib/supabase/admin": { createAdminClient: () => ({ rpc: async (name, args) => { calls.push([name, args]); return { error: overrides.databaseError ?? null }; } }) },
    "@/lib/gmail/security": load("../src/lib/gmail/security.ts", {}),
    "@/lib/gmail/server": { ...constants, gmailConfig: () => ({ key, clientId: "gmail-client" }), oauthClient: () => oauth },
  });
  return { calls, run: (params = "code=auth-code&state=safe-state") => route.GET({ url: `http://localhost:3000/api/google/gmail/callback?${params}`, nextUrl: new URL(`http://localhost:3000/api/google/gmail/callback?${params}`) }) };
}

test("OAuth callback rejects wrong state, expired flow and wrong staff session before exchanging code", async () => {
  for (const options of [{ flow: { ...flow, state: "different" } }, { flow: { ...flow, expires: 0 } }, { flow: { ...flow, userId: "someone-else" } }, { user: null }]) {
    const fixture = callbackFixture(options);
    assert.match((await fixture.run()).url, /result=expired$/);
    assert.equal(fixture.calls.filter(([name]) => name === "exchange").length, 0);
    assert.equal(fixture.calls.filter(([name]) => name === "gmail_change_sender").length, 0);
  }
});

test("OAuth cancellation preserves the sender, identity and scope checks reject unsuitable accounts", async () => {
  const cancelled = callbackFixture();
  assert.match((await cancelled.run("error=access_denied&state=safe-state")).url, /result=cancelled$/);
  assert.equal(cancelled.calls.filter(([name]) => name === "exchange").length, 0);
  for (const options of [
    { identity: { nonce: "wrong" } }, { identity: { email_verified: false } },
    { identity: { email: "personal@gmail.com" } },
    { tokens: { scope: "openid email" } }, { tokens: { refresh_token: undefined } },
    { flow: { ...flow, expectedSender: "different@alxafrica.com" } },
  ]) {
    const fixture = callbackFixture(options);
    assert.ok(!(await fixture.run()).url.endsWith("result=connected"));
    assert.equal(fixture.calls.filter(([name]) => name === "gmail_change_sender").length, 0);
  }
});

test("successful callback exchanges with PKCE, encrypts token and records signed-in staff actor", async () => {
  const fixture = callbackFixture();
  const response = await fixture.run();
  assert.match(response.url, /result=connected$/);
  const exchange = fixture.calls.find(([name]) => name === "exchange")[1];
  assert.equal(exchange.codeVerifier, flow.verifier);
  const saved = fixture.calls.find(([name]) => name === "gmail_change_sender")[1];
  assert.equal(saved.p_actor, staff.id);
  assert.equal(saved.p_email, "program@alxafrica.com");
  assert.ok(saved.p_token.startsWith("v1:"));
  assert.ok(!saved.p_token.includes("secret-refresh-token"));
  assert.ok(!JSON.stringify(response).includes("secret-refresh-token"));
  assert.equal(response.headers.get("Referrer-Policy"), "no-referrer");
});

function actionFixture({ denied = false, tokenError = null } = {}) {
  const calls = [];
  const row = { version: "version-1", status: "connected", sender_email: "program@alxafrica.com", encrypted_refresh_token: encryptToken("refresh", key) };
  const query = { select: () => query, eq: () => query, single: async () => ({ data: row, error: null }) };
  const db = { from: () => query, rpc: async (name, args) => { calls.push([name, args]); return { data: "test-event", error: null }; } };
  const actions = load("../src/app/actions/gmail.ts", {
    "next/headers": {}, "next/navigation": {}, "next/cache": { revalidatePath() {} },
    "@/lib/auth/staff": { requireStaff: async () => { if (denied) throw new Error("Unauthenticated"); return { user: staff }; } },
    "@/lib/supabase/admin": { createAdminClient: () => { calls.push(["admin"]); return db; } },
    "@/lib/gmail/security": load("../src/lib/gmail/security.ts", {}),
    "@/lib/gmail/server": { ...constants, gmailConfig: () => ({ key }), googleError: () => ({ message: "Reconnect Gmail.", reconnect: true }), oauthClient: () => ({ setCredentials() {}, getAccessToken: async () => { if (tokenError) throw tokenError; return { token: "temporary-token" }; } }) },
  });
  return { calls, module: actions };
}

test("every Gmail mutation requires a staff session", async () => {
  const fixture = actionFixture({ denied: true });
  await assert.rejects(fixture.module.sendGmailTestAction({ mode: "me", version: "version-1" }), /Unauthenticated/);
  await assert.rejects(fixture.module.disconnectGmailAction("version-1"), /Unauthenticated/);
  await assert.rejects(fixture.module.connectGmailAction(new FormData()), /Unauthenticated/);
  assert.equal(fixture.calls.length, 0);
});

test("Send to me uses session email, external mode uses validated input, and timeouts never retry", async () => {
  const originalFetch = globalThis.fetch;
  try {
    for (const mode of ["me", "other"]) {
      const fixture = actionFixture();
      let requests = 0;
      globalThis.fetch = async (_url, options) => {
        requests++;
        const mime = Buffer.from(JSON.parse(options.body).raw, "base64url").toString();
        assert.ok(mime.includes(`To: ${mode === "me" ? staff.email : "external@gmail.com"}\r\n`));
        return Response.json({ id: "gmail-id" });
      };
      const result = await fixture.module.sendGmailTestAction({ mode, recipient: "external@gmail.com", version: "version-1" });
      assert.equal(result.ok, true);
      assert.equal(result.messageId, "gmail-id");
      assert.equal(requests, 1);
      assert.equal(fixture.calls.find(([name]) => name === "gmail_begin_test")[1].p_recipient, mode === "me" ? staff.email : "external@gmail.com");
    }
    const fixture = actionFixture();
    let requests = 0;
    globalThis.fetch = async () => { requests++; throw new Error("Network lost"); };
    const result = await fixture.module.sendGmailTestAction({ mode: "me", version: "version-1" });
    assert.equal(result.ok, false);
    assert.equal(requests, 1);
    assert.equal(fixture.calls.find(([name]) => name === "gmail_finish_test")[1].p_result, "unknown");
  } finally { globalThis.fetch = originalFetch; }
});

test("invalid recipients do not access credentials and revoked grants require reconnection", async () => {
  const invalid = actionFixture();
  assert.equal((await invalid.module.sendGmailTestAction({ mode: "other", recipient: "bad\r\nBcc: x@gmail.com", version: "version-1" })).ok, false);
  assert.equal(invalid.calls.length, 0);
  const revoked = actionFixture({ tokenError: new Error("invalid_grant") });
  assert.equal((await revoked.module.sendGmailTestAction({ mode: "me", version: "version-1" })).ok, false);
  const saved = revoked.calls.find(([name]) => name === "gmail_finish_test")[1];
  assert.equal(saved.p_result, "failed");
  assert.equal(saved.p_reconnect, true);
});
