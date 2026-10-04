
// V1.6.3.4 — shared HTML escaping helper for AI-generated card content.
function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

const $ = (id) => document.getElementById(id);

const pushStatus = $("pushStatus");
const enablePushButton = $("enablePush");
const testLocalButton = $("testLocal");
const remindersList = $("remindersList");
const noReminders = $("noReminders");
const reminderCount = $("reminderCount");
const savedCardsList = $("savedCardsList");
const noSavedCards = $("noSavedCards");
const savedCardCount = $("savedCardCount");
const myCardsCard = $("myCardsCard");
const myCardsToggle = $("myCardsToggle");
const myCardsContent = $("myCardsContent");

const CARDS_KEY = "birthdayAssistantCardsV1";

const PUSH_SETUP_KEY = "birthdayAssistantPushSetupCompleted";
const REMINDERS_KEY = "birthdayAssistantRemindersV1";
const REMINDER_TTL_MS = 24 * 60 * 60 * 1000;

initMyCardsToggle();

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

function setMyCardsExpanded(expanded, { scroll = false } = {}) {
  if (!myCardsCard || !myCardsToggle || !myCardsContent) return;
  myCardsCard.classList.toggle("collapsed", !expanded);
  myCardsToggle.setAttribute("aria-expanded", String(expanded));
  myCardsContent.hidden = !expanded;
  try { localStorage.setItem("birthdayAssistantMyCardsExpandedV1", expanded ? "true" : "false"); } catch (_) {}
  if (scroll && expanded) myCardsCard.scrollIntoView({ behavior: "smooth", block: "start" });
}

function initMyCardsToggle() {
  if (!myCardsToggle) return;
  let expanded = false;
  try { expanded = localStorage.getItem("birthdayAssistantMyCardsExpandedV1") === "true"; } catch (_) {}
  setMyCardsExpanded(expanded);
  myCardsToggle.addEventListener("click", () => {
    const next = myCardsToggle.getAttribute("aria-expanded") !== "true";
    setMyCardsExpanded(next);
  });
}

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeCardPreview();
});

function readSavedCards() {
  try {
    const raw = localStorage.getItem(CARDS_KEY);
    const cards = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(cards)) return [];
    return cards.map((card, index) => ({
      ...card,
      id: card.id || `legacy-${card.createdAt || Date.now()}-${index}`
    }));
  } catch (_) {
    return [];
  }
}

function writeSavedCards(cards) {
  try { localStorage.setItem(CARDS_KEY, JSON.stringify(cards.slice(0, 30))); } catch (_) {}
}

function formatSavedCardDate(timestamp) {
  try {
    return new Date(Number(timestamp)).toLocaleDateString(undefined, {
      day: "2-digit",
      month: "short",
      year: "numeric"
    });
  } catch (_) {
    return "";
  }
}

function cardDesignById(id) {
  const fallback = { id: "celebration", name: "Celebration", emoji: "🎉", className: "theme-celebration", top: "🎈　🎈　🎈", bottom: "🎂　🎁　🎉", watermark: "🎉" };
  const designs = window.BirthdayCardDesigns || [];
  return designs.find(d => d.id === id) || fallback;
}

