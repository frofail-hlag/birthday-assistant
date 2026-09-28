const notificationStatus = document.getElementById("notificationStatus");
const notificationMessage = document.getElementById("notificationMessage");
const enableButton = document.getElementById("enableNotifications");
const testButton = document.getElementById("testNotification");
const pushHint = document.getElementById("pushHint");
const installHint = document.getElementById("installHint");

function updateNotificationUI() {
  if (!("Notification" in window)) {
    notificationStatus.textContent = "Not supported";
    notificationStatus.className = "status-pill status-off";
    notificationMessage.textContent = "This browser does not support web notifications.";
    enableButton.disabled = true;
    testButton.disabled = true;
    return;
  }

  const permission = Notification.permission;

  if (permission === "granted") {
    notificationStatus.textContent = "Browser enabled";
    notificationStatus.className = "status-pill status-on";
    notificationMessage.textContent =
      "Browser notifications are enabled. OneSignal push setup is being checked.";
    enableButton.disabled = true;
    testButton.disabled = false;
  } else if (permission === "denied") {
    notificationStatus.textContent = "Blocked";
    notificationStatus.className = "status-pill status-off";
    notificationMessage.textContent =
      "Notifications are blocked. Enable them in your browser or device settings.";
    enableButton.disabled = true;
    testButton.disabled = true;
  } else {
    notificationStatus.textContent = "Off";
    notificationStatus.className = "status-pill status-off";
    notificationMessage.textContent =
      "Enable push notifications so Birthday Assistant can alert you about upcoming birthdays.";
    enableButton.disabled = false;
    testButton.disabled = true;
  }
}

async function enableOneSignalPush() {
  const OneSignal = window.birthdayAssistantOneSignal;

  if (!OneSignal) {
    pushHint.textContent =
      "OneSignal is still loading. Please wait a moment and try again.";
    return;
  }

  try {
    await OneSignal.Notifications.requestPermission();

    if (OneSignal.User?.PushSubscription) {
      await OneSignal.User.PushSubscription.optIn();
    }

    pushHint.textContent =
      "OneSignal push is enabled on this device. 🎉";
  } catch (error) {
    console.error("OneSignal permission error:", error);
    pushHint.textContent =
      "OneSignal could not enable push notifications. Check the browser/device permission.";
  }

  updateNotificationUI();
}

async function showLocalTestNotification(title = "🎂 Birthday Assistant") {
  if (!("Notification" in window) || Notification.permission !== "granted") {
    return;
  }

  const options = {
    body: "Your Birthday Assistant local notification is working!",
    icon: "./icons/icon-192.png",
    badge: "./icons/icon-192.png",
    tag: "birthday-assistant-local-test",
    data: { url: "./" }
  };

  try {
    if ("serviceWorker" in navigator) {
      const registration = await navigator.serviceWorker.ready;
      await registration.showNotification(title, options);
    } else {
      new Notification(title, options);
    }
  } catch (error) {
    console.error("Could not show local notification:", error);
  }
}

async function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) {
    console.warn("Service workers are not supported.");
    return;
  }

  try {
    const registration = await navigator.serviceWorker.register("./sw.js");
    console.log("PWA service worker registered:", registration.scope);
  } catch (error) {
    console.error("PWA service worker registration failed:", error);
  }
}

function setupInstallHint() {
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true;

  if (standalone) {
    installHint.textContent =
      "Birthday Assistant is installed as an app. 🎉";
  } else {
    installHint.textContent =
      "On iPhone/iPad, use Share → Add to Home Screen to install the app.";
  }
}

window.addEventListener("onesignal-ready", () => {
  pushHint.textContent =
    "OneSignal is connected. Tap Enable Push Notifications to subscribe this device.";
});

enableButton.addEventListener("click", enableOneSignalPush);

testButton.addEventListener("click", () => {
  showLocalTestNotification();
});

window.addEventListener("load", async () => {
  await registerServiceWorker();
  setupInstallHint();
  updateNotificationUI();
});
