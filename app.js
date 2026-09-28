const pushStatus = document.getElementById("pushStatus");
const enablePushButton = document.getElementById("enablePush");
const testLocalButton = document.getElementById("testLocal");

function setPushStatus(message) {
  pushStatus.textContent = message;
}

async function updatePushState() {
  if (!window.OneSignal) {
    return;
  }

  try {
    const subscription = window.OneSignal.User?.PushSubscription;
    const optedIn = subscription?.optedIn;
    const subscriptionId = subscription?.id;

    if (optedIn && subscriptionId) {
      setPushStatus("✅ Push Notifications Enabled");
      enablePushButton.textContent = "✅ Push Notifications Enabled";
      enablePushButton.disabled = true;
      return;
    }

    setPushStatus("🔔 Push Notifications are not enabled yet.");
    enablePushButton.textContent = "🔔 Enable Push Notifications";
    enablePushButton.disabled = false;
  } catch (error) {
    console.error("Unable to read OneSignal subscription state:", error);
    setPushStatus("⚠️ Unable to read push subscription status.");
  }
}

window.addEventListener("onesignal-ready", async () => {
  setPushStatus("🔔 Push Notifications are ready to be enabled.");
  await updatePushState();

  // Refresh the UI if the subscription changes after the iOS permission flow.
  try {
    window.OneSignal.User.PushSubscription.addEventListener("change", updatePushState);
  } catch (error) {
    console.log("Subscription change listener unavailable:", error);
  }
});

window.addEventListener("onesignal-error", () => {
  setPushStatus("⚠️ OneSignal could not initialize. Please refresh the app.");
});

enablePushButton.addEventListener("click", async () => {
  enablePushButton.disabled = true;
  setPushStatus("⏳ Requesting notification permission...");

  try {
    if (!window.OneSignal) {
      throw new Error("OneSignal SDK is not available.");
    }

    await window.OneSignal.Notifications.requestPermission();
    await updatePushState();

    // Give iOS/OneSignal a little time to finish creating the subscription.
    setTimeout(updatePushState, 1500);
    setTimeout(updatePushState, 4000);
  } catch (error) {
    console.error("Push permission request failed:", error);
    setPushStatus("⚠️ Push permission could not be enabled. Please try again.");
    enablePushButton.disabled = false;
  }
});

testLocalButton.addEventListener("click", async () => {
  if (!("Notification" in window)) {
    alert("Notifications are not supported on this device/browser.");
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
    registration.showNotification("🎂 Birthday Assistant", {
      body: "Local notification test — everything is working!",
      icon: "icons/icon-192.png",
      badge: "icons/icon-192.png",
      tag: "birthday-assistant-local-test"
    });
  }
});

// Register the Birthday Assistant's own PWA service worker.
// OneSignal uses a separate worker under /onesignal/.
if ("serviceWorker" in navigator) {
  window.addEventListener("load", async () => {
    try {
      await navigator.serviceWorker.register("sw.js", {
        scope: "/birthday-assistant/"
      });
      console.log("Birthday Assistant service worker registered.");
    } catch (error) {
      console.error("PWA service worker registration failed:", error);
    }
  });
}

// Safety timeout for the UI only. It does not cancel OneSignal initialization.
setTimeout(() => {
  if (pushStatus.textContent.includes("Connecting")) {
    setPushStatus("⚠️ OneSignal is taking too long to initialize. Please refresh the app.");
  }
}, 12000);
