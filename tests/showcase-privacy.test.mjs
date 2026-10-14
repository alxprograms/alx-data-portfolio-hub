import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";
import ts from "typescript";

const require = createRequire(import.meta.url);
const row = {
  id: "submission", slug: "showcase", title: "Dashboard", learner_name: "Learner",
  project_title: "Project", tools: ["SQL"], summary: "Summary", github_url: "https://github.com/example/project",
  live_url: null, cover_image_path: "private/cover.webp", public_cover_image_path: "public/cover.webp",
  status: "approved", submitted_at: "2026-10-14T10:00:00Z",
  projects: { slug: "project", course: "DA", domain: "Health" },
};

function fixture({ denied = false, privateImage = false } = {}) {
  const calls = [];
  function client(kind) {
    const record = { ...row, ...(kind === "admin" ? { learner_email: "private@example.com" } : {}) };
    if (privateImage) record.public_cover_image_path = null;
    const result = { data: [record], error: null };
    const query = {
      select: (columns) => { calls.push([kind, "select", columns]); return query; },
      eq: (...args) => { calls.push([kind, "eq", ...args]); return query; },
      order: () => query, limit: () => query,
      maybeSingle: async () => ({ data: record, error: null }),
      then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
    };
    return {
      from: () => query,
      storage: { from: (bucket) => ({
        getPublicUrl: (path) => ({ data: { publicUrl: `https://example.com/${bucket}/${path}` } }),
        createSignedUrl: async (path) => { calls.push([kind, "signed-image", bucket, path]); return { data: { signedUrl: "https://example.com/signed-private-cover" } }; },
      }) },
    };
  }
  const compiled = ts.transpileModule(readFileSync(new URL("../src/lib/data/showcase.ts", import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const mocks = {
    "@/lib/auth/staff": { requireStaff: async () => { calls.push(["auth"]); if (denied) throw new Error("Unauthenticated"); return { supabase: client("session") }; } },
    "@/lib/supabase/server": { createClient: async () => client("session") },
    "@/lib/supabase/admin": { createAdminClient: () => { calls.push(["admin-client"]); return client("admin"); } },
  };
  const loaded = { exports: {} };
  new Function("require", "module", "exports", compiled)((name) => mocks[name] ?? require(name), loaded, loaded.exports);
  return { api: loaded.exports, calls };
}

test("public gallery, detail and related-project showcase use explicit safe columns and approved filtering", async () => {
  const { api, calls } = fixture();
  const entries = [
    ...(await api.getApprovedShowcases()), await api.getApprovedShowcaseBySlug("showcase"),
    ...(await api.getApprovedShowcasesForProject("project")),
  ];
  for (const entry of entries) {
    assert.equal(entry.learnerEmail, undefined);
    assert.ok(entry.coverImageUrl.includes("showcase-public/public/cover.webp"));
    assert.equal(entry.projectSlug, "project");
  }
  assert.equal(calls.filter(([, operation, field, value]) => operation === "eq" && field === "status" && value === "approved").length,3);
  for (const [, operation, columns] of calls) if (operation === "select") {
    assert.ok(!columns.includes("learner_email"));
    assert.ok(columns !== "*");
  }
  assert.ok(!calls.some(([name]) => name === "admin-client"));
});

test("staff contact reads use the secret client only after validating staff", async () => {
  const { api, calls } = fixture();
  const entries = await api.getStaffShowcaseSubmissions();
  assert.equal(entries[0].learnerEmail,"private@example.com");
  assert.ok(calls.findIndex(([name]) => name === "auth") < calls.findIndex(([name]) => name === "admin-client"));
  assert.ok(calls.some(([kind, operation, columns]) => kind === "admin" && operation === "select" && columns.includes("learner_email")));
});

test("unauthorized staff list and detail requests cannot access the secret client", async () => {
  const { api, calls } = fixture({ denied: true });
  await assert.rejects(api.getStaffShowcaseSubmissions(), /Unauthenticated/);
  await assert.rejects(api.getStaffShowcaseBySlug("showcase"), /Unauthenticated/);
  assert.ok(!calls.some(([name]) => name === "admin-client"));
});

test("staff can still view private submission cover images using their staff session", async () => {
  const { api, calls } = fixture({ privateImage: true });
  assert.equal((await api.getStaffShowcaseSubmissions())[0].coverImageUrl,"https://example.com/signed-private-cover");
  assert.ok(calls.some(([kind, operation]) => kind === "session" && operation === "signed-image"));
});
