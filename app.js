const DB_NAME = "SOSGuardDB";
const DB_VER = 1;
const STORE = { contacts: "contacts", places: "places", meta: "meta" };

// 🔹 Кэшированное IndexedDB (открывается 1 раз)
let dbPromise = null;
const getDB = () => dbPromise || (dbPromise = new Promise((res, rej) => {
  const req = indexedDB.open(DB_NAME, DB_VER);
  req.onupgradeneeded = e => {
    const d = e.target.result;
    if (!d.objectStoreNames.contains(STORE.contacts)) d.createObjectStore(STORE.contacts, { keyPath: "id" });
    if (!d.objectStoreNames.contains(STORE.places)) d.createObjectStore(STORE.places, { keyPath: "id" });
    if (!d.objectStoreNames.contains(STORE.meta)) d.createObjectStore(STORE.meta, { keyPath: "key" });
  };
  req.onsuccess = () => res(req.result);
  req.onerror = () => rej(req.error);
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

// 🛠️ Utils
function toast(msg, type = "info") {
  const c = document.querySelector(".toast-container") || (() => { const e = document.createElement("div"); e.className = "toast-container"; document.body.appendChild(e); return e; })();
  const t = document.createElement("div"); t.className = `toast toast-${type}`; t.textContent = msg; c.appendChild(t);
  setTimeout(() => t.remove(), 3500);
}
function vibrate(pattern = [30]) { if (navigator.vibrate) navigator.vibrate(pattern); }
function escapeHtml(v) { return String(v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
function createId() { return window.crypto?.randomUUID?.() || `id_${Date.now()}_${Math.random().toString(16).slice(2)}`; }
function maskPhone(v) { let n = v.replace(/\D/g, "").slice(0, 11); let r = "+7"; if (n.length > 1) r += ` (${n.slice(1, 4)}`; if (n.length > 4) r += `) ${n.slice(4, 7)}`; if (n.length > 7) r += `-${n.slice(7, 9)}`; if (n.length > 9) r += `-${n.slice(9, 11)}`; return r; }
const getCoords = () => new Promise(res => {
  if (!navigator.geolocation) { res(null); return; }
  navigator.geolocation.getCurrentPosition(p => res(p.coords), () => res(null), { enableHighAccuracy: true, timeout: 8000 });
});

// 🌐 Network
function setupNetwork() {
  const el = document.getElementById("networkStatus"); if (!el) return;
  const u = () => { el.textContent = navigator.onLine ? "🌐 Сеть: доступна" : "📶 Оффлайн"; el.style.borderColor = navigator.onLine ? "#22c55e" : "#ef4444"; el.style.color = navigator.onLine ? "#22c55e" : "#ef4444"; };
  window.addEventListener("online", u); window.addEventListener("offline", u); u();
}

// 📑 Tabs
function setupTabs() {
  const nav = document.querySelectorAll(".nav-item[data-tab]"), scr = document.querySelectorAll(".tab-screen[data-tab-screen]");
  const act = t => { nav.forEach(n => n.classList.toggle("active", n.dataset.tab === t)); scr.forEach(s => s.classList.toggle("active", s.dataset.tabScreen === t)); window.scrollTo({ top: 0, behavior: "smooth" }); };
  nav.forEach(n => n.addEventListener("click", () => act(n.dataset.tab)));
}

// 🆘 SOS Logic
let currentCoords = null;
function setupSOS() {
  const btn = document.getElementById("sosBtn");
  const coordsEl = document.getElementById("sosCoords");
  const copyBtn = document.getElementById("copyCoordsBtn");
  const vibBtn = document.getElementById("vibrateSOSBtn");

  const updateCoords = async () => {
    currentCoords = await getCoords();
    if (currentCoords) coordsEl.textContent = `📍 ${currentCoords.latitude.toFixed(6)}, ${currentCoords.longitude.toFixed(6)}`;
    else coordsEl.textContent = "⚠️ GPS недоступен";
  };

  btn.addEventListener("click", async () => {
    vibrate([100, 50, 100]);
    toast("📡 Готовлю сообщение...", "warning");
    
    const fresh = await getCoords();
    if (fresh) currentCoords = fresh;
    const c = currentCoords;
    const lat = c?.latitude?.toFixed(6) || "Н/Д";
    const lon = c?.longitude?.toFixed(6) || "Н/Д";
    const msg = `🆘 SOS! Я в опасности. Координаты: ${lat}, ${lon}. Срочно помогите!`;
    
    // Берем контакты из приложения
    const contacts = await db.getAll(STORE.contacts);
    const phones = contacts.map(x => x.phone.replace(/\D/g, "")).filter(Boolean);
    
    // Формируем URI. Если контактов в приложении нет, откроется пустое SMS,
    // где пользователь сможет выбрать контакты из телефонной книги вручную.
    const sep = /iPad|iPhone|iPod/.test(navigator.userAgent) ? '&' : '?';
    const target = phones.length > 0 ? phones.join(',') : '';
    const uri = `sms:${target}${sep}body=${encodeURIComponent(msg)}`;
    
    const a = document.createElement('a');
    a.href = uri; a.style.display = 'none';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    toast("📱 Открываю сообщения...", "success");
  });

  copyBtn.addEventListener("click", async () => {
    await updateCoords();
    const text = currentCoords ? `${currentCoords.latitude.toFixed(6)}, ${currentCoords.longitude.toFixed(6)}` : coordsEl.textContent;
    if (navigator.clipboard) { await navigator.clipboard.writeText(text); vibrate(20); toast("📋 Скопировано", "success"); }
  });

  vibBtn.addEventListener("click", () => { vibrate([200, 100, 200, 100, 600]); toast("📳 Сигнал SOS", "warning"); });
  setInterval(updateCoords, 120000);
  updateCoords();
}

// 👥 Contacts
function setupContacts() {
  const form = document.getElementById("contactForm"), nameIn = document.getElementById("contactName"), phoneIn = document.getElementById("contactPhone"), list = document.getElementById("contactList");
  if (!form || !list) return;
  let editId = null;

  const render = async () => {
    const data = await db.getAll(STORE.contacts);
    list.innerHTML = "";
    if (!data.length) { list.innerHTML = `<li class="muted" style="text-align:center;">Пока пусто. Добавьте контакты для SOS.</li>`; return; }
    data.sort((a,b) => b.updatedAt - a.updatedAt).forEach(c => {
      const li = document.createElement("li");
      li.innerHTML = `
        <div class="item-head">
          <strong>${escapeHtml(c.name)}</strong>
          <div style="display:flex;gap:4px;">
            <button class="mini-btn ghost" onclick="window.location.href='tel:${escapeHtml(c.phone)}'">📞</button>
            <button class="mini-btn primary" data-act="sms" data-phone="${escapeHtml(c.phone)}">💬</button>
            <button class="mini-btn" data-act="edit" data-id="${c.id}">✏️</button>
            <button class="mini-btn danger" data-act="del" data-id="${c.id}">🗑️</button>
          </div>
        </div>
        <div class="muted">${escapeHtml(c.phone)}</div>`;
      list.appendChild(li);
    });
  };

  form.addEventListener("submit", async e => {
    e.preventDefault(); const n = nameIn.value.trim(), p = phoneIn.value.trim(); if (!n || !p) return; vibrate(30);
    const obj = { id: editId || createId(), name: n, phone: p, updatedAt: Date.now() };
    await db.put(STORE.contacts, obj); editId = null; form.reset(); render(); toast("✅ Контакт сохранён", "success");
  });

  list.addEventListener("click", async e => {
    const btn = e.target.closest("button[data-act]"); if (!btn) return; vibrate(30);
    const id = btn.dataset.id, act = btn.dataset.act;
    if (act === "del") { await db.delete(STORE.contacts, id); render(); toast("🗑️ Удалено"); }
    else if (act === "edit") { const c = await db.get(STORE.contacts, id); editId = c.id; nameIn.value = c.name; phoneIn.value = c.phone; form.querySelector("button").textContent = "✏️ Обновить"; nameIn.focus(); }
    else if (act === "sms") { window.location.href = `sms:${btn.dataset.phone}?body=Срочно перезвони мне!`; }
  });
  phoneIn.addEventListener("input", e => { e.target.value = maskPhone(e.target.value); });
  render();
}

// 🗺️ Map
function setupMap() {
  const form = document.getElementById("placeForm"), titleIn = document.getElementById("placeTitle"), addrIn = document.getElementById("placeAddress"), list = document.getElementById("placeList"), detBtn = document.getElementById("detectBtn"), mapsBtn = document.getElementById("openMapsBtn");
  if (!form || !list || !detBtn) return;
  let mapState = null;

  const render = async () => {
    const data = (await db.getAll(STORE.places)).filter(x => x.id !== "mapState");
    list.innerHTML = data.length ? "" : `<li class="muted" style="text-align:center;">Пока пусто</li>`;
    data.forEach(p => {
      const li = document.createElement("li");
      li.innerHTML = `<div class="item-head"><strong>${escapeHtml(p.title)}</strong><button class="mini-btn danger" data-id="${p.id}">🗑️</button></div><div class="muted">${escapeHtml(p.address)}</div>`;
      li.querySelector("button").addEventListener("click", async () => { vibrate(30); await db.delete(STORE.places, p.id); render(); toast("🗑️ Удалено"); });
      list.appendChild(li);
    });
  };

  const updateMapCoords = () => {
    const txt = document.getElementById("mapCoords");
    if (mapState) { txt.textContent = `${mapState.lat.toFixed(6)}, ${mapState.lon.toFixed(6)}`; mapsBtn.disabled = false; }
    else { txt.textContent = "Координаты: не получены"; mapsBtn.disabled = true; }
  };

  detBtn.addEventListener("click", () => {
    if (!navigator.geolocation) return;
    detBtn.disabled = true; detBtn.textContent = "⏳...";
    navigator.geolocation.getCurrentPosition(p => {
      mapState = { id: "mapState", lat: p.coords.latitude, lon: p.coords.longitude, updatedAt: Date.now() };
      db.put(STORE.places, mapState); updateMapCoords(); detBtn.disabled = false; detBtn.textContent = "📡 Обновить"; vibrate(50); toast("📍 Координаты получены", "success");
    }, () => { detBtn.disabled = false; detBtn.textContent = "📡 Определить"; toast("⚠️ Ошибка GPS", "error"); }, { enableHighAccuracy: true, timeout: 10000 });
  });

  if (mapsBtn) mapsBtn.addEventListener("click", () => {
    if (mapState) window.open(`https://maps.google.com/?q=${mapState.lat},${mapState.lon}`, "_blank");
  });

  form.addEventListener("submit", async e => { e.preventDefault(); const t = titleIn.value.trim(), a = addrIn.value.trim(); if (!t || !a) return; vibrate(30); await db.put(STORE.places, { id: createId(), title: t, address: a }); form.reset(); render(); toast("📍 Точка сохранена", "success"); });
  db.get(STORE.places, "mapState").then(res => { if (res) { mapState = res; updateMapCoords(); } });
  render();
}

// ⚙️ Settings
function setupSettings() {
  document.getElementById("btnExport")?.addEventListener("click", async () => {
    try {
      const data = { contacts: await db.getAll(STORE.contacts), places: await db.getAll(STORE.places), meta: await db.getAll(STORE.meta), exportedAt: Date.now() };
      const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" })); a.download = `sosguard_backup_${new Date().toISOString().slice(0,10)}.json`; a.click(); vibrate(30); toast("📥 Бэкап скачан", "success");
    } catch { toast("❌ Ошибка экспорта", "error"); }
  });

  document.getElementById("btnImport")?.addEventListener("change", async e => {
    const file = e.target.files[0]; if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      for (const s of Object.values(STORE)) await db.clear(s);
      if (data.contacts) for (const i of data.contacts) await db.put(STORE.contacts, i);
      if (data.places) for (const i of data.places) await db.put(STORE.places, i);
      if (data.meta) for (const i of data.meta) await db.put(STORE.meta, i);
      vibrate(30); toast("✅ Данные восстановлены", "success"); setTimeout(() => window.location.reload(), 800);
    } catch { toast("❌ Ошибка файла", "error"); }
    e.target.value = "";
  });

  document.getElementById("btnReset")?.addEventListener("click", async () => {
    if (!confirm("Удалить ВСЕ данные?")) return;
    for (const s of Object.values(STORE)) await db.clear(s); vibrate(30); toast("🗑️ Сброшено", "success"); setTimeout(() => window.location.reload(), 800);
  });
}

// 🌐 Init
document.addEventListener("DOMContentLoaded", () => {
  setupNetwork(); setupTabs(); setupSOS(); setupContacts(); setupMap(); setupSettings();
  if ("serviceWorker" in navigator) window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(() => {}));
});
