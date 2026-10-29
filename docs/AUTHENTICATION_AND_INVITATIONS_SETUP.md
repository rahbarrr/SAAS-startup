# FieldTrack Authentication, Google OAuth, and Invitations

This document covers the external configuration required for Google sign-in and automatic invitation emails. Code changes alone do not activate the Google provider or email delivery.

## Google OAuth in Supabase

1. In Google Cloud Console, create or select an OAuth 2.0 **Web application** client.
2. Add the Supabase Auth callback shown on your Supabase project's **Authentication → Providers → Google** setup screen as an authorized redirect URI. For the current production project, the URI is expected to be:

   `https://lrolhonkrjhuwgnmcdsj.supabase.co/auth/v1/callback`

   If the Supabase project changes, use the callback displayed by that project's dashboard rather than reusing this value.

3. In Supabase, open **Authentication → Sign In / Providers → Google**, enable Google, and enter the Google OAuth client ID and client secret. Keep the client secret inside Supabase; do not add it to client-side code or commit it to Git.
4. In Supabase **Authentication → URL Configuration**, set the Site URL to `https://saas-startup1.vercel.app` and add these redirect URLs:
   - `https://saas-startup1.vercel.app/auth/callback`
   - `http://localhost:3000/auth/callback` for local development.
5. In the Google OAuth consent screen, configure the app name, support contact, required scopes (basic profile and email), and publish/verify the consent screen as appropriate for your audience.

The Google button sends users through Supabase OAuth. New users without an active workspace are sent to company setup; existing members return to the app; invited users retain their invitation token through the callback.

### Vercel callback troubleshooting

The production sign-in URL and the OAuth callback must stay on the public Production deployment. Confirm that Production has `VERCEL_ENV=production` and `NEXT_PUBLIC_APP_URL=https://saas-startup1.vercel.app`, and that Supabase allows the exact production callback URL above. For Preview, set `NEXT_PUBLIC_APP_URL` to the same public Preview host users open, and add that host's `/auth/callback` URL to the isolated Preview Supabase project's redirect allowlist. The callback uses this explicit Preview URL so it does not switch hosts after Supabase sets a host-scoped session cookie; `VERCEL_URL` remains the fallback when no app URL is configured. If the Preview host is protected by Vercel Deployment Protection, its access cookie must remain valid on that same host. Use the public Production URL for real sign-in, or use a Preview deployment configured with its isolated Supabase project. Keep Preview protection enabled rather than exposing protected deployments to bypass the sign-in screen.

If verification fails, the app returns to the login page with a safe error message and preserves the intended next path so the user can retry without losing an invitation.

## Automatic invitation email delivery (Resend)

1. Create a Resend account and verify a sending domain you control. Do not use a sender address or domain that Resend has not verified.
2. Create an API key with permission to send email.
3. In Vercel, open the `saas-startup1` project and add these Production environment variables:
   - `NEXT_PUBLIC_APP_URL=https://saas-startup1.vercel.app`
   - `RESEND_API_KEY` = the Resend API key (server-only secret)
   - `RESEND_FROM_EMAIL` = a verified sender, for example `FieldTrack <invites@your-verified-domain.com>`
4. Redeploy after setting the variables. For local development, use `NEXT_PUBLIC_APP_URL=http://localhost:3000` and a Resend sender that is verified for your testing account.

When an admin invites a manager or field employee, FieldTrack creates a single-use invitation record and tries to send an email through Resend. The app marks email as accepted for delivery only when Resend returns a successful response. If Resend is unconfigured or rejects the request, the invitation remains available and the admin is shown a fallback signup link to copy. A provider success response is not a guarantee that the message reached the recipient's inbox.

## Company profile and database migration

New workspaces require the company name, industry, company size, and country; website and phone are optional. The creator becomes the initial workspace admin. Existing workspaces receive safe legacy defaults for the new company metadata columns; existing memberships and organization records are not recreated.

Migration `20261028000017_google_oauth_company_profile_and_email_invitations.sql` introduces the company fields and the secure company-profile RPC. It also revokes client execution of the old workspace-creation RPC so a client cannot bypass company-profile onboarding.

**The migration must be applied to the intended Supabase environment before the new workspace-creation flow will work there.** Do not apply it against Production from a local shell pointed at an unknown project. Use the repository's approved database release workflow, take a backup/PITR reference first, and follow the manual release approval gates.

## Invitation security

- Only an organization admin can issue invitations.
- The UI and API allow only the `manager` and `field_employee` invitation roles. A client cannot promote an invitee to admin.
- The database stores a one-way token hash, while the raw token is included only in the invitation link/email and the authenticated inviter's response for fallback sharing.
- Invitation acceptance checks the authenticated user's email against the invited email, expiry, and one-time-use state server-side.
- Invitees can sign up with Google or use the existing email/password flow. The invitation token is preserved through Google OAuth and email confirmation redirects.
