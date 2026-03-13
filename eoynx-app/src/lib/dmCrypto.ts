import { randomBytes, createCipheriv, createDecipheriv } from "crypto";

export const DM_CRYPTO_SPEC = "aes-gcm-v1";

export function generateDMRoomKey(): string {
  return randomBytes(32).toString("base64");
}

export function encryptDMContent(
  roomKeyBase64: string,
  content: string
): { encryptedContent: string; iv: string } {
  const key = Buffer.from(roomKeyBase64, "base64");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(content, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  const combined = Buffer.concat([encrypted, authTag]);
  return {
    encryptedContent: combined.toString("base64"),
    iv: iv.toString("base64"),
  };
}

export function decryptDMContent(
  roomKeyBase64: string,
  encryptedContentBase64: string,
  ivBase64: string
): string {
  try {
    const key = Buffer.from(roomKeyBase64, "base64");
    const iv = Buffer.from(ivBase64, "base64");
    const encryptedContent = Buffer.from(encryptedContentBase64, "base64");
    const authTag = encryptedContent.subarray(-16);
    const ciphertext = encryptedContent.subarray(0, -16);
    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return decrypted.toString("utf8");
  } catch {
    return "[복호화 실패]";
  }
}
