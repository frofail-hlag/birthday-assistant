const enablePushBtn = document.getElementById("enablePushBtn");
const testLocalBtn = document.getElementById("testLocalBtn");
const pushStatus = document.getElementById("pushStatus");
const installHint = document.getElementById("installHint");

function setPushStatus(message, enabled = false) {
  pushStatus.textContent = message;
  pushStatus.classList.toggle("success", enabled);
}

function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches ||
         window.navigator.standalone === true;
}

function updateInstallHint() {
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

  if (isIOS && !isStandalone()) {
    installHint.textContent =
      "📱 On iPhone/iPad, add Birthday Assistant to the Home Screen before enabling remote push notifications.";
  } else {
    installHint.textContent = "";
  }
}

function getOneSignal() {
  return window.birthdayAssistantOneSignal || null;
}

async function getPushSubscriptionState() {
  const OneSignal = getOneSignal();

  if (!OneSignal) {
    return { ready: false, optedIn: false, id: null };
  }

  try {
    const subscription = OneSignal.User?.PushSubscription;

    if (!subscription) {
      return { ready: true, optedIn: false, id: null };
    }

    // v16 exposes these values directly.
    const optedIn = Boolean(subscription.optedIn);
    const id = subscription.id || null;

    return {
      ready: true,
      optedIn,
      id
    };
  } catch (error) {
    console.error("OneSignal subscription check failed:", error);
    return { ready: true, optedIn: false, id: null };
  }
}

async function refreshPushStatus() {
  const OneSignal = getOneSignal();

  if (!OneSignal) {
    setPushStatus("⚠️ OneSignal could not be initialized. Please refresh the app.");
    enablePushBtn.disabled = false;
    return;
  }

  const state = await getPushSubscriptionState();

  if (state.optedIn && state.id) {
    enablePushBtn.textContent = "✅ Push Notifications Enabled";
    enablePushBtn.disabled = true;
    setPushStatus("Your device is subscribed to OneSignal push notifications.", true);
    return;
  }

  enablePushBtn.textContent = "🔔 Enable Push Notifications";
  enablePushBtn.disabled = false;

  if (Notification.permission === "denied") {
    setPushStatus("⚠️ Notifications are blocked. Enable them in iPhone Settings for Birthday Assistant.");
  } else if (state.optedIn) {
    setPushStatus("⏳ Permission is allowed. OneSignal is still creating the device subscription...");
  } else {
    setPushStatus("Push notifications are not enabled yet.");
  }
}

async function enableOneSignalPush() {
  const OneSignal = getOneSignal();

  if (!OneSignal) {
    setPushStatus("⚠️ OneSignal is not ready. Please wait a few seconds and try again.");
    return;
  }

  enablePushBtn.disabled = true;
  setPushStatus("⏳ Requesting notification permission...");

  try {
    const permissionGranted = await OneSignal.Notifications.requestPermission();

    if (!permissionGranted) {
      enablePushBtn.disabled = false;
      setPushStatus("Notifications were not enabled. Please choose Allow when prompted.");
      return;
    }

    const subscription = OneSignal.User?.PushSubscription;

    if (subscription?.optIn) {
      await subscription.optIn();
    }

    // Wait for OneSignal to create the subscription ID.
    for (let attempt = 0; attempt < 15; attempt++) {
      await new Promise(resolve => setTimeout(resolve, 1000));

      const state = await getPushSubscriptionState();

      if (state.optedIn && state.id) {
        enablePushBtn.textContent = "✅ Push Notifications Enabled";
        enablePushBtn.disabled = true;
        setPushStatus("Your device is subscribed to OneSignal push notifications.", true);
        return;
      }
    }

    enablePushBtn.disabled = false;
    setPushStatus(
      "⚠️ iOS allowed notifications, but OneSignal has not created the subscription yet. Please close and reopen Birthday Assistant from the Home Screen, then try again."
    );
  } catch (error) {
    console.error("OneSignal push setup failed:", error);
    enablePushBtn.disabled = false;
    setPushStatus("⚠️ OneSignal setup failed. Please refresh and try again.");
  }
}

async function testLocalNotification() {
  if (!("Notification" in window)) {
    alert("Notifications are not supported in this browser.");
    return;
  }

  if (Notification.permission !== "granted") {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      alert("Notification permission was not granted.");
      return;
    }
  }

  if ("serviceWorker" in navigator) {
    const registration = await navigator.serviceWorker.ready;

    await registration.showNotification("🎂 Birthday Assistant", {
      body: "This is a local notification test.",
      icon: "icons/icon-192.png",
      badge: "icons/icon-192.png",
      tag: "birthday-assistant-local-test"
    });
  }
}

window.addEventListener("onesignal-ready", refreshPushStatus);

window.addEventListener("onesignal-error", () => {
  setPushStatus("⚠️ OneSignal could not initialize. Please refresh the app.");
  enablePushBtn.disabled = false;
});

enablePushBtn.addEventListener("click", enableOneSignalPush);
testLocalBtn.addEventListener("click", testLocalNotification);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js")
      .then(() => console.log("Birthday Assistant service worker registered."))
      .catch(error => console.error("Service worker registration failed:", error));
  });
}

updateInstallHint();

setTimeout(() => {
  if (!getOneSignal()) {
    setPushStatus("⚠️ OneSignal is taking too long to initialize. Please refresh the app.");
  }
}, 8000);
