import "server-only";
import { createCipheriv, createDecipheriv } from "node:crypto";

const ALGORITHM = "aes-256-gcm";

function keyFromEnv(envSource: Record<string, string | undefined>): Buffer | null {
  const encoded = envSource.INVITATION_TOKEN_ENCRYPTION_KEY?.trim();
  if (!encoded) return null;
  try {
    const key = Buffer.from(encoded, "base64");
    return key.length === 32 ? key : null;
  } catch {
    return null;
  }
}

/** Stores a retryable invitation token as authenticated ciphertext, never plaintext. */
export function encryptInvitationToken(
  token: string,
  envSource: Record<string, string | undefined> = process.env
): string | null {
  const key = keyFromEnv(envSource);
  if (!key) return null;
  const iv = Buffer.from(crypto.randomUUID().replaceAll("-", "").slice(0, 24), "hex");
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, ciphertext].map((part) => part.toString("base64url")).join(".");
}

export function decryptInvitationToken(
  encrypted: string,
  envSource: Record<string, string | undefined> = process.env
): string | null {
  const key = keyFromEnv(envSource);
  if (!key) return null;
  const parts = encrypted.split(".");
  if (parts.length !== 3) return null;
  try {
    const [ivEncoded, tagEncoded, ciphertextEncoded] = parts;
    const decipher = createDecipheriv(
      ALGORITHM,
      key,
      Buffer.from(ivEncoded ?? "", "base64url")
    );
    decipher.setAuthTag(Buffer.from(tagEncoded ?? "", "base64url"));
    return Buffer.concat([
      decipher.update(Buffer.from(ciphertextEncoded ?? "", "base64url")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    return null;
  }
}
