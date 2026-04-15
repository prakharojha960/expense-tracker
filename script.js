const storageKey = "expense-tracker-data";
const legacyStorageKey = "d";
const budgetStorageKey = "expense-tracker-budget";
const colors = ["#d97706", "#c05621", "#2f855a", "#2b6c91", "#b45309", "#7c2d12"];
const categoryPresets = [
  "Groceries",
  "Rent",
  "Salary",
  "Bills",
  "Transport",
  "Dining",
  "Health",
  "Shopping"
];

let entries = JSON.parse(localStorage.getItem(storageKey))
  || JSON.parse(localStorage.getItem(legacyStorageKey))
  || [];

let budget = Number(localStorage.getItem(budgetStorageKey)) || 0;
let editingId = null;
let statusTimer = null;
let deferredInstallPrompt = null;

const form = document.getElementById("entry-form");
const installButton = document.getElementById("install-app");
const formHeading = document.getElementById("form-heading");
const cancelEditButton = document.getElementById("cancel-edit");
const submitButton = document.getElementById("submit-btn");
const amountInput = document.getElementById("amt");
const typeInput = document.getElementById("type");
const categoryInput = document.getElementById("cat");
const dateInput = document.getElementById("date");
const noteInput = document.getElementById("note");
const recurringInput = document.getElementById("recurring");
const categoryPresetsRoot = document.getElementById("category-presets");
const budgetInput = document.getElementById("budget-input");
const saveBudgetButton = document.getElementById("save-budget");
const budgetFill = document.getElementById("budget-fill");
const budgetStatus = document.getElementById("budget-status");
const analytics = document.getElementById("analytics");
const trendCanvas = document.getElementById("trend-chart");
const searchInput = document.getElementById("search-input");
const filterTypeInput = document.getElementById("filter-type");
const filterMonthInput = document.getElementById("filter-month");
const sortByInput = document.getElementById("sort-by");
const clearFiltersButton = document.getElementById("clear-filters");
const exportButton = document.getElementById("export-data");
const exportCsvButton = document.getElementById("export-csv");
const importTriggerButton = document.getElementById("import-trigger");
const importInput = document.getElementById("import-data");
const list = document.getElementById("list");
const resultCount = document.getElementById("result-count");
const monthlyFocus = document.getElementById("monthly-focus");
const incomeTotal = document.getElementById("inc");
const expenseTotal = document.getElementById("exp");
const balanceTotal = document.getElementById("bal");
const savingsRate = document.getElementById("save-rate");
const warningText = document.getElementById("warn");
const statusBanner = document.getElementById("status-banner");
const breakdown = document.getElementById("breakdown");
const legend = document.getElementById("legend");
const canvas = document.getElementById("chart");

function getToday(){
  return new Date().toISOString().split("T")[0];
}

function save(){
  localStorage.setItem(storageKey, JSON.stringify(entries));
}

function saveBudget(){
  localStorage.setItem(budgetStorageKey, String(budget));
}

function formatMoney(value){
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2
  }).format(value);
}

function formatMonthLabel(value){
  if(!value){
    return "Viewing all months";
  }

  const [year, month] = value.split("-");
  return new Intl.DateTimeFormat("en-IN", {
    month: "long",
    year: "numeric"
  }).format(new Date(Number(year), Number(month) - 1, 1));
}

function normalizeCategory(value){
  const trimmed = value.trim();
  return trimmed ? trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase() : "General";
}

function normalizeEntry(entry){
  return {
    id: entry.id || crypto.randomUUID(),
    amt: Number(entry.amt) || 0,
    type: entry.type === "income" ? "income" : "expense",
    cat: normalizeCategory(entry.cat || "General"),
    date: entry.date || getToday(),
    note: (entry.note || "").trim(),
    recurring: Boolean(entry.recurring)
  };
}

function showStatus(message){
  clearTimeout(statusTimer);
  statusBanner.innerText = message;
  statusBanner.classList.remove("hidden");
  statusTimer = setTimeout(() => {
    statusBanner.classList.add("hidden");
  }, 2600);
}

function registerServiceWorker(){
  if(!("serviceWorker" in navigator)){
    return;
  }

  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {
      showStatus("Offline mode could not be enabled.");
    });
  });
}

