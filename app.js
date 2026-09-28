const $ = (id) => document.getElementById(id);

const pushStatus = $("pushStatus");
const enablePushButton = $("enablePush");
const testLocalButton = $("testLocal");

function setStatus(text) {
  pushStatus.textContent = text;
}

function diag(id, value) {
  $(id).textContent = value;
}

function logDiag(message) {
  const el = $("diagLog");
  const time = new Date().toLocaleTimeString();
  el.textContent += `\n[${time}] ${message}`;
  console.log("[Birthday Assistant]", message);
}

async function inspectServiceWorkers() {
  if (!("serviceWorker" in navigator)) {
    diag("diagPwaSw", "Not supported");
    diag("diagOsSw", "Not supported");
    return;
  }

  try {
    const regs = await navigator.serviceWorker.getRegistrations();
    const scopes = regs.map(r => r.scope);
    diag(
      "diagPwaSw",
      scopes.some(s => s.endsWith("/birthday-assistant/")) ? "Registered" : "Not found"
    );
    diag(
      "diagOsSw",
      scopes.some(s => s.endsWith("/birthday-assistant/onesignal/")) ? "Registered" : "Not found"
    );
    logDiag("Service-worker scopes: " + (scopes.length ? scopes.join(" | ") : "none"));
  } catch (error) {
    diag("diagPwaSw", "Error");
    diag("diagOsSw", "Error");
    logDiag("Could not inspect service workers: " + error.message);
  }
}

async function updateDiagnostics() {
  const OneSignal = window.__oneSignal;

  diag("diagSdk", OneSignal ? "Initialized" : "Not initialized");

  const supported =
    "Notification" in window &&
    "serviceWorker" in navigator &&
    "PushManager" in window;

  diag("diagSupport", supported ? "Yes" : "No");

  diag(
    "diagPermission",
    "Notification" in window ? Notification.permission : "Unavailable"
  );

  if (!OneSignal) {
    diag("diagOptedIn", "Unknown");
    diag("diagSubId", "Unknown");
    diag("diagToken", "Unknown");
    await inspectServiceWorkers();
    return;
  }

  try {
    const sub = OneSignal.User?.PushSubscription;
    diag("diagOptedIn", String(sub?.optedIn ?? "undefined"));
    diag("diagSubId", sub?.id || "None");
    diag("diagToken", sub?.token ? "Present" : "None");
    logDiag(
      `Subscription state: optedIn=${sub?.optedIn}, id=${sub?.id || "none"}, token=${sub?.token ? "present" : "none"}`
    );
  } catch (error) {
    diag("diagOptedIn", "Error");
    diag("diagSubId", "Error");
    diag("diagToken", "Error");
    logDiag("Subscription inspection failed: " + error.message);
  }

  await inspectServiceWorkers();
}

async function updatePushState() {
  const OneSignal = window.__oneSignal;

  if (!OneSignal) {
    setStatus("⚠️ OneSignal is not initialized.");
    enablePushButton.disabled = false;
    return;
  }

  try {
    const sub = OneSignal.User?.PushSubscription;

    if (sub?.optedIn && sub?.id) {
      setStatus("✅ Push Notifications Enabled");
      enablePushButton.textContent = "✅ Push Notifications Enabled";
      enablePushButton.disabled = true;
    } else {
      setStatus("🔔 Push Notifications are not enabled yet.");
      enablePushButton.textContent = "🔔 Enable Push Notifications";
      enablePushButton.disabled = false;
    }

    await updateDiagnostics();
  } catch (error) {
    logDiag("State update failed: " + error.message);
    setStatus("⚠️ Unable to read push subscription status.");
    enablePushButton.disabled = false;
  }
}

window.addEventListener("onesignal-ready", async () => {
  setStatus("🔔 OneSignal initialized. Ready to enable push.");
  logDiag("OneSignal initialization completed.");
  await updateDiagnostics();

  try {
    window.__oneSignal.User.PushSubscription.addEventListener("change", async (event) => {
      logDiag("Push subscription changed.");
      await updateDiagnostics();
      await updatePushState();
    });
  } catch (error) {
    logDiag("Subscription change listener unavailable: " + error.message);
  }
});

window.addEventListener("onesignal-error", async (event) => {
  const error = event.detail;
  setStatus("⚠️ OneSignal could not initialize. Please refresh the app.");
  diag("diagSdk", "Initialization failed");
  logDiag("OneSignal initialization error: " + (error?.message || String(error)));
  await inspectServiceWorkers();
});

enablePushButton.addEventListener("click", async () => {
  enablePushButton.disabled = true;
  setStatus("⏳ Requesting notification permission...");
  logDiag("Enable button pressed.");

  try {
    const OneSignal = window.__oneSignal;
    if (!OneSignal) {
      throw new Error("OneSignal SDK is not initialized.");
    }

    const permission = await OneSignal.Notifications.requestPermission();
    logDiag("Notification permission result: " + permission);

    // Explicitly opt the OneSignal subscription in after permission.
    if (OneSignal.User?.PushSubscription?.optIn) {
      await OneSignal.User.PushSubscription.optIn();
      logDiag("PushSubscription.optIn() completed.");
    } else {
      logDiag("PushSubscription.optIn() is not available.");
    }

    await updateDiagnostics();
    await updatePushState();

    setTimeout(updateDiagnostics, 1500);
    setTimeout(updatePushState, 1500);
    setTimeout(updateDiagnostics, 4000);
    setTimeout(updatePushState, 4000);
  } catch (error) {
    console.error("Push enable failed:", error);
    logDiag("Push enable error: " + (error?.message || String(error)));
    setStatus("⚠️ Push setup failed. See Diagnostics below.");
    enablePushButton.disabled = false;
    await updateDiagnostics();
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

  try {
    const registration = await navigator.serviceWorker.ready;
    await registration.showNotification("🎂 Birthday Assistant", {
      body: "Local notification test — everything is working!",
      icon: "icons/icon-192.png",
      badge: "icons/icon-192.png",
      tag: "birthday-assistant-local-test"
    });
  } catch (error) {
    logDiag("Local notification failed: " + error.message);
    alert("Local notification failed: " + error.message);
  }
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", async () => {
    try {
      await navigator.serviceWorker.register("sw.js", {
        scope: "/birthday-assistant/"
      });
      logDiag("Birthday Assistant PWA service worker registered.");
      await inspectServiceWorkers();
    } catch (error) {
      logDiag("PWA service worker registration failed: " + error.message);
    }
  });
}

setTimeout(() => {
  if (pushStatus.textContent.includes("Connecting")) {
    setStatus("⚠️ OneSignal is taking too long to initialize. Please refresh the app.");
    logDiag("Initialization safety timeout reached.");
    updateDiagnostics();
  }
}, 12000);
