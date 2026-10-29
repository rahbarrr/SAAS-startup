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
    expect(
      decryptInvitationToken(encrypted?.replace(/.$/, "x") ?? "", {
        INVITATION_TOKEN_ENCRYPTION_KEY: key,
      })
    ).toBeNull();
  });
});
