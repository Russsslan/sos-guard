// 📦 Constants & DB Setup
const DB_NAME = "SOSGuardDB";
const DB_VER = 1;
const STORE = { contacts: "contacts", places: "places", bank: "bank", meta: "meta" };

// 🔹 IndexedDB Wrapper (открывается 1 раз)
let dbPromise = null;
const getDB = () => dbPromise || (dbPromise = new Promise((resolve, reject) => {
  const req = indexedDB.open(DB_NAME, DB_VER);
  req.onupgradeneeded = (e) => {
    const db = e.target.result;
    if (!db.objectStoreNames.contains(STORE.contacts)) db.createObjectStore(STORE.contacts, { keyPath: "id" });
    if (!db.objectStoreNames.contains(STORE.places)) db.createObjectStore(STORE.places, { keyPath: "id" });
    if (!db.objectStoreNames.contains(STORE.bank)) db.createObjectStore(STORE.bank, { keyPath: "id" });
    if (!db.objectStoreNames.contains(STORE.meta)) db.createObjectStore(STORE.meta, { keyPath: "key" });
  };
  req.onsuccess = () => resolve(req.result);
  req.onerror = () => reject(req.error);
}));

const db = {
  get: (s, k) => getDB().then(d => new Promise((res, rej) => {
    const r = d.transaction(s, "readonly").objectStore(s).get(k);
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  })).catch(() => null),
  getAll: (s) => getDB().then(d => new Promise((res, rej) => {
    const r = d.transaction(s, "readonly").objectStore(s).getAll();
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  })).catch(() => []),
  put: (s, v) => getDB().then(d => new Promise((res, rej) => {
    const r = d.transaction(s, "readwrite").objectStore(s).put(v);
    r.onsuccess = () => res(); r.onerror = () => rej(r.error);
  })).catch(() => null),
  delete: (s, k) => getDB().then(d => new Promise((res, rej) => {
    const r = d.transaction(s, "readwrite").objectStore(s).delete(k);
    r.onsuccess = () => res(); r.onerror = () => rej(r.error);
  })).catch(() => null),
  clear: (s) => getDB().then(d => new Promise((res, rej) => {
    const r = d.transaction(s, "readwrite").objectStore(s).clear();
    r.onsuccess = () => res(); r.onerror = () => rej(r.error);
  })).catch(() => null)
};

