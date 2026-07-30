// ---------- storage ----------
const LS_KEYS = {
  drivers: "fl_drivers", payments: "fl_payments", expenses: "fl_expenses",
  adjustments: "fl_adjustments", bikes: "fl_bikes", wage: "fl_wage", withdrawals: "fl_withdrawals",
};

function load(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : (fallback !== undefined ? fallback : []);
  } catch (e) {
    return fallback !== undefined ? fallback : [];
  }
}
function save(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { console.error("storage error", e); }
}

let drivers = load(LS_KEYS.drivers, []);
let payments = load(LS_KEYS.payments, []);
let expenses = load(LS_KEYS.expenses, []);
let adjustments = load(LS_KEYS.adjustments, []);
let bikes = load(LS_KEYS.bikes, []);
let withdrawals = load(LS_KEYS.withdrawals, []);
let wage = load(LS_KEYS.wage, { monthlySalary: 0, startDate: null });

function persistDrivers() { save(LS_KEYS.drivers, drivers); }
function persistPayments() { save(LS_KEYS.payments, payments); }
function persistExpenses() { save(LS_KEYS.expenses, expenses); }
function persistAdjustments() { save(LS_KEYS.adjustments, adjustments); }
function persistBikes() { save(LS_KEYS.bikes, bikes); }
function persistWithdrawals() { save(LS_KEYS.withdrawals, withdrawals); }
function persistWage() { save(LS_KEYS.wage, wage); }

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
  const sign = v < 0 ? "-" : "";
  return `${sign}$${Math.abs(v).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}
function esc(s) {
  const d = document.createElement("div");
  d.textContent = s == null ? "" : String(s);
  return d.innerHTML;
}
function daysBetween(d1, d2) {
  return Math.max(0, (new Date(d2) - new Date(d1)) / 86400000);
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

// ---------- wage math ----------
function weeklyWageRate() {
  return (Number(wage.monthlySalary) || 0) * 12 / 52;
}
function accruedWage() {
  if (!wage.startDate || !wage.monthlySalary) return 0;
  const days = daysBetween(wage.startDate, new Date());
  return (weeklyWageRate() / 7) * days;
}
function totalWithdrawn() {
  return withdrawals.reduce((s, w) => s + Number(w.amount || 0), 0);
}
function availableToWithdraw() {
  return Math.max(0, accruedWage() - totalWithdrawn());
}

// ---------- balance ----------
function computeBalance() {
  const adjTotal = adjustments.reduce((s, a) => s + Number(a.amount || 0), 0);
  const allCollected = payments.reduce((s, p) => s + Number(p.amount || 0), 0);
  const allExpenses = expenses.reduce((s, e) => s + Number(e.amount || 0), 0);
  return adjTotal + allCollected - allExpenses - totalWithdrawn();
}

// ---------- render ----------
function currentWeekISO() { return fmtISO(getMonday(new Date())); }

function renderAll() {
  const weekISO = currentWeekISO();
  document.getElementById("weekLabel").textContent = "WEEK OF " + weekLabel(weekISO).toUpperCase();

  const thisWeekPayments = payments.filter((p) => p.weekStart === weekISO);
  const collected = thisWeekPayments.reduce((s, p) => s + Number(p.amount || 0), 0);
  const thisWeekExpenses = expenses.filter((e) => fmtISO(getMonday(e.date)) === weekISO);
  const expensesTotal = thisWeekExpenses.reduce((s, e) => s + Number(e.amount || 0), 0);
  const net = collected - expensesTotal;

  document.getElementById("weekStrip").textContent =
    `This week: ${money(collected)} collected \u00b7 ${money(expensesTotal)} spent \u00b7 net ${money(net)}`;

  document.getElementById("manifestTitle").textContent = `This week's manifest`;

  renderBalance();
  renderWage();
  renderManifest(thisWeekPayments);
  renderBikeCosts();
  renderDrivers();
  renderBikes();
  renderExpenseGroups();
}

