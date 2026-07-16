// ---------- storage ----------
const LS_KEYS = { drivers: "fl_drivers", payments: "fl_payments", expenses: "fl_expenses" };

function load(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}
function save(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error("storage error", e);
  }
}

let drivers = load(LS_KEYS.drivers);
let payments = load(LS_KEYS.payments);
let expenses = load(LS_KEYS.expenses);

function persistDrivers() { save(LS_KEYS.drivers, drivers); }
function persistPayments() { save(LS_KEYS.payments, payments); }
function persistExpenses() { save(LS_KEYS.expenses, expenses); }

// ---------- helpers ----------
function uid() { return Math.random().toString(36).slice(2, 10) + Date.now().toString(36); }

function getMonday(dateInput) {
  const date = new Date(dateInput);
  date.setHours(0, 0, 0, 0);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(date.setDate(diff));
}
function fmtISO(d) { return new Date(d).toISOString().split("T")[0]; }
function weekLabel(mondayISO) {
  const start = new Date(mondayISO + "T00:00:00");
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  const opts = { month: "short", day: "numeric" };
  return `${start.toLocaleDateString("en-US", opts)} \u2013 ${end.toLocaleDateString("en-US", opts)}`;
}
function money(n) {
  const v = Number(n) || 0;
  return `$${v.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}
function esc(s) {
  const d = document.createElement("div");
  d.textContent = s == null ? "" : String(s);
  return d.innerHTML;
}

const CATEGORY_META = {
  fuel: { label: "Fuel", icon: `<path d="M3 22h12M4 9h8M14 9V4a1 1 0 0 0-1-1H6a1 1 0 0 0-1 1v18M15 6l3 3v9a1.5 1.5 0 0 0 3 0v-5l-2-3"/>` },
  repair: { label: "Repairs", icon: `<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>` },
  other: { label: "Other", icon: `<path d="M4 2h16v20l-3-2-3 2-3-2-3 2-3-2-1 2z"/><path d="M8 7h8M8 11h8M8 15h5"/>` },
};
function iconSvg(pathInner, color, size = 14) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${pathInner}</svg>`;
}

// ---------- tabs ----------
function goTab(tab) {
  document.querySelectorAll(".tab").forEach((el) => el.classList.remove("active"));
  document.querySelectorAll(".nav-btn").forEach((el) => el.classList.remove("active"));
  document.getElementById("tab-" + tab).classList.add("active");
  document.getElementById("nav-" + tab).classList.add("active");
  renderAll();
}

// ---------- render ----------
function currentWeekISO() { return fmtISO(getMonday(new Date())); }

function renderAll() {
  const weekISO = currentWeekISO();
  document.getElementById("weekLabel").textContent = "WEEK OF " + weekLabel(weekISO).toUpperCase();

  const thisWeekPayments = payments.filter((p) => p.weekStart === weekISO);
  const collected = thisWeekPayments.reduce((s, p) => s + Number(p.amount || 0), 0);
  const expected = drivers.reduce((s, d) => s + Number(d.weeklyRate || 0), 0);
  const thisWeekExpenses = expenses.filter((e) => fmtISO(getMonday(e.date)) === weekISO);
  const expensesTotal = thisWeekExpenses.reduce((s, e) => s + Number(e.amount || 0), 0);
  const net = collected - expensesTotal;

  document.getElementById("statCollected").textContent = money(collected);
  document.getElementById("statExpenses").textContent = money(expensesTotal);
  const netEl = document.getElementById("statNet");
  netEl.textContent = money(net);
  netEl.className = "stat-value font-mono " + (net >= 0 ? "up" : "down");

  document.getElementById("manifestTitle").textContent = `This week's manifest \u2014 ${money(collected)} of ${money(expected)} collected`;

  renderManifest(thisWeekPayments, weekISO);
  renderWeekExpenses(thisWeekExpenses);
  renderDrivers();
  renderAllExpenses();
}

function renderManifest(thisWeekPayments, weekISO) {
  const el = document.getElementById("manifestList");
  if (drivers.length === 0) {
    el.innerHTML = emptyState("No drivers on the roster yet. Add your first rider to start tracking weekly payments.", "Add a driver", "goTab('drivers')");
    return;
  }
  el.innerHTML = `<div class="ticket-list">${drivers.map((d) => {
    const paid = thisWeekPayments.find((p) => p.driverId === d.id);
    return `<div class="ticket">
      <div class="ticket-left">
        <div class="rider-tag font-mono">RIDER</div>
        <div class="rider-name">${esc(d.name)}</div>
        <div class="rider-rate font-mono">${money(d.weeklyRate)}/wk</div>
      </div>
      <div class="ticket-right">
        ${paid ? `
          <div>
            <div class="paid-amt font-mono">PAID \u00b7 ${money(paid.amount)}</div>
            <button class="undo-btn font-mono" onclick="unmarkPaid('${d.id}')">undo</button>
          </div>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4FAE7A" stroke-width="2.5"><path d="M20 6L9 17l-5-5"/></svg>
        ` : `
          <button class="btn btn-yellow" onclick="openPayModal('${d.id}')">Mark paid</button>
        `}
      </div>
    </div>`;
  }).join("")}</div>`;
}

