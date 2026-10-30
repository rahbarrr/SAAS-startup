import { describe, expect, it } from "vitest";
import {
  decryptInvitationToken,
  encryptInvitationToken,
} from "@/modules/auth/invitation-token-vault";

const key = "0123456789abcdef0123456789abcdef0123456789a";

describe("invitation token vault", () => {
  it("round-trips encrypted tokens without storing plaintext", () => {
    const encrypted = encryptInvitationToken("raw-invitation-token", {
      INVITATION_TOKEN_ENCRYPTION_KEY: key,
    });

    expect(encrypted).toBeTruthy();
    expect(encrypted).not.toContain("raw-invitation-token");
    expect(
      decryptInvitationToken(encrypted ?? "", {
        INVITATION_TOKEN_ENCRYPTION_KEY: key,
      })
    ).toBe("raw-invitation-token");
  });

  it("fails closed when the key is absent or ciphertext is tampered", () => {
    const encrypted = encryptInvitationToken("raw-invitation-token", {
      INVITATION_TOKEN_ENCRYPTION_KEY: key,
    });
    expect(encryptInvitationToken("raw-invitation-token", {})).toBeNull();
    const parts = (encrypted ?? "").split(".");
    const tag = parts[1] ?? "";
    const changedTag = `${tag.startsWith("A") ? "B" : "A"}${tag.slice(1)}`;
    parts[1] = changedTag;
    expect(
      decryptInvitationToken(parts.join("."), {
        INVITATION_TOKEN_ENCRYPTION_KEY: key,
      })
    ).toBeNull();
  });
});
