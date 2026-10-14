# Gmail connection and test emails

Open `/staff/settings/email` after signing in. All verified ALX staff may view,
connect, reconnect, replace or disconnect the shared sender. The sender is stored
in the database, not in an environment variable. Connecting uses a separate
Google OAuth client and does not change Supabase staff login.

## Setup

1. Apply `20261014120000_gmail_sender_connection.sql` using the normal migration workflow (`npx supabase db push` after verifying the linked project).
2. Configure these server-only variables in `.env.local` and the host's environment:

   ```ini
   SUPABASE_SECRET_KEY=
   GOOGLE_GMAIL_CLIENT_ID=
   GOOGLE_GMAIL_CLIENT_SECRET=
   GMAIL_TOKEN_ENCRYPTION_KEY=
   ```

   Use the **Gmail Sender** OAuth client, not the Supabase Staff Login client.
   `SUPABASE_SECRET_KEY` is the Supabase secret API key. It bypasses RLS and must
   never reach the browser. Generate a 32-byte base64 encryption key with
   `openssl rand -base64 32` and put the output directly in the ignored environment
   file or hosting secret setting. Back up that key securely. Changing or losing
   it requires reconnecting the mailbox; existing ciphertext cannot be decrypted.
3. Enable Gmail API in the client's Google Cloud project. The consent configuration
   should include `https://www.googleapis.com/auth/gmail.send`, with Internal audience.
4. Register these redirect URIs on that client:

   ```text
   http://localhost:3000/api/google/gmail/callback
   https://alx-data-portfolio-hub.vercel.app/api/google/gmail/callback
   ```

   Each host used for connection needs its own registered callback. The app uses
   the current request origin, so moving to AWS requires registering its URL and
   transferring the server secrets, without changing the integration code.
5. Restart `npm run dev` or redeploy after changing environment values.
6. Sign in, open Email settings, connect the intended ALX mailbox, then send a test.

## Data storage

- `gmail_sender_connection` contains one active sender, a random connection version,
  AES-256-GCM encrypted refresh token, connection status, connecting staff identity,
  timestamps and the last test recipient/result/message ID/safe error.
- `gmail_sender_events` contains recent connection changes and test attempts,
  including actor, old/new sender, recipient, result and Gmail message ID. No tokens.
- Both tables have RLS enabled and no grants or policies for browser roles. Only
  the server's secret client accesses them. All server entry points check staff
  authentication first. Server-rendered UI receives only explicitly selected safe
  metadata; it never receives ciphertext.
- The OAuth client secret and encryption key stay in the host environment.
  Access tokens are obtained with the refresh token and remain in server memory.
- OAuth state, nonce, PKCE verifier, initiating user and expiry live in a short-lived
  HttpOnly, SameSite=Lax callback cookie. It expires after ten minutes and is consumed
  once. Gmail tokens are never stored in cookies, browser storage or logs.

## Behaviour

- Normal staff login asks for no Gmail permission. Connect Gmail asks for sending
  permission and offline access, verifies Google's ID token, and accepts only a
  verified `alxafrica.com` mailbox. No Gmail inbox-reading scope is requested.
- Changing the sender atomically replaces the credential and writes history. A stale
  callback cannot overwrite a newer connection. Disconnect removes the saved token
  locally; Google account permissions may still list the app until revoked there.
- Test recipient defaults to the verified staff session email. Another-address mode
  allows an external recipient. Both are server validated and messages have fixed
  subject/content. Tests are limited to one per shared mailbox every 30 seconds.
- A successful send means Gmail accepted the message, not that delivery to the inbox
  was independently confirmed. Staff should check the recipient's inbox/spam folder.
- Revoked authorization marks the connection as needing reconnection. A transport
  failure after sending starts is shown as confirmation unavailable; it is never
  automatically retried. An interrupted server invocation may leave a pending test;
  staff should check the inbox before sending another test.
- No learner review or feedback behaviour is implemented by this integration.

## Verification

Run `npm run lint`, `npx tsc --noEmit`, and
`npm run test:gmail` (Node.js 22.6 or newer).
Before applying the migration to production, verify on a development database that
anonymous and authenticated clients cannot read either table or invoke its RPCs.
Use a signed-in staff session to check OAuth cancellation, connection, replacement,
disconnect, both recipient modes and reconnecting after revoking Google's grant.
Tests do not send real emails automatically.
