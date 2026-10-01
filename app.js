const $ = (id) => document.getElementById(id);

const pushStatus = $("pushStatus");
const enablePushButton = $("enablePush");
const testLocalButton = $("testLocal");
const remindersList = $("remindersList");
const noReminders = $("noReminders");
const reminderCount = $("reminderCount");

const PUSH_SETUP_KEY = "birthdayAssistantPushSetupCompleted";
const REMINDERS_KEY = "birthdayAssistantRemindersV1";
const REMINDER_TTL_MS = 24 * 60 * 60 * 1000;

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

function readReminders() {
  try {
    const raw = localStorage.getItem(REMINDERS_KEY);
    const reminders = raw ? JSON.parse(raw) : [];
    return Array.isArray(reminders) ? reminders : [];
  } catch (_) {
    return [];
  }
}

function writeReminders(reminders) {
  try { localStorage.setItem(REMINDERS_KEY, JSON.stringify(reminders)); } catch (_) {}
}

function makeReminderId(name, createdAt) {
  return `${String(name).trim().toLowerCase()}-${createdAt}`;
}

function cleanupExpiredReminders() {
  const now = Date.now();
  const active = readReminders().filter(reminder => {
    const expiresAt = Number(reminder.expiresAt || 0);
    return expiresAt > now;
  });

  if (active.length !== readReminders().length) {
    writeReminders(active);
  }
  return active;
}

function addBirthdayReminder({ name, message, createdAt = Date.now() }) {
  const cleanName = String(name || "").trim();
  if (!cleanName) return;

  const active = cleanupExpiredReminders();
  const normalizedName = cleanName.toLowerCase();

  // Prevent duplicate reminders for the same birthday person while an existing
  // 24-hour reminder is still active.
  const existing = active.find(r => String(r.name).trim().toLowerCase() === normalizedName);
  if (existing) {
    renderReminders(active);
    return;
  }

  const reminder = {
    id: makeReminderId(cleanName, createdAt),
    name: cleanName,
    message: message || `🎉 Don't forget! Tomorrow is ${cleanName}'s birthday!`,
    createdAt,
    expiresAt: createdAt + REMINDER_TTL_MS
  };

  active.unshift(reminder);
  writeReminders(active);
  renderReminders(active);
  logDiag(`Birthday reminder stored for ${cleanName}; expires ${new Date(reminder.expiresAt).toLocaleString()}.`);
}

function formatAgeRemaining(expiresAt) {
  const remaining = Math.max(0, expiresAt - Date.now());
  const hours = Math.floor(remaining / (60 * 60 * 1000));
  const minutes = Math.floor((remaining % (60 * 60 * 1000)) / (60 * 1000));
  if (hours > 0) return `Available for ${hours}h ${minutes}m`;
  return `Available for ${Math.max(1, minutes)}m`;
}

function renderReminders(reminders = cleanupExpiredReminders()) {
  const active = reminders.filter(r => Number(r.expiresAt) > Date.now());
  reminderCount.textContent = String(active.length);
  remindersList.innerHTML = "";

  if (!active.length) {
    noReminders.hidden = false;
    return;
  }

  noReminders.hidden = true;

  active.forEach(reminder => {
    const article = document.createElement("article");
    article.className = "reminder-item";

    const icon = document.createElement("div");
    icon.className = "reminder-icon";
    icon.textContent = "🎂";

    const content = document.createElement("div");
    content.className = "reminder-content";

    const title = document.createElement("h3");
    title.textContent = `${reminder.name}'s Birthday`;

    const body = document.createElement("p");
    body.textContent = reminder.message;

    const expiry = document.createElement("span");
    expiry.className = "reminder-expiry";
    expiry.textContent = formatAgeRemaining(Number(reminder.expiresAt));

    content.append(title, body, expiry);

    const createButton = document.createElement("button");
    createButton.type = "button";
    createButton.className = "primary-action create-birthday-card-button";
    createButton.textContent = "🎨 Create Birthday Card";
    createButton.setAttribute("data-birthday-card-create", reminder.name);
    createButton.addEventListener("click", function (event) {
      event.preventDefault();
      if (window.BirthdayCardUI) window.BirthdayCardUI.openHub(reminder.name);
    });

    article.append(icon, content, createButton);
    remindersList.appendChild(article);
  });
}