// 🔐 Crypto & Utils
async function hashText(v) {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(v));
  return Array.from(new Uint8Array(b)).map(x => x.toString(16).padStart(2, "0")).join("");
}
async function deriveKey(pin, salt) {
  const km = await crypto.subtle.importKey("raw", new TextEncoder().encode(pin), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey({ name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" }, km, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}
async function encryptData(data, key) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(JSON.stringify(data)));
  return { iv: uint8ToBase64(iv), data: uint8ToBase64(new Uint8Array(ct)) };
}
async function decryptData(stored, key) {
  const iv = base64ToUint8(stored.iv);
  const ct = base64ToUint8(stored.data);
  const dec = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ct);
  return JSON.parse(new TextDecoder().decode(dec));
}
function uint8ToBase64(u8) { return btoa(String.fromCharCode(...u8)); }
function base64ToUint8(b64) { return Uint8Array.from(atob(b64), c => c.charCodeAt(0)); }

function toast(msg, type = "info") {
  const c = document.querySelector(".toast-container") || (() => { const e = document.createElement("div"); e.className = "toast-container"; document.body.appendChild(e); return e; })();
  const t = document.createElement("div"); t.className = `toast toast-${type}`; t.textContent = msg; c.appendChild(t);
  setTimeout(() => t.remove(), 3500);
}
function vibrate(pattern = [30]) { if (navigator.vibrate) navigator.vibrate(pattern); }
function escapeHtml(v) { return String(v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;"); }
function createId() { return window.crypto?.randomUUID?.() || `id_${Date.now()}_${Math.random().toString(16).slice(2)}`; }
function maskPhone(v) {
  let n = v.replace(/\D/g, "").slice(0, 11);
  if (!n) return "";
  let r = "+7";
  if (n.length > 1) r += ` (${n.slice(1, 4)}`;
  if (n.length > 4) r += `) ${n.slice(4, 7)}`;
  if (n.length > 7) r += `-${n.slice(7, 9)}`;
  if (n.length > 9) r += `-${n.slice(9, 11)}`;
  return r;
}
function maskExpiry(v) { let n = v.replace(/\D/g, "").slice(0, 4); return n.length > 2 ? `${n.slice(0, 2)}/${n.slice(2)}` : n; }

// 🌑 Splash & Network
function initSplash() { const s = document.getElementById("splashScreen"); if (s) setTimeout(() => s.classList.add("hidden"), 1000); }
function setupNetwork() {
  const el = document.getElementById("networkStatus"); if (!el) return;
  const u = () => {
    el.textContent = navigator.onLine ? "🌐 Сеть: доступна" : "📶 Сеть: оффлайн";
    el.className = `network-status ${navigator.onLine ? "online" : "offline"}`;
  };
  window.addEventListener("online", u); window.addEventListener("offline", u); u();
}

// 📑 Tabs
function setupTabs() {
  const nav = document.querySelectorAll(".nav-item[data-tab]"), scr = document.querySelectorAll(".tab-screen[data-tab-screen]");
  const act = t => {
    nav.forEach(n => n.classList.toggle("active", n.dataset.tab === t));
    scr.forEach(s => s.classList.toggle("active", s.dataset.tabScreen === t));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  nav.forEach(n => n.addEventListener("click", () => act(n.dataset.tab)));
}

// 👥 Contacts
function setupContacts() {
  const form = document.getElementById("contactForm"), nameIn = document.getElementById("contactName"), phoneIn = document.getElementById("contactPhone"), list = document.getElementById("contactList"), search = document.getElementById("contactSearch");
  if (!form || !list) return;
  let editId = null;
  const subBtn = form.querySelector('button[type="submit"]');

  const render = async () => {
    const data = await db.getAll(STORE.contacts);
    list.innerHTML = "";
    const q = (search?.value || "").toLowerCase();
    const filt = data.filter(c => c.name.toLowerCase().includes(q) || c.phone.includes(q)).sort((a, b) => (b.isFavorite ? 1 : 0) - (a.isFavorite ? 1 : 0));
    if (!filt.length) { list.innerHTML = `<li class="empty-item">Пока пусто</li>`; return; }
    filt.forEach(c => {
      const li = document.createElement("li");
      li.innerHTML = `
        <div class="item-head">
          <strong>${escapeHtml(c.name)}</strong>
          <div class="contact-actions">
            <button class="mini-btn favorite-btn" data-act="fav" data-id="${c.id}">${c.isFavorite ? "★" : "☆"}</button>
            <button class="mini-btn" data-act="edit" data-id="${c.id}">✏️</button>
            <button class="danger-btn mini-btn" data-act="del" data-id="${c.id}">🗑️</button>
          </div>
        </div>
        <a href="tel:${escapeHtml(c.phone)}">${escapeHtml(c.phone)}</a>`;
      list.appendChild(li);
    });
  };

  form.addEventListener("submit", async e => {
    e.preventDefault(); const n = nameIn.value.trim(), p = phoneIn.value.trim(); if (!n || !p) return; vibrate();
    if (editId) {
      const cur = await db.get(STORE.contacts, editId);
      await db.put(STORE.contacts, { ...cur, name: n, phone: p, updatedAt: Date.now() });
      editId = null; if (subBtn) subBtn.textContent = "➕ Сохранить";
    } else {
      await db.put(STORE.contacts, { id: createId(), name: n, phone: p, isFavorite: false, updatedAt: Date.now() });
    }
    form.reset(); render(); toast("✅ Контакт сохранён", "success");
  });

  list.addEventListener("click", async e => {
    const btn = e.target.closest("button[data-act]"); if (!btn) return; vibrate();
    const id = btn.dataset.id, act = btn.dataset.act;
    if (act === "del") { await db.delete(STORE.contacts, id); if (editId === id) { editId = null; form.reset(); if (subBtn) subBtn.textContent = "➕ Сохранить"; } toast("🗑️ Удалено"); }
    else if (act === "fav") { const c = await db.get(STORE.contacts, id); c.isFavorite = !c.isFavorite; await db.put(STORE.contacts, c); toast("⭐ Обновлено"); }
    else if (act === "edit") { const c = await db.get(STORE.contacts, id); editId = c.id; nameIn.value = c.name; phoneIn.value = c.phone; if (subBtn) subBtn.textContent = "✏️ Обновить"; nameIn.focus(); }
    render();
  });

  search?.addEventListener("input", render);
  phoneIn.addEventListener("input", e => { e.target.value = maskPhone(e.target.value); });
  render();
}

// 🗺️ Map
function setupMap() {
  const form = document.getElementById("placeForm"), titleIn = document.getElementById("placeTitle"), addrIn = document.getElementById("placeAddress"), list = document.getElementById("placeList"), detBtn = document.getElementById("detectMapLocationBtn"), txt = document.getElementById("mapLocationText"), mapsBtn = document.getElementById("openDeviceMapsBtn");
  if (!form || !list || !detBtn) return;
  let mapState = null;

  const render = async () => {
    const data = (await db.getAll(STORE.places)).filter(x => x.id !== "mapState");
    list.innerHTML = data.length ? "" : `<li class="empty-item">Пока пусто</li>`;
    data.forEach(p => {
      const li = document.createElement("li");
      li.innerHTML = `<div class="item-head"><strong>${escapeHtml(p.title)}</strong><button class="danger-btn mini-btn" data-id="${p.id}">🗑️</button></div><div class="muted">${escapeHtml(p.address)}</div>`;
      li.querySelector("button").addEventListener("click", async () => { vibrate(); await db.delete(STORE.places, p.id); render(); toast("🗑️ Удалено"); });
      list.appendChild(li);
    });
  };

  const updatePreview = () => {
    if (!mapState) { txt.textContent = "Координаты: не получены"; mapsBtn.disabled = true; return; }
    txt.textContent = `${mapState.lat.toFixed(6)}, ${mapState.lon.toFixed(6)}`;
    mapsBtn.disabled = false;
  };

  detBtn.addEventListener("click", () => {
    if (!navigator.geolocation) { txt.textContent = "Не поддерживается"; return; }
    detBtn.disabled = true; detBtn.textContent = "⏳...";
    navigator.geolocation.getCurrentPosition(p => {
      mapState = { id: "mapState", lat: p.coords.latitude, lon: p.coords.longitude, updatedAt: Date.now() };
      db.put(STORE.places, mapState); updatePreview(); detBtn.disabled = false; detBtn.textContent = "📡 Обновить"; vibrate(); toast("📍 Координаты получены", "success");
    }, () => { detBtn.disabled = false; detBtn.textContent = "📡 Определить"; toast("⚠️ Ошибка GPS", "error"); }, { enableHighAccuracy: true, timeout: 10000 });
  });

  mapsBtn?.addEventListener("click", () => {
    if (mapState) window.open(`https://maps.google.com/?q=${mapState.lat.toFixed(6)},${mapState.lon.toFixed(6)}`, "_blank");
  });

  form.addEventListener("submit", async e => {
    e.preventDefault(); const t = titleIn.value.trim(), a = addrIn.value.trim(); if (!t || !a) return; vibrate();
    await db.put(STORE.places, { id: createId(), title: t, address: a }); form.reset(); render(); toast("📍 Точка сохранена", "success");
  });

  db.get(STORE.places, "mapState").then(res => { if (res) { mapState = res; updatePreview(); } });
  render();
}

// 🏦 Bank
function setupBank() {
  const pinF = document.getElementById("bankPinForm"), pinIn = document.getElementById("bankPinInput"), hint = document.getElementById("bankHint"), lockW = document.getElementById("bankLock"), vault = document.getElementById("bankContent"), form = document.getElementById("bankCardForm"), list = document.getElementById("bankCardList"), lockB = document.getElementById("lockBankBtn");
  if (!pinF || !vault || !list) return;
  let cards = [], key = null, unlocked = false, lockTimer = null;
  const AUTO_LOCK_MS = 3 * 60 * 1000;
  const resetTimer = () => { if (unlocked) { clearTimeout(lockTimer); lockTimer = setTimeout(autoLock, AUTO_LOCK_MS); } };
  const autoLock = () => { if (unlocked) { unlocked = false; cards = []; key = null; vault.classList.add("hidden"); lockW.classList.remove("hidden"); pinIn.value = ""; hint.textContent = "🔒 Сессия закрыта (3 мин)"; toast("🔒 Раздел заблокирован", "info"); } };
  ["click", "keydown", "touchstart"].forEach(evt => document.addEventListener(evt, resetTimer, { passive: true }));

  const render = () => {
    list.innerHTML = ""; resetTimer();
    if (!cards.length) { list.innerHTML = `<li class="empty-item">Список пуст</li>`; return; }
    cards.forEach(c => {
      const li = document.createElement("li");
      const numMask = c.number.length < 4 ? c.number : `•••• •••• •••• ${c.number.slice(-4)}`;
      li.innerHTML = `
        <div class="bank-card-head">
          <div><strong>${escapeHtml(c.bankName || "Без названия")}</strong><div class="muted">${escapeHtml(c.product || "")}</div></div>
          <button class="danger-btn mini-btn" data-id="${c.id}">🗑️</button>
        </div>
        <div class="muted">Номер: ${escapeHtml(numMask)}</div>
        <details><summary>Показать данные</summary><div class="bank-details">
          <div>Номер: ${escapeHtml(c.number)}</div><div>Держатель: ${escapeHtml(c.holder)}</div><div>Срок: ${escapeHtml(c.expiry)}</div><div>CVV: ${escapeHtml(c.cvv)}</div>
          ${c.bankPhone ? `<a href="tel:${escapeHtml(c.bankPhone)}">${escapeHtml(c.bankPhone)}</a>` : ""}
          ${c.note ? `<div style="margin-top:4px;">${escapeHtml(c.note)}</div>` : ""}
        </div></details>`;
      li.querySelector("button").addEventListener("click", async () => { vibrate(); cards = cards.filter(x => x.id !== c.id); await db.put(STORE.bank, { id: "vault", value: await encryptData(cards, key) }); render(); toast("🗑️ Удалено"); });
      list.appendChild(li);
    });
  };

  pinF.addEventListener("submit", async e => {
    e.preventDefault(); const pin = pinIn.value.trim(); if (pin.length < 4) { hint.textContent = "⚠️ Мин. 4 символа"; return; }
    const hash = await hashText(pin); const meta = await db.get(STORE.meta, "pin");
    if (!meta) {
      const salt = crypto.getRandomValues(new Uint8Array(16)); key = await deriveKey(pin, salt);
      await db.put(STORE.meta, { key: "salt", value: uint8ToBase64(salt) });
      await db.put(STORE.meta, { key: "pin", value: hash });
      await db.put(STORE.bank, { id: "vault", value: await encryptData([], key) });
      unlocked = true; vault.classList.remove("hidden"); lockW.classList.add("hidden"); hint.textContent = "🔑 PIN создан. Данные шифруются."; resetTimer(); toast("✅ Раздел открыт", "success"); render(); return;
    }
    if (meta.value === hash) {
      const salt = base64ToUint8((await db.get(STORE.meta, "salt")).value);
      key = await deriveKey(pin, salt); const enc = await db.get(STORE.bank, "vault");
      cards = enc ? await decryptData(enc.value, key) : [];
      unlocked = true; vault.classList.remove("hidden"); lockW.classList.add("hidden"); hint.textContent = "✅ Открыто. Авт. блокировка через 3 мин."; resetTimer(); toast("✅ Раздел разблокирован", "success"); render();
    } else { hint.textContent = "❌ Неверный PIN."; toast("❌ Ошибка PIN", "error"); }
  });

  form.addEventListener("submit", async e => {
    e.preventDefault(); if (!unlocked) return; vibrate();
    cards.unshift({ id: createId(), bankName: document.getElementById("bankName").value.trim(), product: document.getElementById("cardProduct").value.trim(), network: document.getElementById("cardNetwork").value, number: document.getElementById("cardNumber").value.replace(/\D/g,""), holder: document.getElementById("cardHolder").value.trim(), expiry: document.getElementById("cardExpiry").value.trim(), cvv: document.getElementById("cardCvv").value.trim(), bankPhone: document.getElementById("bankPhone").value.trim(), note: document.getElementById("cardNote").value.trim() });
    await db.put(STORE.bank, { id: "vault", value: await encryptData(cards, key) }); form.reset(); render(); toast("💳 Карта сохранена", "success");
  });
  lockB.addEventListener("click", () => { clearTimeout(lockTimer); autoLock(); });
  document.getElementById("cardNumber").addEventListener("input", e => { e.target.value = e.target.value.replace(/\D/g, "").replace(/(.{4})/g, "$1 ").trim().slice(0, 19); });
  document.getElementById("cardExpiry").addEventListener("input", e => { e.target.value = maskExpiry(e.target.value); });
  vault.classList.add("hidden");
}

// ⚙️ Settings
function setupSettings() {
  document.getElementById("btnExport")?.addEventListener("click", async () => {
    try {
      const data = { contacts: await db.getAll(STORE.contacts), places: await db.getAll(STORE.places), bank: await db.getAll(STORE.bank), meta: await db.getAll(STORE.meta), exportedAt: Date.now() };
      const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" })); a.download = `sosguard_backup_${new Date().toISOString().slice(0,10)}.json`; a.click(); vibrate(); toast("📥 Бэкап скачан", "success");
    } catch (e) { toast("❌ Ошибка экспорта", "error"); }
  });

  document.getElementById("btnImport")?.addEventListener("change", async e => {
    const file = e.target.files[0]; if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      for (const s of Object.values(STORE)) await db.clear(s);
      if (data.contacts) for (const i of data.contacts) await db.put(STORE.contacts, i);
      if (data.places) for (const i of data.places) await db.put(STORE.places, i);
      if (data.bank) for (const i of data.bank) await db.put(STORE.bank, i);
      if (data.meta) for (const i of data.meta) await db.put(STORE.meta, i);
      vibrate(); toast("✅ Данные восстановлены", "success"); setTimeout(() => window.location.reload(), 800);
    } catch (e) { toast("❌ Ошибка файла", "error"); }
    e.target.value = "";
  });

  document.getElementById("btnReset")?.addEventListener("click", async () => {
    if (!confirm("Удалить ВСЕ данные? Это действие нельзя отменить.")) return;
    for (const s of Object.values(STORE)) await db.clear(s); vibrate(); toast("🗑️ Данные сброшены", "success"); setTimeout(() => window.location.reload(), 800);
  });

  document.getElementById("btnExportVcf")?.addEventListener("click", async () => {
    const data = await db.getAll(STORE.contacts); if (!data.length) { toast("Контакты пусты", "error"); return; }
    let vcf = "BEGIN:VCARD\nVERSION:3.0\nPRODID:-//SOSGuard//RU\n";
    data.forEach(c => { vcf += `FN:${c.name}\nTEL;TYPE=CELL:${c.phone}\nEND:VCARD\n`; });
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([vcf], { type: "text/vcard" })); a.download = `sosguard_contacts.vcf`; a.click(); vibrate(); toast("📇 Экспорт .vcf готов", "success");
  });

  const pinBlock = document.getElementById("pinChangeBlock"), showBtn = document.getElementById("btnShowPinChange"), cancelBtn = document.getElementById("btnCancelPin"), hint = document.getElementById("pinHint");
  if (showBtn && cancelBtn && pinBlock) {
    showBtn.addEventListener("click", () => { pinBlock.style.display = "block"; hint.textContent = ""; });
    cancelBtn.addEventListener("click", () => { pinBlock.style.display = "none"; hint.textContent = ""; });
  }
  document.getElementById("btnApplyPin")?.addEventListener("click", async () => {
    const oldP = document.getElementById("oldPinInput").value.trim(), newP = document.getElementById("newPinInput").value.trim();
    if (!oldP || newP.length < 4) { hint.textContent = "⚠️ Введи текущий и новый PIN (мин. 4)"; return; }
    try {
      const meta = await db.get(STORE.meta, "pin"); if (!meta) { hint.textContent = "🔑 PIN ещё не задан."; return; }
      if (meta.value !== await hashText(oldP)) { hint.textContent = "❌ Неверный текущий PIN"; return; }
      const salt = base64ToUint8((await db.get(STORE.meta, "salt")).value);
      const enc = await db.get(STORE.bank, "vault");
      if (enc && enc.value) {
        const oldKey = await deriveKey(oldP, salt); const data = await decryptData(enc.value, oldKey);
        const newKey = await deriveKey(newP, salt);
        await db.put(STORE.bank, { id: "vault", value: await encryptData(data, newKey) });
      }
      await db.put(STORE.meta, { key: "pin", value: await hashText(newP) });
      hint.textContent = "✅ PIN успешно изменён"; vibrate(); toast("🔑 PIN обновлён", "success");
      setTimeout(() => { pinBlock.style.display = "none"; hint.textContent = ""; }, 1500);
    } catch (e) { hint.textContent = "❌ Ошибка: " + e.message; }
  });

  let prompt = null;
  window.addEventListener("beforeinstallprompt", e => { e.preventDefault(); prompt = e; document.getElementById("btnInstall")?.classList.remove("hidden"); });
  document.getElementById("btnInstall")?.addEventListener("click", async () => { if (prompt) { prompt.prompt(); prompt = null; } });
}

// 🆘 SOS Logic (FIXED & ROBUST)
function setupSOS() {
  const sosBtn = document.querySelector('.sos-call-grid .emergency-main') || document.getElementById('sosBtn');
  if (!sosBtn) return;

  sosBtn.addEventListener('click', async () => {
    vibrate([100, 50, 100]);
    toast('📡 Получаю координаты...', 'warning');

    try {
      // 1. Get Coordinates
      const coords = await new Promise((resolve, reject) => {
        if (!navigator.geolocation) { reject('GPS не поддерживается'); return; }
        navigator.geolocation.getCurrentPosition(
          pos => resolve(`${pos.coords.latitude.toFixed(6)}, ${pos.coords.longitude.toFixed(6)}`),
          () => reject('Ошибка GPS или отказ в правах'),
          { enableHighAccuracy: true, timeout: 8000 }
        );
      });

      // 2. Get Favorite Contacts
      const contacts = await db.getAll(STORE.contacts);
      const favorites = contacts.filter(c => c.isFavorite);
      const phones = favorites.map(c => c.phone.replace(/\D/g, '')).filter(Boolean);

      // 3. Form Message
      const msg = `🆘 SOS! Я в опасности!\nКоординаты: ${coords}\nСрочно помогите!`;

      // 4. Open SMS App (Cross-platform fix)
      if (phones.length > 0) {
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
        const separator = isIOS ? '&' : '?';
        const uri = `sms:${phones.join(',')}${separator}body=${encodeURIComponent(msg)}`;
        window.location.href = uri;
      } else {
        window.location.href = `sms:?body=${encodeURIComponent(msg)}`;
        toast('⚠️ Добавь избранные контакты (★) для быстрой отправки!', 'warning');
      }
    } catch (err) {
      console.error('SOS Error:', err);
      toast('❌ Не удалось открыть SMS. Скопируйте координаты вручную.', 'error');
    }
  });
}

// 🌐 Init
document.addEventListener("DOMContentLoaded", () => {
  initSplash();
  setupNetwork();
  setupTabs();
  setupContacts();
  setupMap();
  setupBank();
  setupSettings();
  setupSOS(); // 🔴 Критичная фиксация кнопки SOS

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(console.error));
  }
});
