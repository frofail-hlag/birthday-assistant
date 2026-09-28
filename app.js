const $ = (id) => document.getElementById(id);

const pushStatus = $("pushStatus");
const enablePushButton = $("enablePush");
const testLocalButton = $("testLocal");
const PUSH_SETUP_KEY = "birthdayAssistantPushSetupCompleted";

function setStatus(text) {
  pushStatus.textContent = text;
}

function diag(id, value) {
  const el = $(id);
  if (el) el.textContent = value;
}

function logDiag(message) {
  const el = $("diagLog");
  const time = new Date().toLocaleTimeString();
  if (el) el.textContent += `\n[${time}] ${message}`;
  console.log("[Birthday Assistant]", message);
}

function workerState(worker) {
  if (!worker) return "none";
  return worker.state || "unknown";
}

function markPushSetupCompleted() {
  try { localStorage.setItem(PUSH_SETUP_KEY, "true"); } catch (_) {}
}

function hasCompletedPushSetup() {
  try { return localStorage.getItem(PUSH_SETUP_KEY) === "true"; } catch (_) { return false; }
}

async function inspectServiceWorkers() {
  if (!("serviceWorker" in navigator)) {
    diag("diagPwaSw", "Not supported");
    diag("diagOsSw", "Not supported");
    diag("diagOsState", "Not supported");
    diag("diagOsScope", "Not supported");
    return;
  }

  try {
    const regs = await navigator.serviceWorker.getRegistrations();
    const scopes = regs.map(r => r.scope);
    const pwa = regs.find(r => r.scope.endsWith("/birthday-assistant/"));
    const os = regs.find(r => r.scope.endsWith("/birthday-assistant/onesignal/"));

    diag("diagPwaSw", pwa ? "Registered" : "Not found");
    diag("diagOsSw", os ? "Registered" : "Not found");

    if (os) {
      const worker = os.active || os.waiting || os.installing;
      diag("diagOsState", workerState(worker));
      diag("diagOsScope", os.scope);
      if (worker?.scriptURL) logDiag(`OneSignal worker script=${worker.scriptURL}`);
    } else {
      diag("diagOsState", "No registration");
      diag("diagOsScope", "None");
    }

    logDiag("All service-worker scopes: " + (scopes.length ? scopes.join(" | ") : "none"));
  } catch (error) {
    diag("diagPwaSw", "Error");
    diag("diagOsSw", "Error");
    diag("diagOsState", "Error");
    diag("diagOsScope", "Error");
    logDiag("Service-worker inspection error: " + error.message);
  }
}

async function updateDiagnostics() {
  const OneSignal = window.__oneSignal;
  diag("diagSdk", OneSignal ? "Initialized" : "Not initialized");

  const supported = "Notification" in window && "serviceWorker" in navigator && "PushManager" in window;
  diag("diagSupport", supported ? "Yes" : "No");
  diag("diagPermission", "Notification" in window ? Notification.permission : "Unavailable");

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
    await inspectServiceWorkers();
  } catch (error) {
    diag("diagOptedIn", "Error");
    diag("diagSubId", "Error");
    diag("diagToken", "Error");
    logDiag("Subscription inspection error: " + error.message);
  }
}

function setEnabledState() {
  setStatus("✅ Push Notifications Enabled");
  enablePushButton.textContent = "✅ Push Notifications Enabled";
  enablePushButton.disabled = true;
  markPushSetupCompleted();
}

async function waitForExistingSubscription(timeoutMs = 8000) {
  const OneSignal = window.__oneSignal;
  if (!OneSignal) return null;

  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const sub = OneSignal.User?.PushSubscription;
      if (sub?.optedIn && sub?.id) return sub;
    } catch (_) {}
    await new Promise(resolve => setTimeout(resolve, 400));
  }
  return null;
}

