# Discord Integration Guide

This document explains how to configure Discord integration for TutorsLink
without committing any secrets to the repository.

---

## Overview

TutorsLink uses Discord for:
1. **Webhook notifications** — new tutor applications, demo bookings, and
   system alerts posted to a Discord channel.
2. **syncDiscordAdsWebhook** — a stub HTTP Cloud Function endpoint to receive
   incoming events/commands from a Discord bot or integration.

Discord **authentication** (login with Discord) is listed as a future feature.
It requires a custom token exchange flow via a Cloud Function. See the section
below for the planned approach.

---

## 1. Setting Up Webhook Notifications

### Step 1 — Create a Discord Webhook

1. In your Discord server, go to **Server Settings → Integrations → Webhooks**.
2. Click **New Webhook**, name it (e.g. "TutorsLink Bot"), choose a channel,
   and copy the webhook URL.

### Step 2 — Store the Webhook URL Securely

**Never commit the webhook URL to the repository.**

Use Firebase Functions config:

```bash
firebase functions:config:set discord.webhook_url="https://discord.com/api/webhooks/YOUR_ID/YOUR_TOKEN"
```

To verify it was set:

```bash
firebase functions:config:get discord
```

### Step 3 — Deploy Cloud Functions

```bash
cd functions
npm install
firebase deploy --only functions
```

---

## 2. Discord Bot Token

If you are running a Discord bot (e.g. for ad syndication or admin commands):

```bash
firebase functions:config:set discord.bot_token="Bot YOUR_BOT_TOKEN"
```

Access it in `functions/index.js`:

```js
const botToken = functions.config().discord.bot_token;
```

**Rotating the bot token:**
1. Go to [Discord Developer Portal](https://discord.com/developers/applications).
2. Select your application → Bot → **Reset Token**.
3. Copy the new token and update Firebase config:
   ```bash
   firebase functions:config:set discord.bot_token="Bot NEW_TOKEN"
   firebase deploy --only functions
   ```

---

## 3. Discord Login (Planned)

Firebase Authentication does not natively support Discord as a provider.
The planned implementation uses a **custom token flow**:

1. User clicks "Continue with Discord" on the TutorsLink sign-in page.
2. The frontend redirects to Discord OAuth2 with your client ID:
   ```
   https://discord.com/api/oauth2/authorize
     ?client_id=YOUR_CLIENT_ID
     &redirect_uri=https://YOUR_FUNCTIONS_URL/discordAuthCallback
     &response_type=code
     &scope=identify+email
   ```
3. Discord redirects back to a Cloud Function (`discordAuthCallback`) with a
   temporary `code`.
4. The Cloud Function exchanges the `code` for an access token using your
   Discord client secret (stored in Firebase config):
   ```bash
   firebase functions:config:set discord.client_id="YOUR_CLIENT_ID"
   firebase functions:config:set discord.client_secret="YOUR_CLIENT_SECRET"
   ```
5. The function fetches the user profile from Discord, creates or updates a
   Firebase Auth user, mints a **Firebase custom token**, and returns it.
6. The frontend calls `signInWithCustomToken(auth, customToken)`.

This approach keeps the Discord client secret server-side only, never exposed
to the browser.

**Status:** Button is visible in the auth modal with "Coming Soon" state.
Implement `discordAuthCallback` in `functions/index.js` when ready.

---

## 4. Environment Variables Reference

| Firebase config key          | Description                                  |
|-----------------------------|----------------------------------------------|
| `discord.webhook_url`       | Discord channel webhook URL for notifications|
| `discord.bot_token`         | Discord bot token (`Bot TOKEN`)              |
| `discord.client_id`         | Discord OAuth2 application client ID         |
| `discord.client_secret`     | Discord OAuth2 application client secret     |

All values are loaded at runtime via `functions.config().discord.*`.
None should appear in source code or `.env` files committed to the repo.

---

## 5. Local Development with Emulator

```bash
# Set config for local emulator
firebase functions:config:get > .runtimeconfig.json

# Start emulator (reads .runtimeconfig.json automatically)
firebase emulators:start --only functions
```

Add `.runtimeconfig.json` to `.gitignore`:

```
.runtimeconfig.json
```

---

## 6. Security Notes

- **Rotate tokens immediately** if they are accidentally exposed (committed,
  logged, or pasted in a public channel).
- Use **Discord's IP allowlisting** for the webhook endpoint if available.
- Validate the `X-Signature-Ed25519` and `X-Signature-Timestamp` headers on
  the `syncDiscordAdsWebhook` endpoint before processing any payload.
  See the [Discord interaction security docs](https://discord.com/developers/docs/interactions/receiving-and-responding#security-and-authorization).