function renderSavedCards() {
  if (!savedCardsList || !noSavedCards || !savedCardCount) return;

  const cards = readSavedCards();
  savedCardCount.textContent = String(cards.length);
  savedCardsList.innerHTML = "";
  noSavedCards.hidden = cards.length > 0;

  cards.forEach((card) => {
    const design = cardDesignById(card.theme);
    const article = document.createElement("article");
    article.className = "saved-card-item";
    article.dataset.cardId = card.id || "";

    const preview = document.createElement("div");
    preview.className = "saved-card-preview birthday-card-preview " + design.className + (card.aiImageDataUrl ? " ai-art-active ai-saved-art" : "");
    preview.innerHTML = `
      <div class="card-theme-watermark" aria-hidden="true"></div>
      <div class="card-decoration card-decoration-top"></div>
      <div class="card-eyebrow">HAPPY BIRTHDAY</div>
      <div class="preview-name"></div>
      <div class="preview-message"></div>
      <div class="card-decoration card-decoration-bottom"></div>
    `;
    if (card.aiImageDataUrl) {
      preview.classList.add("ai-saved-art");
      const aiImg = document.createElement("img");
      aiImg.className = "saved-card-ai-image";
      aiImg.src = card.aiImageDataUrl;
      aiImg.alt = `AI-generated birthday card for ${card.personName || "Birthday"}`;
      preview.appendChild(aiImg);
    }
    preview.querySelector(".preview-name").textContent = `${card.personName || "Birthday"}!`;
    preview.querySelector(".preview-message").textContent = card.message || "";
    preview.querySelector(".card-decoration-top").textContent = design.top || design.emoji;
    preview.querySelector(".card-decoration-bottom").textContent = design.bottom || design.emoji;
    preview.querySelector(".card-theme-watermark").textContent = design.watermark || design.emoji;
    preview.setAttribute("role", "button");
    preview.setAttribute("tabindex", "0");
    preview.setAttribute("aria-label", `Open ${card.personName || "birthday"} card full screen`);
    preview.addEventListener("click", () => openCardPreview(card));
    preview.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") { event.preventDefault(); openCardPreview(card); }
    });

    const meta = document.createElement("div");
    meta.className = "saved-card-meta";
    meta.innerHTML = `<div class="saved-card-person"></div><div class="saved-card-details">${design.emoji} ${design.name} · ${formatSavedCardDate(card.createdAt)}</div>`;
    meta.querySelector(".saved-card-person").textContent = card.personName || "Birthday";

    const actions = document.createElement("div");
    actions.className = "saved-card-actions";

    const previewButton = document.createElement("button");
    previewButton.type = "button";
    previewButton.className = "secondary-action";
    previewButton.textContent = "👁️ Preview";
    previewButton.addEventListener("click", () => openCardPreview(card));

    const openButton = document.createElement("button");
    openButton.type = "button";
    openButton.className = "secondary-action";
    openButton.textContent = "✏️ Edit";
    openButton.addEventListener("click", () => window.BirthdayAssistantV151?.openSavedCard?.(card.id));

    const shareButton = document.createElement("button");
    shareButton.type = "button";
    shareButton.className = "secondary-action";
    shareButton.textContent = "📤 Share";
    shareButton.addEventListener("click", () => shareSavedCard(card));

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "secondary-action danger-action";
    deleteButton.textContent = "🗑️ Delete";
    deleteButton.addEventListener("click", () => {
      const remaining = readSavedCards().filter(item => item.id !== card.id);
      writeSavedCards(remaining);
      renderSavedCards();
    });

    actions.append(previewButton, openButton, shareButton, deleteButton);
    article.append(preview, meta, actions);
    savedCardsList.appendChild(article);
  });
}

