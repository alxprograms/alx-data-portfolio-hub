import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";
import ts from "typescript";
import { encryptToken, reviewMessage } from "../src/lib/gmail/security.ts";

const require = createRequire(import.meta.url);
function load(path, mocks) {
  const compiled = ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const loaded = { exports: {} };
  new Function("require", "module", "exports", compiled)((name) => name in mocks ? mocks[name] : require(name), loaded, loaded.exports);
  return loaded.exports;
}
const staff = { id: "staff-id", email: "staff@alxafrica.com" };
const record = {
  review_id: "review-id", attempt_id: "attempt-id", connection_version: "sender-version",
  sender_email: "program@alxafrica.com", recipient_email: "learner@gmail.com",
  learner_name: "Learner", title: "Dashboard", body: "Good work. Add a README explaining your findings.",
};

function fixture({ denied = false, databaseError = null, result = { status: "sent", messageId: "gmail-id", error: null, reconnect: false } } = {}) {
  const calls = [];
  const query = { select: () => query, eq: () => query, single: async () => ({ data: { learner_email: record.recipient_email }, error: null }) };
  const db = {
    from: (table) => { calls.push(["from", table]); return query; },
    rpc: async (name, args) => { calls.push([name, args]); return { data: name === "showcase_save_review_draft" ? "draft-version" : record, error: databaseError }; },
  };
  const actions = load("../src/app/actions/reviews.ts", {
    "next/cache": { revalidatePath() {} },
    "@/lib/auth/staff": { requireStaff: async () => { if (denied) throw new Error("Unauthenticated"); return { user: staff }; } },
    "@/lib/supabase/admin": { createAdminClient: () => { calls.push(["admin"]); return db; } },
    "@/lib/gmail/server": { gmailConfig() {}, EMAIL_SETTINGS: "/staff/settings/email" },
    "@/lib/gmail/security": load("../src/lib/gmail/security.ts", {}),
    "@/lib/gmail/send": { sendGmailMessage: async (version, raw) => { calls.push(["send", version, raw]); return result; } },
  });
  return { actions, calls };
}

test("review saving, sending and retries require verified staff before accessing database", async () => {
  const { actions, calls } = fixture({ denied: true });
  await assert.rejects(actions.saveReviewDraftAction({ submissionId: "submission", body: "review", version: null }), /Unauthenticated/);
  await assert.rejects(actions.sendReviewAction({ submissionId: "submission", version: "draft-version" }), /Unauthenticated/);
  await assert.rejects(actions.retryReviewAction("review-id"), /Unauthenticated/);
  assert.equal(calls.length, 0);
});

test("draft validation rejects blank and oversized text; saving does not send or publish", async () => {
  const { actions, calls } = fixture();
  for (const body of [" ", "x".repeat(10001)]) {
    assert.equal((await actions.saveReviewDraftAction({ submissionId: "submission", body, version: null })).ok, false);
  }
  assert.equal(calls.length, 0);
  const response = await actions.saveReviewDraftAction({ submissionId: "submission", body: " Good work ", version: null });
  assert.equal(response.ok, true);
  assert.equal(response.version, "draft-version");
  const saved = calls.find(([name]) => name === "showcase_save_review_draft")[1];
  assert.equal(saved.p_body, "Good work");
  assert.equal(saved.p_actor, staff.id);
  assert.ok(!calls.some(([name]) => name === "send"));
});

test("review email uses database recipient/body, and retains immutable review before sending", async () => {
  const { actions, calls } = fixture();
  const response = await actions.sendReviewAction({ submissionId: "submission", version: "draft-version", recipient: "attacker@example.com", body: "forged", status: "approved" });
  assert.equal(response.ok, true);
  assert.equal(response.consumed, true);
  const send = calls.find(([name]) => name === "send");
  const mime = Buffer.from(send[2], "base64url").toString();
  assert.ok(mime.includes(`To: ${record.recipient_email}\r\n`));
  assert.ok(!mime.includes("attacker@example.com"));
  const body = Buffer.from(mime.split("\r\n\r\n")[1].replaceAll("\r\n", ""), "base64").toString();
  assert.ok(body.includes(record.body));
  assert.ok(!body.includes("forged"));
  assert.ok(calls.findIndex(([name]) => name === "showcase_begin_review_send") < calls.findIndex(([name]) => name === "send"));
  const finished = calls.find(([name]) => name === "showcase_finish_review_send")[1];
  assert.equal(finished.p_status, "sent");
  assert.equal(finished.p_message_id, "gmail-id");
  assert.ok(!calls.some(([name]) => name === "update"));
});

