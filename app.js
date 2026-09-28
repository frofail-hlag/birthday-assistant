const enablePushBtn = document.getElementById("enablePushBtn");
const testLocalBtn = document.getElementById("testLocalBtn");
const pushStatus = document.getElementById("pushStatus");
const installHint = document.getElementById("installHint");

let oneSignalReady = false;

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
    return { ready: false, subscribed: false, optedIn: false };
  }

  try {
    const subscription = OneSignal.User?.PushSubscription;

    if (!subscription) {
      return { ready: true, subscribed: false, optedIn: false };
    }

    const optedIn = typeof subscription.optedIn === "boolean"
      ? subscription.optedIn
      : false;

    const id = subscription.id || null;

    return {
      ready: true,
      subscribed: Boolean(id) && optedIn,
      optedIn,
      id
    };
  } catch (error) {
    console.error("OneSignal subscription check failed:", error);
    return { ready: true, subscribed: false, optedIn: false };
  }
}

async function refreshPushStatus() {
  const OneSignal = getOneSignal();

  if (!OneSignal) {
    oneSignalReady = false;
    setPushStatus("⏳ Connecting to push service...");
    return;
  }

  oneSignalReady = true;

  const state = await getPushSubscriptionState();

  if (state.subscribed) {
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
    setPushStatus("⏳ Permission is allowed, but OneSignal is still registering this device. Please wait a moment and try again.");
  } else {
    setPushStatus("Push notifications are not enabled yet.");
  }
}

async function enableOneSignalPush() {
  const OneSignal = getOneSignal();

  if (!OneSignal) {
    setPushStatus("⏳ OneSignal is still loading. Please wait a few seconds and try again.");
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

    // Give OneSignal a moment to create/update the subscription.
    for (let attempt = 0; attempt < 8; attempt++) {
      await new Promise(resolve => setTimeout(resolve, 1000));

      const state = await getPushSubscriptionState();

      if (state.subscribed) {
        enablePushBtn.textContent = "✅ Push Notifications Enabled";
        enablePushBtn.disabled = true;
        setPushStatus("Your device is subscribed to OneSignal push notifications.", true);
        return;
      }
    }

    enablePushBtn.disabled = false;
    setPushStatus(
      "⚠️ iOS allowed notifications, but OneSignal has not confirmed the push subscription yet. Please make sure this app is installed on the Home Screen and try again."
    );
  } catch (error) {
    console.error("OneSignal push setup failed:", error);
    enablePushBtn.disabled = false;
    setPushStatus("⚠️ We couldn't confirm the OneSignal subscription. Please try again.");
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

window.addEventListener("onesignal-ready", async () => {
  await refreshPushStatus();
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

if (getOneSignal()) {
  refreshPushStatus();
} else {
  setPushStatus("⏳ Connecting to push service...");
  // In case OneSignal initializes very shortly after this script executes.
  setTimeout(refreshPushStatus, 2000);
}