function renderBalance() {
  const balance = computeBalance();
  const el = document.getElementById("statBalance");
  el.textContent = money(balance);
  el.style.color = balance >= 0 ? "var(--yellow)" : "var(--rust)";

  const histEl = document.getElementById("adjustmentHistory");
  if (adjustments.length === 0) { histEl.innerHTML = ""; return; }
  const sorted = [...adjustments].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 3);
  histEl.innerHTML = `<div class="adjust-list">${sorted.map((a) => `
    <div class="adjust-row">
      <span style="font-size:13px;">${esc(a.note || "Balance adjustment")}</span>
      <div class="flex-gap">
        <span class="font-mono" style="font-size:13px; color:${Number(a.amount) >= 0 ? "var(--green)" : "var(--rust)"}; font-weight:600;">${Number(a.amount) >= 0 ? "+" : ""}${money(a.amount)}</span>
        <button class="btn-icon" onclick="removeAdjustment('${a.id}')" style="color:#8F897E;">${iconSvg('<path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m2 0v14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V6h12z"/>', "#8F897E", 13)}</button>
      </div>
    </div>`).join("")}</div>`;
}

function renderWage() {
  const el = document.getElementById("statWageAvailable");
  const infoEl = document.getElementById("wageInfo");
  if (!wage.monthlySalary) {
    el.textContent = "$0";
    infoEl.textContent = "Set your salary to start accruing";
  } else {
    el.textContent = money(availableToWithdraw());
    infoEl.textContent = `Accruing ${money(weeklyWageRate())}/wk from a ${money(wage.monthlySalary)}/mo salary`;
  }
  const histEl = document.getElementById("withdrawHistory");
  if (withdrawals.length === 0) { histEl.innerHTML = ""; return; }
  const sorted = [...withdrawals].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 3);
  histEl.innerHTML = `<div class="adjust-list">${sorted.map((w) => `
    <div class="adjust-row">
      <span style="font-size:13px;">${esc(w.note || "Wage withdrawal")} <span class="mono-muted">${w.date}</span></span>
      <div class="flex-gap">
        <span class="font-mono" style="font-size:13px; color:var(--rust); font-weight:600;">-${money(w.amount)}</span>
        <button class="btn-icon" onclick="removeWithdrawal('${w.id}')" style="color:#8F897E;">${iconSvg('<path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m2 0v14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V6h12z"/>', "#8F897E", 13)}</button>
      </div>
    </div>`).join("")}</div>`;
}