function importReminderFromLaunchUrl() {
  try {
    const params = new URLSearchParams(window.location.search);
    const birthday = params.get("birthday");
    if (!birthday) return;

    const cleanName = birthday.trim();
    if (!cleanName) return;

    const message = `🎉 Don't forget! Tomorrow is ${cleanName}'s birthday! 🎂`;
    addBirthdayReminder({ name: cleanName, message });

    // Remove the notification parameters after consuming them so a refresh
    // does not create a new reminder.
    const cleanUrl = `${window.location.pathname}${window.location.hash}`;
    window.history.replaceState({}, document.title, cleanUrl);
    logDiag(`Imported birthday reminder from notification launch URL: ${cleanName}`);
  } catch (error) {
    logDiag("Launch URL reminder import failed: " + error.message);
  }
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
      tag: "birthday-assistant-local-test",
      data: { url: "/birthday-assistant/" }
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

// V1.4 reminder layer: import the birthday carried by the notification launch
// URL, then keep active reminders for exactly 24 hours.
cleanupExpiredReminders();
importReminderFromLaunchUrl();
renderReminders();

// Refresh the visible expiry countdown and clean up automatically while the app
// remains open. Storage is also cleaned every time the app is reopened.
setInterval(() => renderReminders(), 60 * 1000);

setTimeout(() => {
  if (pushStatus.textContent.includes("Preparing")) {
    setStatus("⏳ Still connecting to push service...");
    logDiag("Initialization safety timeout reached.");
    updateDiagnostics();
  }
}, 12000);


/* V1.5.2.3 — stable card creator navigation */
(function () {
  const hub = document.getElementById("cardCreationHub");
  const editor = document.getElementById("cardEditor");
  if (!hub || !editor) return;

  const preview = document.getElementById("birthdayCardPreview");
  const previewName = document.getElementById("previewName");
  const previewMessage = document.getElementById("previewMessage");
  const nameInput = document.getElementById("cardName");
  const messageInput = document.getElementById("cardMessage");
  const counter = document.getElementById("messageCounter");
  const designOptions = document.getElementById("designOptions");
  const saveButton = document.getElementById("saveBirthdayCard");
  const closeEditor = document.getElementById("closeCardEditor");
  const cancelEditor = document.getElementById("cancelCardEditor");
  const closeHub = document.getElementById("closeCardCreationHub");

  const designs = [
    { id: "celebration", name: "Celebration", emoji: "🎉", className: "theme-celebration" },
    { id: "kids", name: "Kids", emoji: "🧸", className: "theme-kids" },
    { id: "sports", name: "Sports", emoji: "⚽", className: "theme-sports" },
    { id: "elegant", name: "Elegant", emoji: "✨", className: "theme-elegant" },
    { id: "fun", name: "Fun", emoji: "😄", className: "theme-fun" },
    { id: "classic", name: "Classic", emoji: "🎂", className: "theme-classic" },
    { id: "adventure", name: "Adventure", emoji: "🚀", className: "theme-sports" },
    { id: "unicorn", name: "Magical", emoji: "🦄", className: "theme-kids" },
    { id: "flowers", name: "Flowers", emoji: "🌸", className: "theme-elegant" },
    { id: "gaming", name: "Gaming", emoji: "🎮", className: "theme-sports" },
    { id: "space", name: "Space", emoji: "🌌", className: "theme-elegant" },
    { id: "rainbow", name: "Rainbow", emoji: "🌈", className: "theme-fun" }
  ];

  let activeSet = [];
  let activeDesign = designs[0];
  let currentBirthdayName = "";

  function shuffle(array) {
    const copy = array.slice();
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  function chooseDesignSet() {
    const key = "birthdayAssistantLastDesignSetV1";
    const previous = JSON.parse(localStorage.getItem(key) || "[]");
    let candidate = [];

    for (let attempt = 0; attempt < 12; attempt++) {
      candidate = shuffle(designs).slice(0, 6);
      if (!previous.length) break;
      const previousIds = new Set(previous);
      const overlap = candidate.filter(d => previousIds.has(d.id)).length;
      if (overlap <= 3) break;
    }

    activeSet = candidate;
    activeDesign = activeSet[0];
    localStorage.setItem(key, JSON.stringify(activeSet.map(d => d.id)));

    renderDesignOptions();
    applyDesign();
  }

  function renderDesignOptions() {
    if (!designOptions) return;
    designOptions.innerHTML = "";

    activeSet.forEach((design) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "design-option" + (design.id === activeDesign.id ? " selected" : "");
      button.setAttribute("aria-label", design.name);

      const swatch = document.createElement("span");
      swatch.className = "design-swatch " + design.className;
      swatch.textContent = design.emoji;

      const label = document.createElement("span");
      label.className = "design-option-name";
      label.textContent = design.name;

      button.append(swatch, label);
      button.addEventListener("click", function () {
        activeDesign = design;
        renderDesignOptions();
        applyDesign();
      });

      designOptions.appendChild(button);
    });
  }

  function applyDesign() {
    if (preview && activeDesign) {
      preview.className = "birthday-card-preview " + activeDesign.className;
    }
  }

  function updatePreview() {
    const name = (nameInput.value || "").trim() || "Birthday";
    const message = messageInput.value || "";
    previewName.textContent = name + (name === "Birthday" ? "!" : "!");
    previewMessage.textContent = message;
    counter.textContent = message.length + "/220";
  }

  function defaultMessage(name) {
    return `🎂 Alles Gute zum Geburtstag, ${name}! Ich wünsche dir einen wunderschönen Tag voller Freude, Glück und schöner Momente! 🎉`;
  }

  function showHub(name) {
    currentBirthdayName = name || currentBirthdayName || "Birthday";
    editor.hidden = true;
    hub.hidden = false;
    hub.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function openEditor(nameOverride) {
    if (nameOverride) currentBirthdayName = nameOverride;
    const name = currentBirthdayName || "Birthday";
    nameInput.value = name;
    messageInput.value = defaultMessage(name);
    chooseDesignSet();
    updatePreview();

    hub.hidden = true;
    editor.hidden = false;
    editor.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  // One and only one delegated handler for creation buttons.
  document.addEventListener("click", function (event) {
    const createButton = event.target.closest("[data-birthday-card-create]");
    if (createButton) {
      event.preventDefault();
      event.stopPropagation();
      showHub(createButton.getAttribute("data-birthday-card-create") || "Birthday");
      return;
    }

    const methodButton = event.target.closest("[data-creation-method]");
    if (methodButton) {
      event.preventDefault();
      event.stopPropagation();

      const method = methodButton.getAttribute("data-creation-method");
      if (method === "template") {
        openEditor();
      } else if (method === "ai") {
        alert("✨ AI card creation will be added in the next V1.5 step.");
      } else if (method === "photo") {
        alert("📷 Photo card creation will be added in the next V1.5 step.");
      }
      return;
    }
  });

  if (closeHub) {
    closeHub.addEventListener("click", function (event) {
      event.preventDefault();
      editor.hidden = true;
      hub.hidden = true;
      const reminders = document.getElementById("remindersCard");
      (reminders || document.body).scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  if (closeEditor) {
    closeEditor.addEventListener("click", function (event) {
      event.preventDefault();
      showHub(currentBirthdayName);
    });
  }

  if (cancelEditor) {
    cancelEditor.addEventListener("click", function (event) {
      event.preventDefault();
      showHub(currentBirthdayName);
    });
  }

  if (nameInput) nameInput.addEventListener("input", updatePreview);
  if (messageInput) messageInput.addEventListener("input", updatePreview);

  const shuffleButton = document.getElementById("shuffleDesigns");
  if (shuffleButton) {
    shuffleButton.addEventListener("click", function (event) {
      event.preventDefault();
      chooseDesignSet();
    });
  }

  if (saveButton) {
    saveButton.addEventListener("click", function (event) {
      event.preventDefault();

      const saved = {
        personName: (nameInput.value || "").trim() || "Birthday",
        message: messageInput.value || "",
        theme: activeDesign ? activeDesign.id : "celebration",
        createdAt: Date.now()
      };

      const key = "birthdayAssistantCardsV1";
      let existing = [];
      try {
        existing = JSON.parse(localStorage.getItem(key) || "[]");
      } catch (_) {
        existing = [];
      }

      existing.unshift(saved);
      localStorage.setItem(key, JSON.stringify(existing.slice(0, 30)));

      const original = saveButton.textContent;
      saveButton.textContent = "✅ Saved!";
      setTimeout(() => { saveButton.textContent = original; }, 1400);
    });
  }

  // Expose a clean API for the reminder renderer.
  window.updateBirthdayCardPreview = updatePreview;
  window.BirthdayAssistantV151 = window.BirthdayAssistantV151 || {};
  window.BirthdayAssistantV151.showHub = showHub;
  window.BirthdayAssistantV151.openEditor = openEditor;
})();
