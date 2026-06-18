# Google Sign-In Setup (one-time per environment)

This app's Android TV build uses Google Sign-In via a native bridge.
Code is wired up — but Cloud Console requires manual setup per environment.

## 1. Create OAuth clients in Google Cloud Console

Open https://console.cloud.google.com/apis/credentials in the project you want
to host the OAuth identity for StarSol.

### Web OAuth Client (used by backend to verify ID tokens)
- + CREATE CREDENTIALS → OAuth client ID
- Application type: Web application
- Name: `StarSol Web`
- No redirect URIs needed (we use id_token verification, not server-side OAuth)
- Save. Copy the Client ID — it looks like `12345-abc.apps.googleusercontent.com`.

### Android OAuth Client (used by GMS to authorize sign-in)
- + CREATE CREDENTIALS → OAuth client ID
- Application type: Android
- Name: `StarSol Android TV`
- Package name: `app.starsol.tv`
- SHA-1 certificate fingerprint: get with `keytool -list -v -keystore <your-jks> -alias <your-alias>`
- Save.

For Play-installed users (after first Play upload), ALSO get the
Play App Signing SHA-1 from Play Console → Setup → App signing, and add it as
a SECOND fingerprint on the same Android OAuth client.

## 2. Publish the OAuth consent screen

In Cloud Console, go to APIs & Services → OAuth consent screen (new UI:
"Google Auth Platform" → Audience).
- Click "PUBLISH APP"
- Confirm. No verification review needed for `email` + `profile` scopes only.
- Without this, only emails listed under "Test users" can sign in.

## 3. Add the Web Client ID to your local build

Edit `android-tv/local.properties`:
```
googleClientId=<paste your Web Client ID here>
```

## 4. Backend env var

Set `GOOGLE_CLIENT_ID` env var on your backend (where `/api/auth/google`
runs). It must match the Web Client ID above — the backend verifies the
id_token's `aud` matches this.

## 5. Verify

Sideload a debug build and try sign-in. If you see "Google Sign-In
misconfigured" toast, that's `DEVELOPER_ERROR(10)` — the SHA-1 in the
Android OAuth client doesn't match the keystore that signed the APK.

Reference: FlightPort's working implementation at `~/Documents/flight-cast`,
commits `6be3630` (gate behavior) and the GoogleSignInBridge.kt file.

## Architecture notes

- Bridge class: `android-tv/app/src/main/java/app/starsol/tv/GoogleSignInBridge.kt`
- JS interface name: `window.StarSolAuth`
- Result callback: `window.starsolGoogleSignInResult(jsonStr)`
- Backend endpoint: `POST /api/auth/google` (already implemented in `backend/backend/routes.js`)
- The bridge self-disables when `GOOGLE_CLIENT_ID` is empty in BuildConfig — QR pairing still works