function setupInstallPrompt(){
  if(window.matchMedia("(display-mode: standalone)").matches){
    return;
  }

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
    installButton.classList.remove("hidden");
  });

  installButton.addEventListener("click", async () => {
    if(!deferredInstallPrompt){
      showStatus("Use your browser menu to add this app to your home screen.");
      return;
    }

    deferredInstallPrompt.prompt();
    const choice = await deferredInstallPrompt.userChoice;
    if(choice.outcome === "accepted"){
      showStatus("FlowLedger is being installed.");
    }
    deferredInstallPrompt = null;
    installButton.classList.add("hidden");
  });

  window.addEventListener("appinstalled", () => {
    installButton.classList.add("hidden");
    showStatus("FlowLedger installed successfully.");
  });
}

function resetForm(){
  form.reset();
  typeInput.value = "expense";
  dateInput.value = getToday();
  recurringInput.checked = false;
  editingId = null;
  formHeading.innerText = "Add Transaction";
  submitButton.innerText = "Add Entry";
  cancelEditButton.classList.add("hidden");
}

function populateForm(entry){
  amountInput.value = entry.amt;
  typeInput.value = entry.type;
  categoryInput.value = entry.cat;
  dateInput.value = entry.date;
  noteInput.value = entry.note;
  recurringInput.checked = entry.recurring;
  editingId = entry.id;
  formHeading.innerText = "Edit Transaction";
  submitButton.innerText = "Save Changes";
  cancelEditButton.classList.remove("hidden");
  amountInput.focus();
}

function getFilteredEntries(){
  const searchValue = searchInput.value.trim().toLowerCase();

  const filtered = entries.filter((entry) => {
    const matchesType = filterTypeInput.value === "all" || entry.type === filterTypeInput.value;
    const matchesMonth = !filterMonthInput.value || entry.date.startsWith(filterMonthInput.value);
    const haystack = `${entry.cat} ${entry.note}`.toLowerCase();
    const matchesSearch = !searchValue || haystack.includes(searchValue);
    return matchesType && matchesMonth && matchesSearch;
  });

  return filtered.sort((a, b) => {
    if(sortByInput.value === "date-asc"){
      return new Date(a.date) - new Date(b.date);
    }
    if(sortByInput.value === "amount-desc"){
      return b.amt - a.amt;
    }
    if(sortByInput.value === "amount-asc"){
      return a.amt - b.amt;
    }
    return new Date(b.date) - new Date(a.date);
  });
}

function buildExpenseMap(source){
  return source.reduce((map, entry) => {
    if(entry.type === "expense"){
      map[entry.cat] = (map[entry.cat] || 0) + entry.amt;
    }
    return map;
  }, {});
}

function getSummaryTotals(source){
  return source.reduce((totals, entry) => {
    if(entry.type === "income"){
      totals.income += entry.amt;
    } else {
      totals.expense += entry.amt;
    }
    return totals;
  }, { income: 0, expense: 0 });
}

function getMonthlyExpenses(month = getToday().slice(0, 7)){
  return entries.reduce((total, entry) => {
    if(entry.type === "expense" && entry.date.startsWith(month)){
      return total + entry.amt;
    }
    return total;
  }, 0);
}

function updateSummary(){
  const totals = getSummaryTotals(entries);
  const balance = totals.income - totals.expense;
  const rate = totals.income > 0 ? Math.max(0, ((balance / totals.income) * 100)) : 0;

  incomeTotal.innerText = formatMoney(totals.income);
  expenseTotal.innerText = formatMoney(totals.expense);
  balanceTotal.innerText = formatMoney(balance);
  savingsRate.innerText = `${Math.round(rate)}%`;

  warningText.innerText = "";
  if(budget > 0 && getMonthlyExpenses() > budget){
    warningText.innerText = "This month is above your budget target.";
    return;
  }

  if(totals.expense > totals.income && totals.income > 0){
    warningText.innerText = "You are overspending overall.";
    return;
  }

  if(totals.income === 0 && totals.expense > 0){
    warningText.innerText = "No income logged yet, so every expense is reducing your balance.";
    return;
  }

  if(totals.income > 0 && totals.expense / totals.income > 0.8){
    warningText.innerText = "Spending is above 80% of total income.";
  }
}

