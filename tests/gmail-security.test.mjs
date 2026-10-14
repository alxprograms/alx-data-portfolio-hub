import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { test } from "node:test";
import { encryptToken, decryptToken, encryptionKey, equalSecret, validEmail, testMessage } from "../src/lib/gmail/security.ts";

test("refresh tokens round-trip with randomized authenticated encryption", () => {
  const key = encryptionKey(randomBytes(32).toString("base64"));
  const token = "private-test-refresh-token";
  const first = encryptToken(token, key);
  assert.equal(decryptToken(first, key), token);
  assert.notEqual(first, encryptToken(token, key));
  assert.ok(!first.includes(token));
  assert.throws(() => decryptToken(first, randomBytes(32)));
  const parts = first.split(":");
  const bytes = Buffer.from(parts[3], "base64");
  bytes[0] ^= 1;
  parts[3] = bytes.toString("base64");
  assert.throws(() => decryptToken(parts.join(":"), key));
});

test("invalid encryption keys and OAuth state are rejected", () => {
  for (const key of [undefined, "", "password", randomBytes(16).toString("base64")]) {
    assert.throws(() => encryptionKey(key));
  }
  assert.equal(equalSecret("correct", "correct"), true);
  assert.equal(equalSecret("correct", "wrong"), false);
  assert.equal(equalSecret("correct", "correcu"), false);
});

test("recipient validation allows external mail but rejects header injection", () => {
  for (const email of ["staff@alxafrica.com", "someone+test@gmail.com", "a@example.co.ke"]) assert.ok(validEmail(email));
  for (const email of [null, "", "a@", "a@localhost", "a b@gmail.com", "a@gmail.com\r\nBcc: other@example.com", "<a@gmail.com>"]) assert.ok(!validEmail(email));
  assert.throws(() => testMessage("staff@alxafrica.com", "a@gmail.com\r\nBcc: other@example.com"));
});

test("test email has fixed content and Gmail's base64url MIME format", () => {
  const raw = testMessage("program@alxafrica.com", "someone@gmail.com");
  assert.match(raw, /^[A-Za-z0-9_-]+$/);
  const message = Buffer.from(raw, "base64url").toString("utf8");
  assert.match(message, /From: program@alxafrica.com\r\nTo: someone@gmail.com\r\n/);
  assert.match(message, /Subject: \[Portfolio Hub\] Gmail connection test/);
  const body = Buffer.from(message.split("\r\n\r\n")[1], "base64").toString("utf8");
  assert.ok(body.includes("Recipient: someone@gmail.com"));
});
