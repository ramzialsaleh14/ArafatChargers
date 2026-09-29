# Arafat Chargers (Expo React Native)

Companion app to **Arafat HR** built on the exact same Expo / React Native setup,
utils and login flow. After logging in, the user scans a charger barcode and the
app shows the charger information returned by the server.

## Features

- **Login screen** – same functionality as Arafat HR (stored-credential auto login,
  server login, error handling) with a new teal/amber design.
- **Main screen – Scan Charger**
  - Barcode text input with a camera button beside it.
  - Camera barcode scanner (`expo-camera`) that fills the text input and
    **automatically** triggers the check.
  - A **Check** button that appears once the text input has a value, and is always
    available so the user can retry.
- **Result handling** (based on the JSON returned by `getChargerInfo`)
  - `ERROR = true` → shows **No Data Found**.
  - `PAID = true` → shows a full **green screen**.
  - otherwise → renders `QRCODE` as a **Code 128** barcode, the `QRCODE` text
    underneath, plus `KWH` and `TOTAL_AMOUNT`, with a **Print** button.
- **Arabic / English** support with a language toggle (persisted between sessions).

## Server call

`app/utils/ServerOperations.js`

```js
getChargerInfo(user, barcode) // -> { QRCODE, KWH, TOTAL_AMOUNT, ERROR, PAID }
```

Request parameters sent to the gateway:

```
action=GET.CHARGER.INFO&USER=<user>&BARCODE=<barcode>&currentuser=<user>
```

On any network/parse failure the function returns `{ ERROR: true }` so the screen
always renders the "No Data Found" state.

## Configuration

All endpoints live in `app/utils/Constants.js`:

- `serverBaseUrl` – backend host.
- `serviceItemId` – gateway `item_id` (`HRSERVICE` by default, same as Arafat HR).
- `appVersion` – must match the version registered on the web service.

Change these two values if the chargers service is exposed under a different
`item_id` / host.

## Getting started

1. Install dependencies:

   ```bash
   npm install
   ```

2. Start the dev server:

   ```bash
   npm start
   ```

3. Run on a device/emulator:

   ```bash
   npm run android
   npm run ios
   npm run web
   ```

> The camera scanner needs permission on a real device. On web it requires a
> secure context (`https://` or `localhost`).

## Project structure

```
App.js                          # navigation + language bootstrap
app/
  components/
    AppButton.js                # reusable button
    BarcodeScannerModal.js      # full-screen camera scanner
    ProgressDialog.js           # loading overlay
  languages/
    en.js / ar.js               # translations
    langStrings.js              # i18n instance
  screens/
    LoginScreen.js
    MainScreen.js
  utils/
    Commons.js                  # storage / alert / language helpers
    Constants.js                # endpoints, colors, action names
    ServerOperations.js         # all server calls
```

## Notes

This project mirrors the Arafat HR setup; only the charger-specific screens,
translations and the `getChargerInfo` service call were added.