function openCardPreview(card) {
  const design = cardDesignById(card.theme);
  let modal = document.getElementById("savedCardPreviewModal");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "savedCardPreviewModal";
    modal.className = "saved-card-preview-modal";
    modal.hidden = true;
    modal.innerHTML = `
      <div class="saved-card-preview-backdrop" data-close-card-preview></div>
      <div class="saved-card-preview-dialog" role="dialog" aria-modal="true" aria-labelledby="savedCardPreviewTitle">
        <div class="saved-card-preview-toolbar">
          <strong id="savedCardPreviewTitle">Birthday Card</strong>
          <button type="button" class="icon-back" data-close-card-preview aria-label="Close preview">✕</button>
        </div>
        <div class="saved-card-full-preview-wrap">
          <div id="savedCardFullPreview" class="birthday-card-preview saved-card-full-preview"></div>
        </div>
        <div class="saved-card-preview-actions">
          <button type="button" id="savedCardPreviewShare" class="primary-action">📤 Share</button>
          <button type="button" id="savedCardPreviewEdit" class="secondary-action">✏️ Edit</button>
        </div>
      </div>`;
    document.body.appendChild(modal);
    modal.addEventListener("click", (event) => {
      if (event.target.closest("[data-close-card-preview]")) closeCardPreview();
    });
    document.getElementById("savedCardPreviewShare")?.addEventListener("click", async () => {
      const current = modal.__card;
      if (current) await shareSavedCard(current);
    });
    document.getElementById("savedCardPreviewEdit")?.addEventListener("click", () => {
      const current = modal.__card;
      closeCardPreview();
      if (current) window.BirthdayAssistantV151?.openSavedCard?.(current.id);
    });
  }
  modal.__card = card;
  const full = document.getElementById("savedCardFullPreview");
  const title = document.getElementById("savedCardPreviewTitle");
  title.textContent = `${card.personName || "Birthday"} · ${design.name}`;
  full.className = `birthday-card-preview saved-card-full-preview ${design.className}${card.aiImageDataUrl ? " ai-art-active" : ""}`;
  full.innerHTML = `
    ${card.aiImageDataUrl ? `<img class="preview-ai-image" src="${card.aiImageDataUrl}" alt="AI-generated birthday artwork">` : ""}
    <div class="card-theme-watermark" aria-hidden="true">${design.watermark || design.emoji}</div>
    <div class="card-decoration card-decoration-top">${design.top || design.emoji}</div>
    <div class="card-eyebrow">HAPPY BIRTHDAY</div>
    <div class="preview-name"></div>
    <div class="preview-message"></div>
    <div class="card-decoration card-decoration-bottom">${design.bottom || design.emoji}</div>`;
  full.querySelector(".preview-name").textContent = `${card.personName || "Birthday"}!`;
  full.querySelector(".preview-message").textContent = card.message || "";
  modal.hidden = false;
  document.body.classList.add("modal-open");
}

function closeCardPreview() {
  const modal = document.getElementById("savedCardPreviewModal");
  if (modal) modal.hidden = true;
  document.body.classList.remove("modal-open");
}

async function shareSavedCard(card) {
  const text = `🎂 Birthday card for ${card.personName || "Birthday"}!\n\n${card.message || ""}`;
  try {
    if (card.aiImageDataUrl && navigator.share && navigator.canShare) {
      const response = await fetch(card.aiImageDataUrl);
      const blob = await response.blob();
      const file = new File([blob], `birthday-${(card.personName || "card").replace(/[^a-z0-9_-]+/gi, "-")}.jpg`, { type: blob.type || "image/jpeg" });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: `🎂 Birthday Card – ${card.personName || "Birthday"}`,
          text,
          files: [file]
        });
        return;
      }
    }
    if (navigator.share) {
      await navigator.share({
        title: `🎂 Birthday Card – ${card.personName || "Birthday"}`,
        text,
        url: window.location.origin + window.location.pathname
      });
      return;
    }
    await navigator.clipboard.writeText(text);
    alert("📋 Card message copied to your clipboard.");
  } catch (error) {
    if (error?.name !== "AbortError") alert("Sharing was cancelled or is not available on this device.");
  }
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
setInterval(() => { renderReminders(); renderSavedCards(); }, 60 * 1000);

setTimeout(() => {
  if (pushStatus.textContent.includes("Preparing")) {
    setStatus("⏳ Still connecting to push service...");
    logDiag("Initialization safety timeout reached.");
    updateDiagnostics();
  }
}, 12000);