test("changed drafts and unavailable sender never send", async () => {
  for (const message of ["REVIEW_DRAFT_CHANGED", "REVIEW_SENDER_UNAVAILABLE", "REVIEW_CANNOT_RETRY"]) {
    const { actions, calls } = fixture({ databaseError: { message } });
    assert.equal((await actions.sendReviewAction({ submissionId: "submission", version: "old" })).ok, false);
    assert.ok(!calls.some(([name]) => name === "send"));
  }
});

test("failed and uncertain sends retain reviews with status; retries use exact saved review", async () => {
  for (const status of ["failed", "unknown"]) {
    const { actions, calls } = fixture({ result: { status, messageId: null, error: "Safe error", reconnect: true } });
    const response = await actions.sendReviewAction({ submissionId: "submission", version: "draft-version" });
    assert.equal(response.ok, false);
    assert.equal(response.consumed, true);
    assert.ok(response.message.includes("saved in history"));
    assert.equal(calls.find(([name]) => name === "showcase_finish_review_send")[1].p_status, status);
    assert.equal(calls.filter(([name]) => name === "send").length, 1);
  }
  const { actions, calls } = fixture();
  assert.equal((await actions.retryReviewAction(record.review_id)).ok, true);
  assert.equal(calls.find(([name]) => name === "showcase_retry_review_send")[1].p_actor, staff.id);
});

test("review MIME preserves Unicode and line breaks, folds headers and prevents recipient injection", () => {
  const input = { sender: record.sender_email, recipient: record.recipient_email, title: "分析 📊".repeat(30), learnerName: "Learner", body: "Well done!\n\nNext steps: explain your findings.\n<script>plain text</script>" };
  const mime = Buffer.from(reviewMessage(input), "base64url").toString();
  const [headers, body] = mime.split("\r\n\r\n");
  const words = headers.match(/=\?UTF-8\?B\?[^?]+\?=/g);
  assert.ok(words.every((word) => word.length <= 75));
  const subject = words.map((word) => Buffer.from(word.slice(10, -2), "base64").toString()).join("");
  assert.equal(subject, `Your Portfolio Hub review: ${input.title}`);
  assert.ok(Buffer.from(body.replaceAll("\r\n", ""), "base64").toString().includes(input.body));
  assert.throws(() => reviewMessage({ ...input, recipient: "a@gmail.com\r\nBcc: b@gmail.com" }));
});

test("Gmail send helper sends once, marks lost/5xx confirmation unknown, and redacts provider errors", async () => {
  const key = randomBytes(32);
  const query = { select: () => query, eq: () => query, single: async () => ({ data: { version: "sender-version", status: "connected", encrypted_refresh_token: encryptToken("private-token", key) }, error: null }) };
  const { sendGmailMessage } = load("../src/lib/gmail/send.ts", {
    "server-only": {}, "@/lib/supabase/admin": { createAdminClient: () => ({ from: () => query }) },
    "@/lib/gmail/security": load("../src/lib/gmail/security.ts", {}),
    "@/lib/gmail/server": { gmailConfig: () => ({ key }), oauthClient: () => ({ setCredentials() {}, getAccessToken: async () => ({ token: "access-token" }) }), googleError: () => ({ message: "Safe Google error", reconnect: false }) },
  });
  const original = globalThis.fetch;
  try {
    for (const outcome of ["sent", "failed", "unknown", "server-error"]) {
      let requests = 0;
      globalThis.fetch = async () => {
        requests++;
        if (outcome === "unknown") throw new Error("private-token network failure");
        if (outcome === "failed") return new Response("private-token", { status: 403 });
        if (outcome === "server-error") return new Response("private-token", { status: 503 });
        return Response.json({ id: "gmail-id" });
      };
      const result = await sendGmailMessage("sender-version", "fixed-raw");
      assert.equal(result.status, outcome === "server-error" ? "unknown" : outcome);
      assert.equal(requests, 1);
      assert.ok(!JSON.stringify(result).includes("private-token"));
    }
  } finally { globalThis.fetch = original; }
});