function renderManifest(thisWeekPayments) {
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
        ` : `<button class="btn btn-yellow" onclick="openPayModal('${d.id}')">Mark paid</button>`}
      </div>
    </div>`;
  }).join("")}</div>`;
}

function renderBikeCosts() {
  const el = document.getElementById("bikeCostList");
  if (bikes.length === 0) {
    el.innerHTML = `<div class="mono-muted">No bikes added yet \u2014 add one in the Team tab to start tracking cost per bike.</div>`;
    return;
  }
  const totals = bikes.map((b) => ({
    bike: b,
    total: expenses.filter((e) => e.bikeId === b.id).reduce((s, e) => s + Number(e.amount || 0), 0),
  }));
  const generalTotal = expenses.filter((e) => !e.bikeId).reduce((s, e) => s + Number(e.amount || 0), 0);
  const maxTotal = Math.max(1, ...totals.map((t) => t.total), generalTotal);

  el.innerHTML = totals.map(({ bike, total }) => {
    const driver = drivers.find((d) => d.id === bike.driverId);
    return `<div class="bike-cost-row" style="flex-direction:column; align-items:stretch;">
      <div class="row-between">
        <span style="font-size:13px;">${esc(bike.name)}${driver ? ` <span class="mono-muted">\u00b7 ${esc(driver.name)}</span>` : ""}</span>
        <span class="font-mono" style="font-size:13px; color:var(--rust);">${money(total)}</span>
      </div>
      <div class="bike-cost-bar-track"><div class="bike-cost-bar-fill" style="width:${(total / maxTotal) * 100}%;"></div></div>
    </div>`;
  }).join("") + (generalTotal > 0 ? `
    <div class="bike-cost-row" style="flex-direction:column; align-items:stretch;">
      <div class="row-between">
        <span style="font-size:13px;">General / Other</span>
        <span class="font-mono" style="font-size:13px; color:var(--rust);">${money(generalTotal)}</span>
      </div>
      <div class="bike-cost-bar-track"><div class="bike-cost-bar-fill" style="width:${(generalTotal / maxTotal) * 100}%;"></div></div>
    </div>` : "");
}

function renderDrivers() {
  const el = document.getElementById("driversList");
  if (drivers.length === 0) {
    el.innerHTML = emptyState("Your roster is empty. Add a driver to start tracking their weekly rate and payments.");
    return;
  }
  el.innerHTML = drivers.map((d, i) => {
    const bike = bikes.find((b) => b.driverId === d.id);
    return `<div class="card">
      <div class="row-between">
        <div class="flex-gap">
          <div class="badge-num font-mono">#${String(i + 1).padStart(2, "0")}</div>
          <div>
            <div style="font-size:15px;font-weight:600;">${esc(d.name)}</div>
            <div class="mono-muted" style="font-size:12px;">${money(d.weeklyRate)}/wk ${bike ? `\u00b7 <span class="pill">${esc(bike.name)}</span>` : ""}</div>
          </div>
        </div>
        <div class="flex-gap">
          <button class="btn btn-ghost" onclick="openDriverModal('${d.id}')">Edit</button>
          <button class="btn-icon" onclick="removeDriver('${d.id}')" style="color:#D9573B;">${iconSvg('<path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m2 0v14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V6h12z"/>', "#D9573B", 15)}</button>
        </div>
      </div>
    </div>`;
  }).join("");
}

function renderBikes() {
  const el = document.getElementById("bikesList");
  if (bikes.length === 0) {
    el.innerHTML = emptyState("No bikes yet. Add one to start tracking expenses per bike.");
    return;
  }
  el.innerHTML = bikes.map((b) => {
    const driver = drivers.find((d) => d.id === b.driverId);
    const total = expenses.filter((e) => e.bikeId === b.id).reduce((s, e) => s + Number(e.amount || 0), 0);
    return `<div class="card">
      <div class="row-between">
        <div>
          <div style="font-size:15px;font-weight:600;">${esc(b.name)}</div>
          <div class="mono-muted" style="font-size:12px;">${driver ? esc(driver.name) : "Unassigned"} \u00b7 ${money(total)} spent</div>
        </div>
        <div class="flex-gap">
          <button class="btn btn-ghost" onclick="openBikeModal('${b.id}')">Edit</button>
          <button class="btn-icon" onclick="removeBike('${b.id}')" style="color:#D9573B;">${iconSvg('<path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m2 0v14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V6h12z"/>', "#D9573B", 15)}</button>
        </div>
      </div>
      <div class="tracker-row">
        <div class="flex-gap">${iconSvg('<path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/>', "#8F897E", 12)}<span class="mono-muted">${esc(b.trackerNote) || "no bike ID noted"}</span></div>
        <a class="tracker-link font-mono" href="https://my.tracker.co.za/Login.aspx" target="_blank" rel="noopener noreferrer">Open Tracker \u2192</a>
      </div>
    </div>`;
  }).join("");
}

function renderExpenseGroups() {
  const total = expenses.reduce((s, e) => s + Number(e.amount || 0), 0);
  document.getElementById("expenseTotal").textContent = "ALL-TIME TOTAL: " + money(total);
  const el = document.getElementById("expenseGroups");

  if (expenses.length === 0) {
    el.innerHTML = emptyState("No expenses logged yet. Fuel, repairs, and other costs will show up here, grouped by bike.");
    return;
  }

  const groups = bikes.map((b) => ({ id: b.id, name: b.name, list: expenses.filter((e) => e.bikeId === b.id) }));
  groups.push({ id: null, name: "General / Other", list: expenses.filter((e) => !e.bikeId) });

  el.innerHTML = groups.filter((g) => g.list.length > 0).map((g) => {
    const sorted = [...g.list].sort((a, b) => (a.date < b.date ? 1 : -1));
    const groupTotal = g.list.reduce((s, e) => s + Number(e.amount || 0), 0);
    return `<div class="expense-group">
      <div class="expense-group-head">
        <span class="expense-group-title">${esc(g.name)}</span>
        <span class="expense-group-total">${money(groupTotal)}</span>
      </div>
      ${sorted.map((e) => {
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
            <button class="btn-icon" onclick="removeExpense('${e.id}')" style="color:#8F897E;">${iconSvg('<path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m2 0v14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V6h12z"/>', "#8F897E", 14)}</button>
          </div>
        </div>`;
      }).join("")}
    </div>`;
  }).join("");
}