/* V1.5.3.2 — visual theme consistency and header icon polish */
(function () {
  const hub = document.getElementById("cardCreationHub");
  const editor = document.getElementById("cardEditor");
  if (!hub || !editor) return;

  const preview = document.getElementById("birthdayCardPreview");
  const previewName = document.getElementById("previewName");
  const previewMessage = document.getElementById("previewMessage");
  const previewAIImage = document.getElementById("previewAIImage");
  const nameInput = document.getElementById("cardName");
  const messageInput = document.getElementById("cardMessage");
  const counter = document.getElementById("messageCounter");
  const designOptions = document.getElementById("designOptions");
  const saveButton = document.getElementById("saveBirthdayCard");
  const closeEditor = document.getElementById("closeCardEditor");
  const cancelEditor = document.getElementById("cancelCardEditor");
  const closeHub = document.getElementById("closeCardCreationHub");

  const designs = [
    { id: "celebration", name: "Celebration", emoji: "🎉", className: "theme-celebration", top: "🎈　🎈　🎈", bottom: "🎂　🎁　🎉", watermark: "🎉" },
    { id: "kids", name: "Kids", emoji: "🧸", className: "theme-kids", top: "🧸　🎈　🧸", bottom: "🧸　⭐　🎈", watermark: "🧸" },
    { id: "sports", name: "Sports", emoji: "⚽", className: "theme-sports", top: "⚽　🏆　⚽", bottom: "🏆　⚽　🏆", watermark: "⚽" },
    { id: "elegant", name: "Elegant", emoji: "✨", className: "theme-elegant", top: "✦　✧　✦", bottom: "✧　✦　✧", watermark: "✦" },
    { id: "fun", name: "Fun", emoji: "😄", className: "theme-fun", top: "😄　🎈　🤩", bottom: "🎉　😄　🎊", watermark: "😄" },
    { id: "classic", name: "Classic", emoji: "🎂", className: "theme-classic", top: "🕯️　🎂　🕯️", bottom: "🎂　🎁　🎂", watermark: "🎂" },
    { id: "adventure", name: "Adventure", emoji: "🚀", className: "theme-adventure", top: "🚀　🗺️　🧭", bottom: "🧭　🏔️　🚀", watermark: "🚀" },
    { id: "unicorn", name: "Magical", emoji: "🦄", className: "theme-magical", top: "🦄　✨　🌈", bottom: "🌈　🦄　✨", watermark: "🦄" },
    { id: "flowers", name: "Flowers", emoji: "🌸", className: "theme-flowers", top: "🌸　🌷　🌸", bottom: "🌺　🌸　🌷", watermark: "🌸" },
    { id: "gaming", name: "Gaming", emoji: "🎮", className: "theme-gaming", top: "🎮　🕹️　🎮", bottom: "🕹️　🎮　🏆", watermark: "🎮" },
    { id: "space", name: "Space", emoji: "🌌", className: "theme-space", top: "🚀　🪐　🌙", bottom: "⭐　🪐　🚀", watermark: "🪐" },
    { id: "rainbow", name: "Rainbow", emoji: "🌈", className: "theme-rainbow", top: "🌈　☀️　🌈", bottom: "🌈　⭐　🌈", watermark: "🌈" }
  ];

  window.BirthdayCardDesigns = designs;
  renderSavedCards();

  let activeSet = [];
  let activeDesign = designs[0];
  let currentBirthdayName = "";
  let editingCardId = null;
  let currentAIStorageImageDataUrl = null;

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
      swatch.innerHTML = `<span class="design-swatch-pattern">${design.top || design.emoji}</span><strong>${design.emoji}</strong><span class="design-swatch-name">${design.name}</span>`;

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
      const aiActive = preview.classList.contains("ai-art-active");
      preview.className = "birthday-card-preview " + activeDesign.className + (aiActive ? " ai-art-active" : "");
      const top = preview.querySelector(".card-decoration-top");
      const bottom = preview.querySelector(".card-decoration-bottom");
      const watermark = preview.querySelector(".card-theme-watermark");
      if (top) top.textContent = activeDesign.top || activeDesign.emoji;
      if (bottom) bottom.textContent = activeDesign.bottom || activeDesign.emoji;
      if (watermark) watermark.textContent = activeDesign.watermark || activeDesign.emoji;
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
    window.__birthdayCurrentName = currentBirthdayName;
    editor.hidden = true;
    hub.hidden = false;
    hub.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function openEditor(nameOverride) {
    editingCardId = null;
    currentAIStorageImageDataUrl = null;
    if (previewAIImage) { previewAIImage.hidden = true; previewAIImage.removeAttribute("src"); }
    preview?.classList.remove("ai-art-active");
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
        return;
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

      const existing = readSavedCards();
      const now = Date.now();
      const saved = {
        id: editingCardId || `card-${now}-${Math.random().toString(36).slice(2, 8)}`,
        personName: (nameInput.value || "").trim() || "Birthday",
        message: messageInput.value || "",
        theme: activeDesign ? activeDesign.id : "celebration",
        aiImageDataUrl: previewAIImage && !previewAIImage.hidden ? (currentAIStorageImageDataUrl || previewAIImage.src) : null,
        createdAt: editingCardId
          ? (existing.find(item => item.id === editingCardId)?.createdAt || now)
          : now
      };

      const updated = editingCardId
        ? existing.map(item => item.id === editingCardId ? saved : item)
        : [saved, ...existing];

      writeSavedCards(updated);
      renderSavedCards();
      editingCardId = null;

      const original = saveButton.textContent;
      saveButton.textContent = "✅ Saved!";
      setTimeout(() => {
        saveButton.textContent = original;
        editor.hidden = true;
        setMyCardsExpanded(true, { scroll: true });
      }, 550);
    });
  }


  const createNewCardButton = document.getElementById("createNewCardFromLibrary");
  if (createNewCardButton) {
    createNewCardButton.addEventListener("click", function (event) {
      event.preventDefault();
      showHub("Birthday");
    });
  }

  function openAIEditor(nameOverride, imageDataUrl, messageOverride) {
    editingCardId = null;
    if (nameOverride) currentBirthdayName = nameOverride;
    const name = currentBirthdayName || "Birthday";
    nameInput.value = name;
    messageInput.value = messageOverride || defaultMessage(name);
    activeSet = designs.slice();
    activeDesign = designs.find(d => d.id === "celebration") || designs[0];
    renderDesignOptions();
    applyDesign();
    currentAIStorageImageDataUrl = window.__birthdayAIStorageImageDataUrl || imageDataUrl || null;
    if (previewAIImage && imageDataUrl) {
      previewAIImage.src = imageDataUrl;
      previewAIImage.hidden = false;
      preview.classList.add("ai-art-active");
    }
    updatePreview();
    hub.hidden = true;
    editor.hidden = false;
    editor.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  // Expose a clean API for the reminder renderer.
  window.updateBirthdayCardPreview = updatePreview;
  window.BirthdayAssistantV151 = window.BirthdayAssistantV151 || {};
  window.BirthdayAssistantV151.showHub = showHub;
  window.BirthdayAssistantV151.openEditor = openEditor;
  window.BirthdayAssistantV151.openAIEditor = openAIEditor;
  window.BirthdayAssistantV151.openSavedCard = function (cardId) {
    const card = readSavedCards().find(item => item.id === cardId);
    if (!card) return;
    currentBirthdayName = card.personName || "Birthday";
    currentAIStorageImageDataUrl = card.aiImageDataUrl || null;
    nameInput.value = card.personName || "Birthday";
    messageInput.value = card.message || "";
    activeDesign = designs.find(d => d.id === card.theme) || designs[0];
    activeSet = designs.slice();
    renderDesignOptions();
    applyDesign();
    if (previewAIImage) {
      if (card.aiImageDataUrl) {
        previewAIImage.src = card.aiImageDataUrl;
        previewAIImage.hidden = false;
        preview.classList.add("ai-art-active");
      } else {
        previewAIImage.hidden = true;
        previewAIImage.removeAttribute("src");
        preview.classList.remove("ai-art-active");
      }
    }
    updatePreview();
    editingCardId = card.id;
    hub.hidden = true;
    editor.hidden = false;
    editor.scrollIntoView({ behavior: "smooth", block: "start" });
  };
})();