function updateBudget(){
  budgetInput.value = budget || "";

  if(budget <= 0){
    budgetFill.style.width = "0%";
    budgetStatus.innerText = "No budget set yet.";
    return;
  }

  const month = filterMonthInput.value || getToday().slice(0, 7);
  const monthlyExpense = getMonthlyExpenses(month);
  const used = Math.min((monthlyExpense / budget) * 100, 100);
  budgetFill.style.width = `${used}%`;

  if(monthlyExpense > budget){
    budgetStatus.innerText = `${formatMoney(monthlyExpense - budget)} over budget for ${formatMonthLabel(month)}.`;
    return;
  }

  budgetStatus.innerText = `${formatMoney(budget - monthlyExpense)} left for ${formatMonthLabel(month)}.`;
}

function renderAnalytics(){
  const totals = getSummaryTotals(entries);
  const expenses = entries.filter((entry) => entry.type === "expense");
  const recurringCount = entries.filter((entry) => entry.recurring).length;
  const currentMonth = filterMonthInput.value || getToday().slice(0, 7);
  const monthlyEntries = entries.filter((entry) => entry.date.startsWith(currentMonth));
  const expenseMap = buildExpenseMap(expenses);
  const topCategory = Object.entries(expenseMap).sort((a, b) => b[1] - a[1])[0];
  const avgSpend = expenses.length ? totals.expense / expenses.length : 0;
  const monthTotals = getSummaryTotals(monthlyEntries);

  const cards = [
    {
      label: "Top Category",
      value: topCategory ? `${topCategory[0]} • ${formatMoney(topCategory[1])}` : "No expense data yet"
    },
    {
      label: "Average Expense",
      value: expenses.length ? formatMoney(avgSpend) : "No expense data yet"
    },
    {
      label: "Recurring Entries",
      value: recurringCount ? `${recurringCount} recurring tracked` : "No recurring entries yet"
    },
    {
      label: "Monthly Balance",
      value: monthlyEntries.length ? formatMoney(monthTotals.income - monthTotals.expense) : "No entries in focus month"
    }
  ];

  analytics.innerHTML = "";
  cards.forEach((card) => {
    const article = document.createElement("article");
    article.className = "analytics-card";
    article.innerHTML = `
      <span>${card.label}</span>
      <strong>${card.value}</strong>
    `;
    analytics.appendChild(article);
  });
}

function renderBreakdown(map){
  breakdown.innerHTML = "";
  const categories = Object.entries(map).sort((a, b) => b[1] - a[1]);

  if(categories.length === 0){
    breakdown.innerHTML = '<div class="empty-state">Expense categories will show up here once you add spending entries.</div>';
    return;
  }

  categories.forEach(([category, amount]) => {
    const row = document.createElement("div");
    row.className = "breakdown-row";
    row.innerHTML = `
      <span>${category}</span>
      <strong>${formatMoney(amount)}</strong>
    `;
    breakdown.appendChild(row);
  });
}

function drawPieChart(map){
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  legend.innerHTML = "";

  const items = Object.entries(map).sort((a, b) => b[1] - a[1]);
  const total = items.reduce((sum, [, amount]) => sum + amount, 0);

  if(total === 0){
    legend.innerHTML = '<div class="empty-state">The chart fills in as soon as expense categories are available.</div>';
    return;
  }

  let start = -Math.PI / 2;
  items.forEach(([category, amount], index) => {
    const slice = (amount / total) * Math.PI * 2;

    ctx.beginPath();
    ctx.moveTo(160, 160);
    ctx.fillStyle = colors[index % colors.length];
    ctx.arc(160, 160, 120, start, start + slice);
    ctx.closePath();
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = "#fffaf2";
    ctx.stroke();
    start += slice;

    const row = document.createElement("div");
    row.className = "legend-row";
    row.innerHTML = `
      <div class="legend-label">
        <span class="legend-swatch" style="background:${colors[index % colors.length]}"></span>
        <span>${category}</span>
      </div>
      <strong>${formatMoney(amount)}</strong>
    `;
    legend.appendChild(row);
  });
}