function renderWeekExpenses(list) {
  const el = document.getElementById("weekExpenseList");
  if (list.length === 0) {
    el.innerHTML = `<div class="mono-muted">No expenses logged yet this week.</div>`;
    return;
  }
  el.innerHTML = `<div style="display:flex;flex-direction:column;gap:6px;">${list.slice(0, 3).map((e) => {
    const meta = CATEGORY_META[e.category] || CATEGORY_META.other;
    return `<div class="expense-row">
      <div class="flex-gap">${iconSvg(meta.icon, "#8F897E")}<span style="font-size:13px;">${esc(e.note || meta.label)}</span></div>
      <span class="mono-rust">${money(e.amount)}</span>
    </div>`;
  }).join("")}</div>`;
}

function renderDrivers() {
  const el = document.getElementById("driversList");
  if (drivers.length === 0) {
    el.innerHTML = emptyState("Your roster is empty. Add a driver to start tracking their weekly rate and payments.");
    return;
  }
  el.innerHTML = drivers.map((d, i) => `
    <div class="card">
      <div class="row-between">
        <div class="flex-gap">
          <div class="badge-num font-mono">#${String(i + 1).padStart(2, "0")}</div>
          <div>
            <div style="font-size:15px;font-weight:600;">${esc(d.name)}</div>
            <div class="mono-muted" style="font-size:12px;">${money(d.weeklyRate)}/wk</div>
          </div>
        </div>
        <div class="flex-gap">
          <button class="btn btn-ghost" onclick="openDriverModal('${d.id}')">Edit</button>
          <button class="btn-icon" onclick="removeDriver('${d.id}')" style="color:#D9573B;">
            ${iconSvg('<path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m2 0v14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V6h12z"/>', "#D9573B", 15)}
          </button>
        </div>
      </div>
      <div class="tracker-row">
        <div class="flex-gap">
          ${iconSvg('<path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/>', "#8F897E", 12)}
          <span class="mono-muted">${esc(d.trackerNote) || "no bike ID noted"}</span>
        </div>
        <a class="tracker-link font-mono" href="https://my.tracker.co.za/Login.aspx" target="_blank" rel="noopener noreferrer">Open Tracker \u2192</a>
      </div>
    </div>
  `).join("");
}

function renderAllExpenses() {
  const sorted = [...expenses].sort((a, b) => (a.date < b.date ? 1 : -1));
  const total = expenses.reduce((s, e) => s + Number(e.amount || 0), 0);
  document.getElementById("expenseTotal").textContent = "ALL-TIME TOTAL: " + money(total);
  const el = document.getElementById("allExpenseList");
  if (sorted.length === 0) {
    el.innerHTML = emptyState("No expenses logged yet. Fuel, repairs, and other costs will show up here.");
    return;
  }
  el.innerHTML = sorted.map((e) => {
    const meta = CATEGORY_META[e.category] || CATEGORY_META.other;
    return `<div class="card" style="display:flex;align-items:center;justify-content:space-between;">
      <div class="flex-gap">
        <div class="expense-icon">${iconSvg(meta.icon, "#8F897E")}</div>
        <div>
          <div style="font-size:13px;font-weight:500;">${esc(e.note || meta.label)}</div>
          <div class="mono-muted">${meta.label} \u00b7 ${e.date}</div>
        </div>
      </div>
      <div class="flex-gap">
        <span class="mono-rust" style="font-size:14px;">${money(e.amount)}</span>
        <button class="btn-icon" onclick="removeExpense('${e.id}')" style="color:#8F897E;">
          ${iconSvg('<path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m2 0v14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V6h12z"/>', "#8F897E", 14)}
        </button>
      </div>
    </div>`;
  }).join("");
}

function emptyState(text, actionLabel, actionOnClick) {
  return `<div class="empty">
    <p>${esc(text)}</p>
    ${actionLabel ? `<button class="btn btn-yellow" onclick="${actionOnClick}">${actionLabel}</button>` : ""}
  </div>`;
}

// ---------- actions ----------
function addDriver(name, weeklyRate, trackerNote) {
  drivers.push({ id: uid(), name, weeklyRate: Number(weeklyRate) || 0, trackerNote: trackerNote || "" });
  persistDrivers();
  closeModal();
  renderAll();
}
function updateDriver(id, patch) {
  drivers = drivers.map((d) => (d.id === id ? { ...d, ...patch } : d));
  persistDrivers();
  closeModal();
  renderAll();
}
function removeDriver(id) {
  if (!confirm("Remove this driver from the roster? Their payment history will be kept.")) return;
  drivers = drivers.filter((d) => d.id !== id);
  persistDrivers();
  renderAll();
}
function markPaid(driverId, amount) {
  const weekISO = currentWeekISO();
  const existing = payments.find((p) => p.driverId === driverId && p.weekStart === weekISO);
  if (existing) {
    payments = payments.map((p) => (p.id === existing.id ? { ...p, amount: Number(amount) } : p));
  } else {
    payments.push({ id: uid(), driverId, weekStart: weekISO, amount: Number(amount), date: fmtISO(new Date()) });
  }
  persistPayments();
  closeModal();
  renderAll();
}
function unmarkPaid(driverId) {
  const weekISO = currentWeekISO();
  payments = payments.filter((p) => !(p.driverId === driverId && p.weekStart === weekISO));
  persistPayments();
  renderAll();
}
function addExpense(date, category, amount, note) {
  expenses.push({ id: uid(), date, category, amount: Number(amount) || 0, note: note || "" });
  persistExpenses();
  closeModal();
  renderAll();
}
function removeExpense(id) {
  expenses = expenses.filter((e) => e.id !== id);
  persistExpenses();
  renderAll();
}