function emptyState(text, actionLabel, actionOnClick) {
  return `<div class="empty"><p>${esc(text)}</p>${actionLabel ? `<button class="btn btn-yellow" onclick="${actionOnClick}">${actionLabel}</button>` : ""}</div>`;
}

// ---------- driver actions ----------
function addDriver(name, weeklyRate) {
  drivers.push({ id: uid(), name, weeklyRate: Number(weeklyRate) || 0 });
  persistDrivers(); closeModal(); renderAll();
}
function updateDriver(id, patch) {
  drivers = drivers.map((d) => (d.id === id ? { ...d, ...patch } : d));
  persistDrivers(); closeModal(); renderAll();
}
function removeDriver(id) {
  if (!confirm("Remove this driver from the roster? Their payment history will be kept.")) return;
  drivers = drivers.filter((d) => d.id !== id);
  persistDrivers(); renderAll();
}
function markPaid(driverId, amount) {
  const weekISO = currentWeekISO();
  const existing = payments.find((p) => p.driverId === driverId && p.weekStart === weekISO);
  if (existing) payments = payments.map((p) => (p.id === existing.id ? { ...p, amount: Number(amount) } : p));
  else payments.push({ id: uid(), driverId, weekStart: weekISO, amount: Number(amount), date: fmtISO(new Date()) });
  persistPayments(); closeModal(); renderAll();
}
function unmarkPaid(driverId) {
  const weekISO = currentWeekISO();
  payments = payments.filter((p) => !(p.driverId === driverId && p.weekStart === weekISO));
  persistPayments(); renderAll();
}

// ---------- bike actions ----------
function addBike(name, driverId, trackerNote) {
  bikes.push({ id: uid(), name, driverId: driverId || null, trackerNote: trackerNote || "" });
  persistBikes(); closeModal(); renderAll();
}
function updateBike(id, patch) {
  bikes = bikes.map((b) => (b.id === id ? { ...b, ...patch } : b));
  persistBikes(); closeModal(); renderAll();
}
function removeBike(id) {
  if (!confirm("Remove this bike? Its logged expenses will move to General / Other.")) return;
  bikes = bikes.filter((b) => b.id !== id);
  persistBikes(); renderAll();
}

// ---------- expense actions ----------
function addExpense(date, bikeId, category, amount, note) {
  expenses.push({ id: uid(), date, bikeId: bikeId || null, category, amount: Number(amount) || 0, note: note || "" });
  persistExpenses(); closeModal(); renderAll();
}
function removeExpense(id) {
  expenses = expenses.filter((e) => e.id !== id);
  persistExpenses(); renderAll();
}

// ---------- adjustment actions ----------
function addAdjustment(signedAmount, note) {
  adjustments.push({ id: uid(), amount: Number(signedAmount) || 0, note: note || "", date: fmtISO(new Date()) });
  persistAdjustments(); closeModal(); renderAll();
}
function removeAdjustment(id) {
  adjustments = adjustments.filter((a) => a.id !== id);
  persistAdjustments(); renderAll();
}

// ---------- wage actions ----------
function saveWageSettings(monthlySalary) {
  const isFirstTime = !wage.startDate;
  wage = { monthlySalary: Number(monthlySalary) || 0, startDate: isFirstTime ? fmtISO(new Date()) : wage.startDate };
  persistWage(); closeModal(); renderAll();
}
function addWithdrawal(amount, note) {
  withdrawals.push({ id: uid(), amount: Number(amount) || 0, note: note || "", date: fmtISO(new Date()) });
  persistWithdrawals(); closeModal(); renderAll();
}
function removeWithdrawal(id) {
  withdrawals = withdrawals.filter((w) => w.id !== id);
  persistWithdrawals(); renderAll();
}

// ---------- modals ----------
function closeModal() { document.getElementById("modalRoot").innerHTML = ""; }

