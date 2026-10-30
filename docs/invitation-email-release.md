# Invitation email and URL release runbook

Invitation records are created before email delivery. Mailtrap sandbox SMTP
is the default in every environment and captures messages in the Mailtrap inbox.
Set `INVITATION_EMAIL_PROVIDER=resend` to use Resend. If the selected provider is not
configured or rejects a request, the record remains available and the admin
receives a manual signup link. The API reports delivery accepted only after
the selected provider accepts the message.

## Root cause of the configuration warnings

The warnings come from the server-only invitation email module at
`src/modules/auth/invitation-email.ts`. It returns an `unconfigured` result
when the selected provider credentials or the app URL are unavailable:

- All environments by default: `MAILTRAP_USER` and `MAILTRAP_PASS`
- To use Resend: set `INVITATION_EMAIL_PROVIDER=resend`, `RESEND_API_KEY`, and `RESEND_FROM_EMAIL`
- All environments: `NEXT_PUBLIC_APP_URL`, unless a trusted Vercel Preview URL is available

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
INVITATION_EMAIL_PROVIDER=mailtrap
MAILTRAP_USER=<Mailtrap sandbox SMTP username>
MAILTRAP_PASS=<Mailtrap sandbox SMTP password>
INVITATION_TOKEN_ENCRYPTION_KEY=<base64url-encoded 32-byte server secret>
```

Mailtrap is selected by default; the provider setting is shown explicitly here.

### Preview

```text
NEXT_PUBLIC_APP_URL=https://<your-preview-domain>
INVITATION_EMAIL_PROVIDER=mailtrap
MAILTRAP_USER=<Mailtrap sandbox SMTP username>
MAILTRAP_PASS=<Mailtrap sandbox SMTP password>
INVITATION_TOKEN_ENCRYPTION_KEY=<base64url-encoded 32-byte server secret>
```

Mailtrap is selected by default. Add `INVITATION_EMAIL_PROVIDER=resend` to
enable Resend in Preview or Production. Set `INVITATION_EMAIL_PROVIDER=disabled`
to temporarily block invitation emails.

For a normal Vercel Preview deployment, the server prefers Vercel's system
`VERCEL_URL` and creates an HTTPS link for that exact `*.vercel.app` hostname.
`VERCEL_ENV` and `VERCEL_URL` are platform-provided system values; do not
invent or expose them as secrets. Keeping `NEXT_PUBLIC_APP_URL` configured for
Preview is still recommended as an explicit fallback and for local parity.

### Mailtrap credentials

```text
MAILTRAP_USER=<Mailtrap sandbox SMTP username>
MAILTRAP_PASS=<Mailtrap sandbox SMTP password>
```

Get the credentials from **Email Testing → Inboxes → your inbox → SMTP
Settings** in Mailtrap. Invitations are sent to `sandbox.smtp.mailtrap.io:2525`
and captured there instead of reaching the invited address. Configure them in
local `.env.local` and in Vercel Preview and Production. Resend is available
only when `INVITATION_EMAIL_PROVIDER=resend` is explicitly selected and its
API key and verified sender are configured.

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