// ---------- modals ----------
function closeModal() { document.getElementById("modalRoot").innerHTML = ""; }

function openDriverModal(driverId) {
  const driver = driverId ? drivers.find((d) => d.id === driverId) : null;
  const root = document.getElementById("modalRoot");
  root.innerHTML = `
    <div class="modal-overlay" onclick="if(event.target===this) closeModal()">
      <div class="modal">
        <div class="modal-head">
          <div class="modal-title font-display">${driver ? "Edit driver" : "Add driver"}</div>
          <button class="btn-icon" onclick="closeModal()">${iconSvg('<path d="M18 6L6 18M6 6l12 12"/>', "#8F897E", 20)}</button>
        </div>
        <div class="field">
          <div class="field-label font-mono">NAME</div>
          <input id="f-name" placeholder="Driver name" value="${driver ? esc(driver.name) : ""}" />
        </div>
        <div class="field">
          <div class="field-label font-mono">WEEKLY RATE</div>
          <input id="f-rate" type="number" value="${driver ? driver.weeklyRate : 700}" />
        </div>
        <div class="field">
          <div class="field-label font-mono">TRACKER NOTE (OPTIONAL)</div>
          <input id="f-tracker" placeholder="e.g. bike ID on your tracker app" value="${driver ? esc(driver.trackerNote || "") : ""}" />
        </div>
        <button class="btn btn-yellow" id="f-save" onclick="submitDriver('${driver ? driver.id : ""}')">Save driver</button>
      </div>
    </div>
  `;
  document.getElementById("f-name").focus();
}
function submitDriver(id) {
  const name = document.getElementById("f-name").value.trim();
  const rate = document.getElementById("f-rate").value;
  const tracker = document.getElementById("f-tracker").value.trim();
  if (!name) return;
  if (id) updateDriver(id, { name, weeklyRate: Number(rate), trackerNote: tracker });
  else addDriver(name, rate, tracker);
}

function openPayModal(driverId) {
  const driver = drivers.find((d) => d.id === driverId);
  const root = document.getElementById("modalRoot");
  root.innerHTML = `
    <div class="modal-overlay" onclick="if(event.target===this) closeModal()">
      <div class="modal">
        <div class="modal-head">
          <div class="modal-title font-display">Pay ${esc(driver.name)}</div>
          <button class="btn-icon" onclick="closeModal()">${iconSvg('<path d="M18 6L6 18M6 6l12 12"/>', "#8F897E", 20)}</button>
        </div>
        <div class="field">
          <div class="field-label font-mono">AMOUNT</div>
          <input id="f-amount" type="number" value="${driver.weeklyRate}" />
        </div>
        <button class="btn btn-yellow" onclick="markPaid('${driverId}', document.getElementById('f-amount').value)">Confirm payment</button>
      </div>
    </div>
  `;
  document.getElementById("f-amount").focus();
}

function openExpenseModal() {
  const root = document.getElementById("modalRoot");
  const today = fmtISO(new Date());
  root.innerHTML = `
    <div class="modal-overlay" onclick="if(event.target===this) closeModal()">
      <div class="modal">
        <div class="modal-head">
          <div class="modal-title font-display">Log expense</div>
          <button class="btn-icon" onclick="closeModal()">${iconSvg('<path d="M18 6L6 18M6 6l12 12"/>', "#8F897E", 20)}</button>
        </div>
        <div class="field">
          <div class="field-label font-mono">DATE</div>
          <input id="f-date" type="date" value="${today}" />
        </div>
        <div class="field">
          <div class="field-label font-mono">CATEGORY</div>
          <select id="f-category">
            <option value="fuel">Fuel</option>
            <option value="repair">Repairs</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div class="field">
          <div class="field-label font-mono">AMOUNT</div>
          <input id="f-amount" type="number" placeholder="0" />
        </div>
        <div class="field">
          <div class="field-label font-mono">NOTE (OPTIONAL)</div>
          <input id="f-note" placeholder="e.g. chain replacement" />
        </div>
        <button class="btn btn-yellow" onclick="submitExpense()">Save expense</button>
      </div>
    </div>
  `;
  document.getElementById("f-date").focus();
}
function submitExpense() {
  const date = document.getElementById("f-date").value;
  const category = document.getElementById("f-category").value;
  const amount = document.getElementById("f-amount").value;
  const note = document.getElementById("f-note").value.trim();
  if (!amount) return;
  addExpense(date, category, amount, note);
}

// ---------- init ----------
renderAll();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  });
}
