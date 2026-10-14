import { createCipheriv, createDecipheriv, randomBytes, timingSafeEqual } from "node:crypto";

export function encryptionKey(value: string | undefined) {
  if (!value || !/^[A-Za-z0-9+/]{43}=$/.test(value)) throw new Error("Gmail encryption is not configured.");
  const key = Buffer.from(value, "base64");
  if (key.length !== 32) throw new Error("Gmail encryption is not configured.");
  return key;
}

export function encryptToken(token: string, key: Buffer) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(Buffer.from("portfolio-hub:gmail:v1"));
  const ciphertext = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64"), cipher.getAuthTag().toString("base64"), ciphertext.toString("base64")].join(":");
}

export function decryptToken(value: string, key: Buffer) {
  const [version, iv, tag, ciphertext, extra] = value.split(":");
  if (version !== "v1" || !iv || !tag || !ciphertext || extra) throw new Error("Invalid encrypted token.");
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "base64"));
  decipher.setAAD(Buffer.from("portfolio-hub:gmail:v1"));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(ciphertext, "base64")), decipher.final()]).toString("utf8");
}

export function validEmail(value: unknown): value is string {
  return typeof value === "string" && value.length <= 254 &&
    /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)+$/.test(value);
}

export function equalSecret(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function testMessage(sender: string, recipient: string) {
  if (!validEmail(sender) || !validEmail(recipient)) throw new Error("Invalid email address.");
  const body = Buffer.from(`This is a test email from the ALX Data Portfolio Hub.\n\nSender: ${sender}\nRecipient: ${recipient}\n\nYour Gmail sender connection is working.`, "utf8").toString("base64");
  return Buffer.from([
    `From: ${sender}`, `To: ${recipient}`, "Subject: [Portfolio Hub] Gmail connection test",
    "MIME-Version: 1.0", 'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: base64", "", body,
  ].join("\r\n")).toString("base64url");
}
