# Birthday Assistant V1.5.1

V1.5.1 keeps the validated V1.2.8 OneSignal architecture and adds a persistent in-app birthday reminder layer.

## What changed

- Added **Birthday Reminders** section to the home screen.
- A birthday carried by the notification launch URL is stored locally.
- Reminders remain visible for **24 hours** from creation.
- Expired reminders are automatically removed on app startup and while the app is open.
- Duplicate reminders for the same person are suppressed while an active reminder exists.
- Notification launch parameters are removed from the address bar after being consumed.
- Existing OneSignal worker configuration is unchanged.
- PWA cache version is bumped to `birthday-assistant-v1-4`.

## Required Make change

The OneSignal module's URL should be changed from:

`https://frofail-hlag.github.io/birthday-assistant/`

to:

`https://frofail-hlag.github.io/birthday-assistant/?birthday={{3.`0`}}`

This carries the birthday person's name into the PWA when the notification is tapped. The app consumes it and stores the reminder locally.

## Test checklist

1. Deploy the V1.5.1 files to GitHub Pages.
2. Open the PWA and confirm existing OneSignal subscription is still enabled.
3. Send a Make birthday notification.
4. Confirm push arrives on iPad/phone.
5. Tap the notification.
6. Confirm Birthday Assistant opens and the reminder appears under **Birthday Reminders**.
7. Refresh/reopen the app and confirm the reminder remains.
8. Verify the reminder is not duplicated by refreshing.
9. To test expiry without waiting 24 hours, temporarily change `REMINDER_TTL_MS` in `app.js` to a short interval, deploy/test, then restore it to 24 hours.
10. Keep Gmail and Twilio enabled during the stabilization period.