function modalShell(title, bodyHtml) {
  return `<div class="modal-overlay" onclick="if(event.target===this) closeModal()">
    <div class="modal">
      <div class="modal-head">
        <div class="modal-title font-display">${title}</div>
        <button class="btn-icon" onclick="closeModal()">${iconSvg('<path d="M18 6L6 18M6 6l12 12"/>', "#8F897E", 20)}</button>
      </div>
      ${bodyHtml}
    </div>
  </div>`;
}

function openDriverModal(driverId) {
  const driver = driverId ? drivers.find((d) => d.id === driverId) : null;
  document.getElementById("modalRoot").innerHTML = modalShell(driver ? "Edit driver" : "Add driver", `
    <div class="field"><div class="field-label font-mono">NAME</div><input id="f-name" placeholder="Driver name" value="${driver ? esc(driver.name) : ""}" /></div>
    <div class="field"><div class="field-label font-mono">WEEKLY RATE</div><input id="f-rate" type="number" value="${driver ? driver.weeklyRate : 700}" /></div>
    <button class="btn btn-yellow" onclick="submitDriver('${driver ? driver.id : ""}')">Save driver</button>
  `);
  document.getElementById("f-name").focus();
}
function submitDriver(id) {
  const name = document.getElementById("f-name").value.trim();
  const rate = document.getElementById("f-rate").value;
  if (!name) return;
  if (id) updateDriver(id, { name, weeklyRate: Number(rate) });
  else addDriver(name, rate);
}

function openBikeModal(bikeId) {
  const bike = bikeId ? bikes.find((b) => b.id === bikeId) : null;
  const driverOptions = `<option value="">Unassigned</option>` + drivers.map((d) => `<option value="${d.id}" ${bike && bike.driverId === d.id ? "selected" : ""}>${esc(d.name)}</option>`).join("");
  document.getElementById("modalRoot").innerHTML = modalShell(bike ? "Edit bike" : "Add bike", `
    <div class="field"><div class="field-label font-mono">BIKE NAME / ID</div><input id="f-bname" placeholder="e.g. Bike 1" value="${bike ? esc(bike.name) : ""}" /></div>
    <div class="field"><div class="field-label font-mono">ASSIGNED DRIVER</div><select id="f-bdriver">${driverOptions}</select></div>
    <div class="field"><div class="field-label font-mono">TRACKER NOTE (OPTIONAL)</div><input id="f-btracker" placeholder="e.g. Tracker device ID" value="${bike ? esc(bike.trackerNote || "") : ""}" /></div>
    <button class="btn btn-yellow" onclick="submitBike('${bike ? bike.id : ""}')">Save bike</button>
  `);
  document.getElementById("f-bname").focus();
}
function submitBike(id) {
  const name = document.getElementById("f-bname").value.trim();
  const driverId = document.getElementById("f-bdriver").value || null;
  const trackerNote = document.getElementById("f-btracker").value.trim();
  if (!name) return;
  if (id) updateBike(id, { name, driverId, trackerNote });
  else addBike(name, driverId, trackerNote);
}

function openPayModal(driverId) {
  const driver = drivers.find((d) => d.id === driverId);
  document.getElementById("modalRoot").innerHTML = modalShell(`Pay ${esc(driver.name)}`, `
    <div class="field"><div class="field-label font-mono">AMOUNT</div><input id="f-amount" type="number" value="${driver.weeklyRate}" /></div>
    <button class="btn btn-yellow" onclick="markPaid('${driverId}', document.getElementById('f-amount').value)">Confirm payment</button>
  `);
  document.getElementById("f-amount").focus();
}