function getTrendSeries(){
  const buckets = [];
  const now = new Date();

  for(let offset = 5; offset >= 0; offset -= 1){
    const date = new Date(now.getFullYear(), now.getMonth() - offset, 1);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    buckets.push({
      key,
      label: new Intl.DateTimeFormat("en-IN", { month: "short" }).format(date),
      income: 0,
      expense: 0
    });
  }

  entries.forEach((entry) => {
    const bucket = buckets.find((item) => entry.date.startsWith(item.key));
    if(!bucket){
      return;
    }

    if(entry.type === "income"){
      bucket.income += entry.amt;
    } else {
      bucket.expense += entry.amt;
    }
  });

  return buckets;
}

function drawTrendChart(){
  const ctx = trendCanvas.getContext("2d");
  ctx.clearRect(0, 0, trendCanvas.width, trendCanvas.height);

  const series = getTrendSeries();
  const maxValue = Math.max(...series.flatMap((item) => [item.income, item.expense]), 1);
  const baseY = 180;
  const barWidth = 18;
  const groupGap = 22;
  const startX = 32;

  ctx.font = '12px "Avenir Next", "Segoe UI", sans-serif';
  ctx.fillStyle = "#6f6257";

  series.forEach((item, index) => {
    const x = startX + index * (barWidth * 2 + groupGap);
    const incomeHeight = (item.income / maxValue) * 120;
    const expenseHeight = (item.expense / maxValue) * 120;

    ctx.fillStyle = "#3b8f68";
    ctx.fillRect(x, baseY - incomeHeight, barWidth, incomeHeight);

    ctx.fillStyle = "#dd6b20";
    ctx.fillRect(x + barWidth + 6, baseY - expenseHeight, barWidth, expenseHeight);

    ctx.fillStyle = "#6f6257";
    ctx.fillText(item.label, x - 2, 198);
  });

  ctx.fillStyle = "#3b8f68";
  ctx.fillRect(18, 18, 10, 10);
  ctx.fillStyle = "#2b1f16";
  ctx.fillText("Income", 34, 27);
  ctx.fillStyle = "#dd6b20";
  ctx.fillRect(98, 18, 10, 10);
  ctx.fillStyle = "#2b1f16";
  ctx.fillText("Expense", 114, 27);
}

function renderList(source){
  list.innerHTML = "";
  resultCount.innerText = `${source.length} transaction${source.length === 1 ? "" : "s"}`;
  monthlyFocus.innerText = formatMonthLabel(filterMonthInput.value);

  if(source.length === 0){
    list.innerHTML = '<div class="empty-state">No transactions match these filters yet.</div>';
    return;
  }

  source.forEach((entry) => {
    const item = document.createElement("article");
    item.className = `item ${entry.type}`;
    const sign = entry.type === "income" ? "+" : "-";
    const noteMarkup = entry.note ? `<span class="item-note">${entry.note}</span>` : "";
    const tags = [
      `<span class="tag ${entry.type === "income" ? "income-tag" : "expense-tag"}">${entry.type}</span>`,
      entry.recurring ? '<span class="tag">Recurring</span>' : ""
    ].join("");

    item.innerHTML = `
      <div class="item-main">
        <div class="item-title-row">
          <span class="item-title">${entry.cat}</span>
          <span class="item-date">${entry.date}</span>
        </div>
        ${noteMarkup}
        <div class="item-tags">${tags}</div>
      </div>
      <span class="item-amount">${sign}${formatMoney(entry.amt)}</span>
      <div class="item-actions">
        <button class="edit-btn" type="button" data-action="edit" data-id="${entry.id}">Edit</button>
        <button class="delete-btn" type="button" data-action="delete" data-id="${entry.id}">Delete</button>
      </div>
    `;

    list.appendChild(item);
  });
}

