# RaveCall mobile app

The RaveCall web app (`../public/index.html`) rebuilt as a native iOS/Android app with Expo.
Same three tabs: **Listen**, **Voices**, **Safety**.

## Settings
Everything you might change is in `src/config.ts`:
- `EVENTS`: the valid event codes. Only exact codes on this list can join.
- `TOKEN_SERVER_ID`: the LiveKit development token server (development only).

Room names match `server.js` (`event-CODE`, `voice-<code>`), and the booth still publishes
as `soundboard`, so the app works with `booth.html` and the web app on the same LiveKit project.

## First-time setup
```
cd mobile
npm install
npx eas-cli@latest init
```
`eas init` links this folder to the **RaveCall** project in the Expo team. Pick it from the list.

## Build and run (Android)
```
npx eas-cli@latest build --profile development --platform android
npx expo start --dev-client
```
Install the APK from the link EAS gives you, then open RaveCall (not Expo Go).
iPhone builds need an Apple Developer account: `npx eas-cli@latest build --profile development --platform ios`.

## Differences from the web version
- No audio limiter or frequency bars (those rely on browser-only Web Audio).
  The volume cap still applies.
- QR scanning uses the phone camera, so it works on iPhone too.
- Event codes are checked in the app, not on a server.