/* =========================================================
   V1.6.3.4 — Real AI Birthday Card Studio
   ========================================================= */
(function () {
  const hub = document.getElementById("cardCreationHub");
  const studio = document.getElementById("aiCardStudio");
  if (!hub || !studio) return;

  const AI_WEBHOOK_URL = "https://hook.eu1.make.com/qwyp4tyvxa3ef05kz2k8td114fpi5ra0";
  const aiName = document.getElementById("aiPersonName");
  const aiInterest = document.getElementById("aiInterest");
  const aiNotes = document.getElementById("aiNotes");
  const photoInput = document.getElementById("aiPhotoInput");
  const uploadPreview = document.getElementById("aiUploadPreview");
  const uploadText = document.getElementById("aiUploadText");
  const resultsGrid = document.getElementById("aiGeneratedGrid");
  const resultsTitle = document.getElementById("aiResultsTitle");
  const resultsSubtitle = document.getElementById("aiResultsSubtitle");
  const generateButton = document.getElementById("generateAiCards");
  const generateAgain = document.getElementById("generateAiAgain");
  const useSelected = document.getElementById("aiUseSelected");
  const customizeSelected = document.getElementById("aiCustomizeSelected");
  const closeStudio = document.getElementById("closeAiStudio");
  const demoNote = document.getElementById("aiDemoNote");

  let selected = null;
  let photoUrl = "";
  let photoFile = null;
  let selectedConcept = null;
  let selectedStorageImageDataUrl = null;
  let generating = false;

  function selectedChip(groupId) {
    const chip = document.querySelector(`#${groupId} .ai-chip.active`);
    return chip ? chip.dataset.aiValue : "Friend";
  }

  function openStudio(name) {
    hub.hidden = true;
    studio.hidden = false;
    aiName.value = name || window.__birthdayCurrentName || "";
    resultsGrid.innerHTML = `<div class="ai-empty-results"><div>✨</div><strong>Ready to create something unique</strong><span>Tell AI about the person — and optionally add a photo.</span></div>`;
    resultsTitle.textContent = "Your unique AI card will appear here";
    resultsSubtitle.textContent = "Give AI a few details and it will create a personalized birthday artwork.";
    selected = null;
    selectedConcept = null;
    useSelected.disabled = true;
    customizeSelected.disabled = true;
    studio.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function setGeneratingState(isGenerating) {
    generating = isGenerating;
    generateButton.disabled = isGenerating;
    generateAgain.disabled = isGenerating;
    generateButton.textContent = isGenerating ? "⏳ Creating Your AI Card..." : "✨ Generate My AI Card";
    generateAgain.textContent = isGenerating ? "⏳ Generating..." : "↻ Generate New";
  }

  function showLoading() {
    resultsTitle.textContent = "Creating your personalized birthday artwork…";
    resultsSubtitle.textContent = "AI is turning the details you provided into a real birthday card. This can take a few seconds.";
    resultsGrid.innerHTML = `
      <div class="ai-generating-state">
        <div class="ai-generating-orb">✨</div>
        <strong>Generating your card</strong>
        <span>Creating a unique birthday artwork with GPT Image.</span>
        <div class="ai-generating-dots" aria-hidden="true"><i></i><i></i><i></i></div>
      </div>`;
    useSelected.disabled = true;
    customizeSelected.disabled = true;
  }

  function showError(message) {
    resultsTitle.textContent = "We couldn't create the card";
    resultsSubtitle.textContent = "Check the details and try again.";
    resultsGrid.innerHTML = `
      <div class="ai-empty-results ai-error-results">
        <div>⚠️</div>
        <strong>AI generation failed</strong>
        <span>${escapeHtml(message)}</span>
      </div>`;
    useSelected.disabled = true;
    customizeSelected.disabled = true;
  }

  async function compressImageForStorage(dataUrl) {
    try {
      const image = new Image();
      image.src = dataUrl;
      await new Promise((resolve, reject) => { image.onload = resolve; image.onerror = reject; });
      const maxWidth = 900;
      const scale = Math.min(1, maxWidth / image.naturalWidth);
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(image.naturalWidth * scale);
      canvas.height = Math.round(image.naturalHeight * scale);
      const ctx = canvas.getContext("2d", { alpha: false });
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL("image/jpeg", 0.84);
    } catch (_) {
      return dataUrl;
    }
  }

  function renderGeneratedImage(dataUrl, details) {
    const name = (details.name || "Birthday Star").trim();
    selectedConcept = {
      id: `ai-generated-${Date.now()}`,
      title: name,
      relationship: details.relationship,
      mood: details.mood,
      subtitle: details.interests || "birthday celebration",
      notes: details.details || "",
      photo: photoUrl,
      imageDataUrl: dataUrl,
      storageImageDataUrl: null
    };
    selected = selectedConcept;
    selectedStorageImageDataUrl = dataUrl;
    compressImageForStorage(dataUrl).then(compressed => {
      selectedStorageImageDataUrl = compressed;
      selectedConcept.storageImageDataUrl = compressed;
      if (window.__birthdayAIImageDataUrl === dataUrl) window.__birthdayAIStorageImageDataUrl = compressed;
    });

    resultsTitle.textContent = `Your AI birthday card for ${name}`;
    resultsSubtitle.textContent = "A real AI-generated artwork based on the details you entered.";
    resultsGrid.innerHTML = `
      <button type="button" class="ai-generated-image-card selected" id="aiGeneratedImageCard" aria-label="Select generated birthday card">
        <img src="${dataUrl}" alt="AI-generated birthday card for ${escapeHtml(name)}">
        <span class="ai-generated-badge">✨ AI GENERATED</span>
        <span class="ai-generated-check">✓</span>
      </button>`;

    document.getElementById("aiGeneratedImageCard")?.addEventListener("click", () => {
      selected = selectedConcept;
      document.getElementById("aiGeneratedImageCard")?.classList.add("selected");
      useSelected.disabled = false;
      customizeSelected.disabled = false;
    });

    useSelected.disabled = false;
    customizeSelected.disabled = false;
  }

  async function blobToDataUrl(blob) {
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error("Could not prepare the generated image."));
      reader.readAsDataURL(blob);
    });
  }

  async function generate() {
    if (generating) return;

    const name = (aiName.value || "").trim();
    if (!name) {
      aiName.focus();
      resultsTitle.textContent = "Add the birthday person's name first";
      resultsSubtitle.textContent = "The name is used to personalize the generated artwork.";
      return;
    }

    const userDetails = (aiNotes.value || "").trim();
    const germanDefaultMessage = `🎂 Alles Gute zum Geburtstag, ${name}! Ich wünsche dir einen wunderschönen Tag voller Freude, Glück und schöner Momente! 🎉`;
    const payload = {
      name,
      relationship: selectedChip("aiRelationshipChoices"),
      mood: selectedChip("aiMoodChoices"),
      interests: (aiInterest.value || "").trim(),
      details: `${userDetails}${userDetails ? "\n\n" : ""}LANGUAGE REQUIREMENT: Create the birthday card artwork and all visible text in natural German, even if the information above is written in English. Use this German birthday message as the main/default greeting: "${germanDefaultMessage}"`.trim()
    };

    setGeneratingState(true);
    showLoading();
    console.log("[Birthday Assistant] AI generation request", payload);

    try {
      const response = await fetch(AI_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const contentType = response.headers.get("content-type") || "";
      if (!response.ok) {
        let detail = `HTTP ${response.status}`;
        try {
          const text = await response.text();
          if (text) detail += ` — ${text.slice(0, 180)}`;
        } catch (_) {}
        throw new Error(detail);
      }

      const blob = await response.blob();
      if (!blob.type.startsWith("image/")) {
        throw new Error(`Expected an image response, received ${contentType || blob.type || "unknown content"}.`);
      }

      const dataUrl = await blobToDataUrl(blob);
      renderGeneratedImage(dataUrl, payload);
      if (demoNote) demoNote.textContent = "Real AI generation is connected. Each generation uses OpenAI API credit.";
      console.log("[Birthday Assistant] AI image received", { type: blob.type, size: blob.size });
    } catch (error) {
      console.error("AI generation failed:", error);
      showError(error?.message || "Please try again.");
    } finally {
      setGeneratingState(false);
    }
  }

  document.querySelectorAll("#aiRelationshipChoices .ai-chip, #aiMoodChoices .ai-chip").forEach(chip => {
    chip.addEventListener("click", () => {
      const parent = chip.parentElement;
      parent.querySelectorAll(".ai-chip").forEach(x => x.classList.remove("active"));
      chip.classList.add("active");
    });
  });

  photoInput?.addEventListener("change", () => {
    const file = photoInput.files && photoInput.files[0];
    if (!file) return;
    photoFile = file;
    if (photoUrl) URL.revokeObjectURL(photoUrl);
    photoUrl = URL.createObjectURL(file);
    uploadPreview.innerHTML = `<img src="${photoUrl}" alt="Selected photo">`;
    uploadText.textContent = file.name.length > 28 ? file.name.slice(0,25) + "…" : file.name;
    if (demoNote) demoNote.textContent = "Photo selected. Text-based AI generation is connected; photo-aware generation is the next backend enhancement.";
  });

  generateButton?.addEventListener("click", generate);
  generateAgain?.addEventListener("click", generate);

  async function saveGeneratedCardDirectly() {
    if (!selectedConcept || !selectedConcept.imageDataUrl) return;

    const name = (selectedConcept.title || aiName.value || "Birthday").trim() || "Birthday";
    const message = `🎂 Alles Gute zum Geburtstag, ${name}! Ich wünsche dir einen wunderschönen Tag voller Freude, Glück und schöner Momente! 🎉`;

    let imageData = selectedStorageImageDataUrl || selectedConcept.storageImageDataUrl;
    if (!imageData) {
      imageData = await compressImageForStorage(selectedConcept.imageDataUrl);
    }

    const existing = typeof readSavedCards === "function" ? readSavedCards() : [];
    const saved = {
      id: `card-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      personName: name,
      message,
      theme: "celebration",
      aiImageDataUrl: imageData,
      createdAt: Date.now()
    };

    if (typeof writeSavedCards === "function") {
      writeSavedCards([saved, ...existing]);
    }
    if (typeof renderSavedCards === "function") {
      renderSavedCards();
    }

    useSelected.disabled = true;
    useSelected.textContent = "✅ Saved!";
    setTimeout(() => {
      studio.hidden = true;
      hub.hidden = false;
      if (typeof setMyCardsExpanded === "function") {
        setMyCardsExpanded(true, { scroll: true });
      } else {
        document.getElementById("myCardsCard")?.scrollIntoView({ behavior: "smooth", block: "start" });
      }
      useSelected.textContent = "💾 Save Card";
      useSelected.disabled = false;
    }, 650);
  }

  function goToEditor() {
    if (!selectedConcept?.imageDataUrl) return;

    const name = selectedConcept.title || "Birthday";
    const message = `🎂 Alles Gute zum Geburtstag, ${name}! Ich wünsche dir einen wunderschönen Tag voller Freude, Glück und schöner Momente! 🎉`;
    studio.hidden = true;

    const editor = document.getElementById("cardEditor");
    const nameInput = document.getElementById("cardName");
    const messageInput = document.getElementById("cardMessage");
    if (nameInput) nameInput.value = name;
    if (messageInput) messageInput.value = message;

    window.__birthdayAIImageDataUrl = selectedConcept.imageDataUrl;
    window.__birthdayAIStorageImageDataUrl = selectedConcept.storageImageDataUrl || selectedStorageImageDataUrl || selectedConcept.imageDataUrl;
    window.__birthdayAIImageMeta = {
      name,
      relationship: selectedConcept.relationship,
      mood: selectedConcept.mood,
      interests: selectedConcept.subtitle,
      details: selectedConcept.notes
    };

    if (window.BirthdayAssistantV151?.openAIEditor) {
      window.BirthdayAssistantV151.openAIEditor(name, selectedConcept.imageDataUrl, message);
    } else if (window.BirthdayAssistantV151?.openEditor) {
      window.BirthdayAssistantV151.openEditor(name);
    } else {
      editor.hidden = false;
      editor.scrollIntoView({ behavior:"smooth", block:"start" });
    }
  }

  useSelected?.addEventListener("click", saveGeneratedCardDirectly);
  customizeSelected?.addEventListener("click", goToEditor);

  closeStudio?.addEventListener("click", () => {
    if (generating) return;
    studio.hidden = true;
    hub.hidden = false;
    hub.scrollIntoView({ behavior:"smooth", block:"start" });
  });

  // Connect the creation hub's "Use AI" option to the real AI Studio.
  // This must be wired explicitly because the shared creation-button handler
  // intentionally does not navigate for the AI method.
  const aiHubButton = document.querySelector('[data-creation-method="ai"]');
  aiHubButton?.addEventListener("click", event => {
    event.preventDefault();
    event.stopPropagation();
    openStudio(window.__birthdayCurrentName || "");
  });

  window.BirthdayAIStudio = { open: openStudio, generate };
})();