function openExpenseModal() {
  const today = fmtISO(new Date());
  const bikeOptions = `<option value="">General / Other</option>` + bikes.map((b) => `<option value="${b.id}">${esc(b.name)}</option>`).join("");
  document.getElementById("modalRoot").innerHTML = modalShell("Log expense", `
    <div class="field"><div class="field-label font-mono">BIKE</div><select id="f-bike">${bikeOptions}</select></div>
    <div class="field"><div class="field-label font-mono">DATE</div><input id="f-date" type="date" value="${today}" /></div>
    <div class="field"><div class="field-label font-mono">CATEGORY</div>
      <select id="f-category"><option value="fuel">Fuel</option><option value="repair">Repairs</option><option value="other">Other</option></select>
    </div>
    <div class="field"><div class="field-label font-mono">AMOUNT</div><input id="f-amount" type="number" placeholder="0" /></div>
    <div class="field"><div class="field-label font-mono">NOTE (OPTIONAL)</div><input id="f-note" placeholder="e.g. chain replacement" /></div>
    <button class="btn btn-yellow" onclick="submitExpense()">Save expense</button>
  `);
  document.getElementById("f-date").focus();
}
function submitExpense() {
  const bikeId = document.getElementById("f-bike").value || null;
  const date = document.getElementById("f-date").value;
  const category = document.getElementById("f-category").value;
  const amount = document.getElementById("f-amount").value;
  const note = document.getElementById("f-note").value.trim();
  if (!amount) return;
  addExpense(date, bikeId, category, amount, note);
}

function openAdjustModal() {
  const isFirst = adjustments.length === 0 && payments.length === 0 && expenses.length === 0;
  document.getElementById("modalRoot").innerHTML = modalShell("Adjust balance", `
    <div class="field"><div class="field-label font-mono">DIRECTION</div>
      <select id="f-direction"><option value="add">Add money (e.g. starting cash, a correction)</option><option value="deduct">Deduct money (e.g. a mistake to reverse)</option></select>
    </div>
    <div class="field"><div class="field-label font-mono">AMOUNT</div><input id="f-amount" type="number" placeholder="0" /></div>
    <div class="field"><div class="field-label font-mono">NOTE</div><input id="f-note" placeholder="${isFirst ? "e.g. Starting balance" : "e.g. Correction"}" value="${isFirst ? "Starting balance" : ""}" /></div>
    <button class="btn btn-yellow" onclick="submitAdjustment()">Save</button>
  `);
  document.getElementById("f-amount").focus();
}
function submitAdjustment() {
  const dir = document.getElementById("f-direction").value;
  const amt = Number(document.getElementById("f-amount").value);
  const note = document.getElementById("f-note").value.trim();
  if (!amt) return;
  addAdjustment(dir === "deduct" ? -Math.abs(amt) : Math.abs(amt), note);
}

function openWageSettingsModal() {
  document.getElementById("modalRoot").innerHTML = modalShell("Wage settings", `
    <div class="field"><div class="field-label font-mono">YOUR MONTHLY SALARY</div><input id="f-salary" type="number" placeholder="0" value="${wage.monthlySalary || ""}" /></div>
    <div class="mono-muted" style="margin-bottom:12px;">This works out to roughly ${money(weeklyWageRate())}/week right now, and accrues continuously so you can withdraw whenever you like.</div>
    <button class="btn btn-yellow" onclick="submitWageSettings()">Save</button>
  `);
  document.getElementById("f-salary").focus();
  document.getElementById("f-salary").addEventListener("input", (e) => {
    const weekly = (Number(e.target.value) || 0) * 12 / 52;
    document.querySelector("#modalRoot .mono-muted").textContent = `This works out to roughly ${money(weekly)}/week right now, and accrues continuously so you can withdraw whenever you like.`;
  });
}
function submitWageSettings() {
  const salary = document.getElementById("f-salary").value;
  saveWageSettings(salary);
}

function openWithdrawModal() {
  const available = availableToWithdraw();
  document.getElementById("modalRoot").innerHTML = modalShell("Withdraw wage", `
    <div class="mono-muted" style="margin-bottom:12px;">Available: ${money(available)}</div>
    <div class="field"><div class="field-label font-mono">AMOUNT</div><input id="f-amount" type="number" value="${available.toFixed(0)}" /></div>
    <div class="field"><div class="field-label font-mono">NOTE (OPTIONAL)</div><input id="f-note" placeholder="e.g. July wage" /></div>
    <button class="btn btn-yellow" onclick="submitWithdrawal()">Confirm withdrawal</button>
  `);
  document.getElementById("f-amount").focus();
}
function submitWithdrawal() {
  const amount = document.getElementById("f-amount").value;
  const note = document.getElementById("f-note").value.trim();
  if (!amount) return;
  addWithdrawal(amount, note);
}

// ---------- init ----------
renderAll();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => { navigator.serviceWorker.register("sw.js").catch(() => {}); });
}