function exportJson(){
  const payload = {
    exportedAt: new Date().toISOString(),
    budget,
    entries
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "flowledger-data.json";
  link.click();
  URL.revokeObjectURL(url);
  showStatus("JSON export is ready.");
}

function exportCsv(){
  const escapeCsv = (value) => `"${String(value).replace(/"/g, '""')}"`;
  const headers = ["date", "type", "category", "amount_inr", "recurring", "note"];
  const rows = entries.map((entry) => [
    escapeCsv(entry.date),
    escapeCsv(entry.type),
    escapeCsv(entry.cat),
    escapeCsv(entry.amt),
    escapeCsv(entry.recurring ? "yes" : "no"),
    escapeCsv(entry.note)
  ]);
  const csv = [headers.join(","), ...rows.map((row) => row.join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "flowledger-data.csv";
  link.click();
  URL.revokeObjectURL(url);
  showStatus("CSV export is ready.");
}

function importData(file){
  const reader = new FileReader();

  reader.onload = () => {
    try{
      const parsed = JSON.parse(reader.result);
      const importedEntries = Array.isArray(parsed) ? parsed : parsed.entries;

      if(!Array.isArray(importedEntries)){
        throw new Error("Invalid format");
      }

      entries = importedEntries.map(normalizeEntry);
      if(!Array.isArray(parsed) && parsed.budget !== undefined){
        budget = Number(parsed.budget) || 0;
      }
      save();
      saveBudget();
      resetForm();
      render();
      showStatus("Import completed successfully.");
    } catch {
      showStatus("Import failed. Please use a valid JSON export.");
    }
  };

  reader.readAsText(file);
}

function renderCategoryPresets(){
  categoryPresetsRoot.innerHTML = "";
  categoryPresets.forEach((category) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "chip";
    button.innerText = category;
    button.addEventListener("click", () => {
      categoryInput.value = category;
      categoryInput.focus();
    });
    categoryPresetsRoot.appendChild(button);
  });
}

function render(){
  const filteredEntries = getFilteredEntries();
  const expenseMap = buildExpenseMap(filteredEntries);

  updateSummary();
  updateBudget();
  renderAnalytics();
  renderList(filteredEntries);
  renderBreakdown(expenseMap);
  drawPieChart(expenseMap);
  drawTrendChart();
}

form.addEventListener("submit", (event) => {
  event.preventDefault();

  const amount = Number(amountInput.value);
  const category = categoryInput.value.trim();

  if(!amount || !category){
    showStatus("Amount and category are required.");
    return;
  }

  const nextEntry = normalizeEntry({
    id: editingId || crypto.randomUUID(),
    amt: amount,
    type: typeInput.value,
    cat: category,
    date: dateInput.value || getToday(),
    note: noteInput.value,
    recurring: recurringInput.checked
  });

  if(editingId){
    entries = entries.map((entry) => entry.id === editingId ? nextEntry : entry);
    showStatus("Transaction updated.");
  } else {
    entries.push(nextEntry);
    showStatus("Transaction added.");
  }

  save();
  resetForm();
  render();
});

cancelEditButton.addEventListener("click", () => {
  resetForm();
  showStatus("Edit cancelled.");
});

saveBudgetButton.addEventListener("click", () => {
  budget = Number(budgetInput.value) || 0;
  saveBudget();
  render();
  showStatus(budget > 0 ? "Budget saved." : "Budget cleared.");
});

list.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action]");
  if(!button){
    return;
  }

  const entry = entries.find((item) => item.id === button.dataset.id);
  if(!entry){
    return;
  }

  if(button.dataset.action === "edit"){
    populateForm(entry);
    showStatus("Editing selected transaction.");
    return;
  }

  entries = entries.filter((item) => item.id !== entry.id);
  save();
  if(editingId === entry.id){
    resetForm();
  }
  render();
  showStatus("Transaction deleted.");
});

[searchInput, filterTypeInput, filterMonthInput, sortByInput].forEach((input) => {
  input.addEventListener(input.tagName === "INPUT" ? "input" : "change", render);
});

clearFiltersButton.addEventListener("click", () => {
  searchInput.value = "";
  filterTypeInput.value = "all";
  filterMonthInput.value = "";
  sortByInput.value = "date-desc";
  render();
  showStatus("Filters cleared.");
});

exportButton.addEventListener("click", exportJson);
exportCsvButton.addEventListener("click", exportCsv);
importTriggerButton.addEventListener("click", () => importInput.click());
importInput.addEventListener("change", (event) => {
  const file = event.target.files[0];
  if(file){
    importData(file);
  }
  importInput.value = "";
});

entries = entries.map(normalizeEntry);
save();
resetForm();
renderCategoryPresets();
render();
registerServiceWorker();
setupInstallPrompt();
