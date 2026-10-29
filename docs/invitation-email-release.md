# Invitation email and URL release runbook

Invitation records are created before email delivery. If Resend is not
configured or rejects a request, the record remains available and the admin
receives a manual signup link. The API never reports an email as delivered
unless Resend accepts the request.

## Root cause of the configuration warnings

The three warnings come from the server-only invitation email module at
`src/modules/auth/invitation-email.ts`. It returns an `unconfigured` result
when any of these are unavailable:

- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`
- `NEXT_PUBLIC_APP_URL`, unless a trusted Vercel Preview URL is available

The invitation API passes that result to the team UI, which displays the
warning and preserves the copy-link fallback. Secret values and provider
errors are not returned to the browser. `INVITATION_TOKEN_ENCRYPTION_KEY` is
required for durable retry; without it, the initial fallback link still works
but automatic retry is unavailable.

## Vercel environment variables

Configure these independently in the `saas-startup1` Vercel project. Use the
appropriate Vercel Environment selector when saving each value.

### Production

```text
NEXT_PUBLIC_APP_URL=https://saas-startup1.vercel.app
RESEND_API_KEY=<the Resend API key, entered as a secret>
RESEND_FROM_EMAIL=FieldTrack <invites@your-verified-domain.example>
INVITATION_TOKEN_ENCRYPTION_KEY=<base64url-encoded 32-byte server secret>
```

Use the real verified sender address; the example domain above is a
placeholder and must not be copied literally.

### Preview

```text
NEXT_PUBLIC_APP_URL=https://<your-preview-domain>
RESEND_API_KEY=<the Resend API key, entered as a secret>
RESEND_FROM_EMAIL=FieldTrack <invites@your-verified-domain.example>
INVITATION_TOKEN_ENCRYPTION_KEY=<base64url-encoded 32-byte server secret>
```

For a normal Vercel Preview deployment, the server prefers Vercel's system
`VERCEL_URL` and creates an HTTPS link for that exact `*.vercel.app` hostname.
`VERCEL_ENV` and `VERCEL_URL` are platform-provided system values; do not
invent or expose them as secrets. Keeping `NEXT_PUBLIC_APP_URL` configured for
Preview is still recommended as an explicit fallback and for local parity.

Do not add `RESEND_API_KEY` to client-exposed variables, source code, or Git.
Keep `INVITATION_TOKEN_ENCRYPTION_KEY` server-only and use a different value
for Preview and Production.
Do not construct invitation links from `Host` or forwarded-host headers.

## Manual steps

1. In Resend, verify the sending domain and confirm that the exact
   `RESEND_FROM_EMAIL` address is allowed to send from it.
2. In Vercel project `saas-startup1`, add or update the three variables in
   both Preview and Production using the values for that environment. Never
   paste a secret into a ticket, chat, log, or screenshot.
3. Redeploy the affected Preview and Production deployments so the new
   environment values are loaded.
4. Send a test invitation from a non-customer workspace. Confirm that the
   email link uses the Preview deployment URL in Preview and the configured
   canonical URL in Production.
5. Confirm the recipient can accept only with the invited email address and
   that the invitation cannot be reused. If delivery is rejected, confirm the
   invitation remains present and the admin can copy the fallback link.
6. Use the invitation retry operation only after the retry cooldown shown by
   the API. It reuses the same invitation token and does not create a second
   invitation record.

No production database migration or deployment is performed by this change.