async function updatePushState({ allowWaiting = true } = {}) {
  const OneSignal = window.__oneSignal;

  if (!OneSignal) {
    setStatus("⏳ Connecting to push service...");
    enablePushButton.disabled = true;
    return;
  }

  try {
    const sub = await waitForExistingSubscription(allowWaiting ? 8000 : 0);

    if (sub?.optedIn && sub?.id) {
      setEnabledState();
      await updateDiagnostics();
      return;
    }

    const permission = "Notification" in window ? Notification.permission : "unsupported";

    // If the user has already completed setup before, don't immediately ask them
    // to press Enable again while OneSignal is still restoring its subscription.
    if (hasCompletedPushSetup() && permission === "granted") {
      setStatus("🔄 Restoring notification connection...");
      enablePushButton.textContent = "🔄 Checking Notifications...";
      enablePushButton.disabled = true;

      const retry = await waitForExistingSubscription(7000);
      if (retry?.optedIn && retry?.id) {
        setEnabledState();
      } else {
        setStatus("⚠️ Could not confirm the existing push subscription.");
        enablePushButton.textContent = "🔔 Check Push Notifications";
        enablePushButton.disabled = false;
      }
    } else if (permission === "denied") {
      setStatus("⚠️ Notifications are blocked in iPad settings.");
      enablePushButton.textContent = "🔔 Open Notification Settings";
      enablePushButton.disabled = false;
    } else {
      setStatus("🔔 Push Notifications are not enabled yet.");
      enablePushButton.textContent = "🔔 Enable Push Notifications";
      enablePushButton.disabled = false;
    }

    await updateDiagnostics();
  } catch (error) {
    logDiag("State update error: " + error.message);
    setStatus("⚠️ Unable to read push subscription status.");
    enablePushButton.textContent = "🔔 Enable Push Notifications";
    enablePushButton.disabled = false;
  }
}

window.addEventListener("onesignal-worker-registered", async () => {
  logDiag("Explicit OneSignal worker registration completed.");
  await inspectServiceWorkers();
});

window.addEventListener("onesignal-ready", async () => {
  logDiag("OneSignal initialization completed.");
  await updatePushState();

  try {
    window.__oneSignal.User.PushSubscription.addEventListener("change", async () => {
      logDiag("Push subscription changed.");
      await updateDiagnostics();
      await updatePushState({ allowWaiting: false });
    });
  } catch (error) {
    logDiag("Subscription change listener unavailable: " + error.message);
  }
});

window.addEventListener("onesignal-error", async (event) => {
  const error = event.detail;
  setStatus("⚠️ OneSignal setup failed. See Diagnostics below.");
  diag("diagSdk", "Setup failed");
  logDiag("OneSignal setup error: " + (error?.message || String(error)));
  await inspectServiceWorkers();
});

enablePushButton.addEventListener("click", async () => {
  if ("Notification" in window && Notification.permission === "denied") {
    setStatus("⚠️ Notifications are blocked. Enable them in iPad Settings.");
    return;
  }

  enablePushButton.disabled = true;
  setStatus("⏳ Requesting notification permission...");
  logDiag("Enable button pressed.");

  try {
    const OneSignal = window.__oneSignal;
    if (!OneSignal) throw new Error("OneSignal SDK is not initialized.");

    const regs = await navigator.serviceWorker.getRegistrations();
    const osReg = regs.find(r => r.scope.endsWith("/birthday-assistant/onesignal/"));
    if (!osReg) throw new Error("OneSignal worker registration is missing at enable time.");

    const permission = await OneSignal.Notifications.requestPermission();
    logDiag("Notification permission result: " + permission);

    if (OneSignal.User?.PushSubscription?.optIn) {
      await OneSignal.User.PushSubscription.optIn();
      logDiag("PushSubscription.optIn() completed.");
    } else {
      throw new Error("PushSubscription.optIn() is unavailable.");
    }

    const sub = await waitForExistingSubscription(8000);
    if (sub?.optedIn && sub?.id) {
      setEnabledState();
    } else {
      setStatus("⚠️ Push setup is still completing. Please wait a moment.");
      enablePushButton.disabled = false;
    }

    await updateDiagnostics();
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
      const reg = await navigator.serviceWorker.register("sw.js", { scope: "/birthday-assistant/" });
      logDiag("Birthday Assistant PWA service worker registered.");
      logDiag(`PWA worker state=${workerState(reg.active || reg.waiting || reg.installing)}`);
      await inspectServiceWorkers();
    } catch (error) {
      logDiag("PWA service worker registration failed: " + error.message);
    }
  });
}

setTimeout(() => {
  if (pushStatus.textContent.includes("Preparing")) {
    setStatus("⏳ Still connecting to push service...");
    logDiag("Initialization safety timeout reached.");
    updateDiagnostics();
  }
}, 12000);
