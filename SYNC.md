# Room sync setup (optional)

Room codes use **Firebase Realtime Database** (free Spark plan). GPS is never synced — only a small round JSON (~1–3 KB).

## 1. Create a Firebase project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a project → add a **Web** app
3. Create a **Realtime Database** (start in test mode for personal use, then lock rules down)

Suggested rules (anyone with the code can read/write that room; data expires via your own cleanup later):

```json
{
  "rules": {
    "rounds": {
      "$code": {
        ".read": true,
        ".write": true,
        ".validate": "newData.hasChildren(['gameType', 'players', 'scores'])"
      }
    }
  }
}
```

## 2. Paste config

Edit `firebase-config.js` with the web app config (`apiKey`, `databaseURL`, `projectId`, etc.).

## 3. Use it

In **Settings** → pick a game → **Create room** (share the 4-letter code) or **Join** with a code on another phone.
