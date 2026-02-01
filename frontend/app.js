const API_BASE = `${window.location.protocol}//${window.location.hostname}:5050`;

const healthStatus = document.getElementById("healthStatus");
const fileSelect = document.getElementById("fileSelect");
const reloadFiles = document.getElementById("reloadFiles");
const analyzeBtn = document.getElementById("analyzeBtn");
const uploadFileInput = document.getElementById("uploadFileInput");
const uploadFileBtn = document.getElementById("uploadFileBtn");
const rawSelect = document.getElementById("rawSelect");
const reloadRaw = document.getElementById("reloadRaw");
const atomizeBtn = document.getElementById("atomizeBtn");
const outPath = document.getElementById("outPath");
const trainSelect = document.getElementById("trainSelect");
const reloadTrain = document.getElementById("reloadTrain");
const trainBtn = document.getElementById("trainBtn");
const splitSelect = document.getElementById("splitSelect");
const reloadSplit = document.getElementById("reloadSplit");
const splitBtn = document.getElementById("splitBtn");
const splitMaxMb = document.getElementById("splitMaxMb");
const reportSelect = document.getElementById("reportSelect");
const reloadReports = document.getElementById("reloadReports");
const openReport = document.getElementById("openReport");
const analysisSelect = document.getElementById("analysisSelect");
const reloadAnalysis = document.getElementById("reloadAnalysis");
const openAnalysis = document.getElementById("openAnalysis");
const trainModal = document.getElementById("trainModal");
const closeModal = document.getElementById("closeModal");
const trainModalBody = document.getElementById("trainModalBody");
const modalTitle = document.getElementById("modalTitle");
const resultsTable = document.getElementById("resultsTable").querySelector("tbody");
const summary = document.getElementById("summary");
const stats = document.getElementById("stats");
const levelFilter = document.getElementById("levelFilter");
const priorityFilter = document.getElementById("priorityFilter");
const searchFilter = document.getElementById("searchFilter");
const clearFilters = document.getElementById("clearFilters");
const groupBy = document.getElementById("groupBy");
const prevPage = document.getElementById("prevPage");
const nextPage = document.getElementById("nextPage");
const pageInfo = document.getElementById("pageInfo");

let lastLogs = [];
let lastResults = [];
let currentPage = 1;
const pageSize = 50;
let filteredLogs = [];
let filteredResults = [];

async function fetchWithTimeout(url, options = {}, timeoutMs = 15000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
}

async function loadHealth() {
  try {
    const res = await fetch(`${API_BASE}/health`);
    const data = await res.json();
    if (data.ok) {
      healthStatus.textContent = "Backend: bereit";
      healthStatus.style.background = "#16a34a";
    } else {
      healthStatus.textContent = "Backend: Fehler";
      healthStatus.style.background = "#dc2626";
    }
  } catch (err) {
    healthStatus.textContent = "Backend: offline";
    healthStatus.style.background = "#dc2626";
  }
}

async function loadFiles() {
  fileSelect.innerHTML = "";
  trainSelect.innerHTML = "";
  splitSelect.innerHTML = "";
  try {
    const res = await fetchWithTimeout(`${API_BASE}/data-files`);
    const data = await res.json();
    const files = data.files || [];
    if (!files.length) {
      const option = document.createElement("option");
      option.textContent = "Keine Dateien gefunden";
      option.value = "";
      fileSelect.appendChild(option);
      const trainOption = option.cloneNode(true);
      trainSelect.appendChild(trainOption);
      const splitOption = option.cloneNode(true);
      splitSelect.appendChild(splitOption);
      analyzeBtn.disabled = true;
      trainBtn.disabled = true;
      splitBtn.disabled = true;
      return;
    }
    files.forEach((file) => {
      const option = document.createElement("option");
      option.value = file.path;
      option.textContent = `${file.name} (${Math.round(file.size / 1024)} KB)`;
      fileSelect.appendChild(option);
      const splitOption = document.createElement("option");
      splitOption.value = file.path;
      splitOption.textContent = `${file.name} (${Math.round(file.size / 1024)} KB)`;
      splitSelect.appendChild(splitOption);
      if (file.name.endsWith(".jsonl")) {
        const trainOption = document.createElement("option");
        trainOption.value = file.path;
        trainOption.textContent = `${file.name} (${Math.round(file.size / 1024)} KB)`;
        trainSelect.appendChild(trainOption);
      }
    });
    analyzeBtn.disabled = !fileSelect.value;
    trainBtn.disabled = !trainSelect.value;
    splitBtn.disabled = !splitSelect.value;
  } catch (err) {
    const option = document.createElement("option");
    option.textContent = "Fehler beim Laden";
    option.value = "";
    fileSelect.appendChild(option);
    const trainOption = option.cloneNode(true);
    trainSelect.appendChild(trainOption);
    const splitOption = option.cloneNode(true);
    splitSelect.appendChild(splitOption);
    analyzeBtn.disabled = true;
    trainBtn.disabled = true;
    splitBtn.disabled = true;
  }
}

async function loadTrainingReports() {
  reportSelect.innerHTML = "";
  try {
    const res = await fetchWithTimeout(`${API_BASE}/training-files`);
    const data = await res.json();
    const files = data.files || [];
    if (!files.length) {
      const option = document.createElement("option");
      option.textContent = "Keine Reports gefunden";
      option.value = "";
      reportSelect.appendChild(option);
      openReport.disabled = true;
      return;
    }
    files.forEach((file) => {
      const option = document.createElement("option");
      option.value = file.path;
      option.textContent = `${file.name} (${Math.round(file.size / 1024)} KB)`;
      reportSelect.appendChild(option);
    });
    openReport.disabled = !reportSelect.value;
  } catch (err) {
    const option = document.createElement("option");
    option.textContent = "Fehler beim Laden";
    option.value = "";
    reportSelect.appendChild(option);
    openReport.disabled = true;
  }
}

async function loadRawFiles() {
  rawSelect.innerHTML = "";
  try {
    const res = await fetchWithTimeout(`${API_BASE}/raw-files`);
    const data = await res.json();
    const files = data.files || [];
    if (!files.length) {
      const option = document.createElement("option");
      option.textContent = "Keine Raw-Dateien gefunden";
      option.value = "";
      rawSelect.appendChild(option);
      return;
    }
    files.forEach((file) => {
      const option = document.createElement("option");
      option.value = file.path;
      option.textContent = `${file.name} (${Math.round(file.size / 1024)} KB)`;
      rawSelect.appendChild(option);
    });
  } catch (err) {
    const option = document.createElement("option");
    option.textContent = "Fehler beim Laden";
    option.value = "";
    rawSelect.appendChild(option);
  }
}

function buildSummary(items) {
  const total = items.length;
  const byPriority = {};
  const byCategory = {};

  items.forEach((item) => {
    if (item.priority) {
      byPriority[item.priority] = (byPriority[item.priority] || 0) + 1;
    }
    if (item.category) {
      byCategory[item.category] = (byCategory[item.category] || 0) + 1;
    }
  });

  summary.innerHTML = "";

  const totalCard = document.createElement("div");
  totalCard.className = "summary-card";
  totalCard.innerHTML = `<h3>Logs</h3><span>${total}</span>`;
  summary.appendChild(totalCard);

  const priorityList = Object.entries(byPriority)
    .sort((a, b) => b[1] - a[1]);

  const categoryList = Object.entries(byCategory)
    .sort((a, b) => b[1] - a[1]);

  priorityList.forEach(([key, value]) => {
    const pct = total ? ((value / total) * 100).toFixed(1) : "0.0";
    const card = document.createElement("div");
    card.className = "summary-card";
    card.innerHTML = `<h3>Priorität: ${key}</h3><span>${value} (${pct}%)</span>`;
    summary.appendChild(card);
  });

  categoryList.forEach(([key, value]) => {
    const pct = total ? ((value / total) * 100).toFixed(1) : "0.0";
    const card = document.createElement("div");
    card.className = "summary-card";
    card.innerHTML = `<h3>Kategorie: ${key}</h3><span>${value} (${pct}%)</span>`;
    summary.appendChild(card);
  });
}

function renderTable(items, logs) {
  resultsTable.innerHTML = "";
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  if (currentPage > totalPages) {
    currentPage = totalPages;
  }
  const start = (currentPage - 1) * pageSize;
  const end = start + pageSize;
  const pageItems = items.slice(start, end);
  const pageLogs = logs.slice(start, end);

  pageInfo.textContent = `Seite ${currentPage} / ${totalPages}`;
  prevPage.disabled = currentPage <= 1;
  nextPage.disabled = currentPage >= totalPages;

  if (!items.length) {
    const row = document.createElement("tr");
    row.innerHTML = `<td colspan="9">Keine Ergebnisse</td>`;
    resultsTable.appendChild(row);
    return;
  }

  if (groupBy.value === "none") {
    pageItems.forEach((item, idx) => {
      const raw = pageLogs[idx] || {};
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${start + idx + 1}</td>
        <td>${raw.message || ""}</td>
        <td>${raw.level || ""}</td>
        <td>${raw.service || ""}</td>
        <td>${raw.route || ""}</td>
        <td>${raw.status_code || ""}</td>
        <td>${item.category || ""}</td>
        <td>${item.priority || ""}</td>
        <td>${item.reason || ""}</td>
      `;
      resultsTable.appendChild(row);
    });
    return;
  }

  const rows = items.map((item, idx) => ({
    item,
    raw: logs[idx] || {},
    index: idx
  }));

  const priorityOrder = ["critical", "high", "medium", "low", "unknown", ""];
  rows.sort((a, b) => {
    const pa = String(a.item.priority || "").toLowerCase();
    const pb = String(b.item.priority || "").toLowerCase();
    return priorityOrder.indexOf(pa) - priorityOrder.indexOf(pb);
  });

  const pageRows = rows.slice(start, end);

  let currentPriority = null;
  let groupCount = 0;
  pageRows.forEach((row, pos) => {
    const prio = String(row.item.priority || "unknown");
    if (prio !== currentPriority) {
      if (currentPriority !== null) {
        const countRow = document.createElement("tr");
        countRow.className = "group-row";
        countRow.innerHTML = `<td colspan="9">${currentPriority}: ${groupCount} Logs</td>`;
        resultsTable.appendChild(countRow);
      }
      currentPriority = prio;
      groupCount = 0;
    }

    groupCount += 1;
    const raw = row.raw;
    const item = row.item;
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${row.index + 1}</td>
      <td>${raw.message || ""}</td>
      <td>${raw.level || ""}</td>
      <td>${raw.service || ""}</td>
      <td>${raw.route || ""}</td>
      <td>${raw.status_code || ""}</td>
      <td>${item.category || ""}</td>
      <td>${item.priority || ""}</td>
      <td>${item.reason || ""}</td>
    `;
    resultsTable.appendChild(tr);

    if (pos === pageRows.length - 1) {
      const countRow = document.createElement("tr");
      countRow.className = "group-row";
      countRow.innerHTML = `<td colspan="9">${currentPriority}: ${groupCount} Logs</td>`;
      resultsTable.appendChild(countRow);
    }
  });
}

function topNFromMap(map, n = 10) {
  return Object.entries(map)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n);
}

function sanitizeMessageKey(message) {
  if (!message) {
    return "";
  }
  return message
    .replace(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2},\d{3}\s*-?\s*/, "")
    .replace(/!+/g, "")
    .trim();
}

function renderStats(logs, results) {
  if (!logs || !logs.length) {
    stats.innerHTML = "";
    return;
  }

  const byRoute = {};
  const byException = {};
  const byStatus = {};
  const byLevel = {};
  const byPriority = {};
  const byCategory = {};
  const byRouteErrors = {};
  const byReason = {};
  const byService = {};
  const byMessage = {};
  const byMessageErrors = {};
  const byMessageCritical = {};
  let missingStatus = 0;

  const exceptionRegex = /(\b[A-Za-z_]+(?:Error|Exception)\b|\bFatal\b|\bFATALER STARTFEHLER\b)/i;
  const reasonPatterns = [
    { regex: /missing authorization header/i, label: "Missing Authorization Header" },
    { regex: /noauthorizationerror/i, label: "NoAuthorizationError" },
    { regex: /forbidden/i, label: "Forbidden" },
    { regex: /unauthorized/i, label: "Unauthorized" },
    { regex: /nameerror/i, label: "NameError" },
    { regex: /typeerror/i, label: "TypeError" },
    { regex: /valueerror/i, label: "ValueError" },
    { regex: /keyerror/i, label: "KeyError" },
    { regex: /indexerror/i, label: "IndexError" },
    { regex: /attributeerror/i, label: "AttributeError" },
    { regex: /validationerror/i, label: "ValidationError" },
    { regex: /jsondecodeerror/i, label: "JSONDecodeError" },
    { regex: /runtimeerror/i, label: "RuntimeError" },
    { regex: /timeout|timeouterror/i, label: "Timeout" },
    { regex: /connection refused/i, label: "Connection Refused" },
    { regex: /connectionerror/i, label: "ConnectionError" },
    { regex: /bad gateway/i, label: "Bad Gateway" },
    { regex: /internal server error/i, label: "Internal Server Error" },
    { regex: /fataler startfehler/i, label: "FATALER STARTFEHLER" },
    { regex: /startfehler/i, label: "Startfehler" },
    { regex: /disk space low/i, label: "Disk space low" },
    { regex: /rate limit exceeded/i, label: "Rate limit exceeded" }
  ];

  logs.forEach((log, idx) => {
    const result = (results && results[idx]) ? results[idx] : {};
    const route = log.route || "";
    if (route) {
      byRoute[route] = (byRoute[route] || 0) + 1;
    }

    const reason = result.reason || log.reason || "";
    const message = log.message || "";
    let exception = reason || "";
    if (!exception) {
      const match = message.match(exceptionRegex);
      if (match) {
        exception = match[0];
      }
    }
    if (exception) {
      byException[exception] = (byException[exception] || 0) + 1;
    }

    let reasonKey = reason;
    if (!reasonKey) {
      const lowerMsg = message.toLowerCase();
      const pattern = reasonPatterns.find((p) => p.regex.test(lowerMsg));
      if (pattern) {
        reasonKey = pattern.label;
      } else if (message.includes("API-Aufrufe werden fehlschlagen")) {
        reasonKey = "API-Aufrufe werden fehlschlagen";
      } else if (message) {
        reasonKey = message.split(":")[0];
      }
    }
    if (reasonKey) {
      byReason[reasonKey] = (byReason[reasonKey] || 0) + 1;
    }

    if (log.status_code != null) {
      const status = String(log.status_code);
      byStatus[status] = (byStatus[status] || 0) + 1;
    } else {
      missingStatus += 1;
    }

    const level = log.level || "";
    if (level) {
      byLevel[level] = (byLevel[level] || 0) + 1;
    }

    const priority = result.priority || log.priority || "";
    if (priority) {
      byPriority[priority] = (byPriority[priority] || 0) + 1;
    }

    const category = result.category || "";
    if (category) {
      byCategory[category] = (byCategory[category] || 0) + 1;
    }

    const isError = ["ERROR", "CRITICAL"].includes(String(level).toUpperCase())
      || ["high", "critical"].includes(String(priority).toLowerCase());
    if (isError && route) {
      byRouteErrors[route] = (byRouteErrors[route] || 0) + 1;
    }

    const service = log.service || "";
    if (service) {
      byService[service] = (byService[service] || 0) + 1;
    }

    const msgKey = sanitizeMessageKey(message).slice(0, 120);
    if (msgKey) {
      byMessage[msgKey] = (byMessage[msgKey] || 0) + 1;
      if (isError) {
        byMessageErrors[msgKey] = (byMessageErrors[msgKey] || 0) + 1;
      }
      const isCritical = String(level).toUpperCase() === "CRITICAL"
        || /fatal|fataler startfehler|startfehler/i.test(message);
      if (isCritical) {
        byMessageCritical[msgKey] = (byMessageCritical[msgKey] || 0) + 1;
      }
    }
  });

  const total = logs.length;
  const sections = [
    { title: "Levels", data: topNFromMap(byLevel) },
    { title: "Priorities (Model)", data: topNFromMap(byPriority) },
    { title: "Kategorien (Model)", data: topNFromMap(byCategory) },
    { title: "Top 10 Gründe", data: topNFromMap(byReason) },
    { title: "Top 10 Error-Endpunkte", data: topNFromMap(byRouteErrors) },
    { title: "Top 10 Endpunkte", data: topNFromMap(byRoute) },
    { title: "Top 10 Exceptions", data: topNFromMap(byException) },
    { title: "Top 10 Services", data: topNFromMap(byService) },
    { title: "Top 10 Messages", data: topNFromMap(byMessage) },
    { title: "Top 10 Error-Messages", data: topNFromMap(byMessageErrors) },
    { title: "Top 10 Critical/Fatal", data: topNFromMap(byMessageCritical) }
  ];

  const statusData = topNFromMap(byStatus);
  if (statusData.length) {
    sections.push({ title: "Top 10 Status", data: statusData });
  }

  stats.innerHTML = "";
  sections.forEach((section) => {
    const card = document.createElement("div");
    card.className = "stats-card";
    const list = section.data
      .map(([key, value]) => {
        const pct = total ? ((value / total) * 100).toFixed(1) : "0.0";
        return `<li>${key} (${value}, ${pct}%)</li>`;
      })
      .join("");
    card.innerHTML = `<h3>${section.title}</h3><ol>${list}</ol>`;
    stats.appendChild(card);
  });

  if (missingStatus > 0) {
    const card = document.createElement("div");
    card.className = "stats-card";
    const pct = total ? ((missingStatus / total) * 100).toFixed(1) : "0.0";
    card.innerHTML = `<h3>Status fehlend</h3><ol><li>${missingStatus} (${pct}%)</li></ol>`;
    stats.appendChild(card);
  }
}

function applyFilters(resetPage = true) {
  const level = levelFilter.value;
  const priority = priorityFilter.value;
  const term = searchFilter.value.trim().toLowerCase();

  const filtered = [];
  const filteredRes = [];
  lastLogs.forEach((log, idx) => {
    const result = lastResults[idx] || {};
    if (level && String(log.level || "").toUpperCase() !== level) {
      return;
    }
    if (priority && String(result.priority || "").toLowerCase() !== priority) {
      return;
    }
    if (term) {
      const hay = `${log.message || ""} ${log.reason || ""} ${log.route || ""}`.toLowerCase();
      if (!hay.includes(term)) {
        return;
      }
    }
    filtered.push(log);
    filteredRes.push(result);
  });

  filteredLogs = filtered;
  filteredResults = filteredRes.filter(Boolean);

  if (resetPage) {
    currentPage = 1;
  }
  renderTable(filteredResults, filteredLogs);
  renderStats(filteredLogs, filteredResults);
}

function formatTrainingReport(report) {
  if (!report) {
    return "";
  }
  const lines = [];
  const sections = [
    { key: "category_report", label: "Kategorie" },
    { key: "priority_report", label: "Priorität" },
    { key: "reason_report", label: "Grund" }
  ];

  sections.forEach(({ key, label }) => {
    const section = report[key];
    if (!section) {
      lines.push(`${label}: kein Report`);
      lines.push("");
      return;
    }
    lines.push(`${label}:`);
    Object.entries(section).forEach(([name, metrics]) => {
      if (typeof metrics === "object") {
        const precision = metrics.precision?.toFixed(2) ?? "-";
        const recall = metrics.recall?.toFixed(2) ?? "-";
        const f1 = metrics["f1-score"]?.toFixed(2) ?? "-";
        const support = metrics.support ?? "-";
        lines.push(`  ${name} | p:${precision} r:${recall} f1:${f1} s:${support}`);
      } else {
        lines.push(`  ${name}: ${metrics}`);
      }
    });
    lines.push("");
  });

  return lines.join("\n");
}

function showReportModal(title, reportText, fileName) {
  modalTitle.textContent = title;
  const header = fileName ? `Report gespeichert: ${fileName}\n\n` : "";
  trainModalBody.textContent = header + reportText;
  trainModal.classList.add("open");
}

async function analyze() {
  const selected = fileSelect.value;
  if (!selected) {
    summary.innerHTML = "<div class=\"summary-card\"><h3>Hinweis</h3><span>Bitte zuerst eine JSONL-Datei auswählen.</span></div>";
    return;
  }
  analyzeBtn.disabled = true;
  analyzeBtn.textContent = "Analysiere...";
  try {
    const res = await fetchWithTimeout(`${API_BASE}/predict-file`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ file_path: selected })
    }, 120000);
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || "Fehler");
    }

    const items = data.results || [];
    buildSummary(items);
    lastLogs = data.logs || [];
    lastResults = items;
    applyFilters();
    await loadAnalysisReports();
    if (data.warnings && data.warnings.length) {
      const warnCard = document.createElement("div");
      warnCard.className = "summary-card";
      warnCard.innerHTML = `<h3>Warnungen</h3><span>${data.warnings.length}</span>`;
      summary.appendChild(warnCard);
    }
  } catch (err) {
    const msg = err.name === "AbortError"
      ? "Request abgebrochen (Timeout). Große Dateien bitte als JSONL verwenden oder in kleinere Dateien splitten."
      : err.message;
    summary.innerHTML = `<div class="summary-card"><h3>Fehler</h3><span>${msg}</span></div>`;
    resultsTable.innerHTML = "";
  } finally {
    analyzeBtn.disabled = false;
    analyzeBtn.textContent = "Analysieren";
  }
}

async function uploadFile() {
  const file = uploadFileInput.files[0];
  if (!file) {
    summary.innerHTML = "<div class=\"summary-card\"><h3>Hinweis</h3><span>Bitte eine Datei auswählen.</span></div>";
    return;
  }
  uploadFileBtn.disabled = true;
  uploadFileBtn.textContent = "Lade hoch...";
  try {
    const form = new FormData();
    form.append("file", file);
    const res = await fetchWithTimeout(`${API_BASE}/upload-file`, {
      method: "POST",
      body: form
    }, 120000);
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || "Fehler");
    }
    summary.innerHTML = `<div class="summary-card"><h3>Upload</h3><span>${data.name} (${Math.round(data.size / 1024)} KB)</span></div>`;
    showReportModal("Upload", `Datei gespeichert in: data/${data.name}`, data.name);
    uploadFileInput.value = "";
    await loadFiles();
    await loadRawFiles();
  } catch (err) {
    summary.innerHTML = `<div class="summary-card"><h3>Fehler</h3><span>${err.message}</span></div>`;
  } finally {
    uploadFileBtn.disabled = false;
    uploadFileBtn.textContent = "Datei hochladen";
  }
}

async function atomize() {
  const selected = rawSelect.value;
  const out = outPath.value.trim();
  if (!selected || !out) {
    summary.innerHTML = "<div class=\"summary-card\"><h3>Hinweis</h3><span>Raw-Datei und Zielname angeben.</span></div>";
    return;
  }
  atomizeBtn.disabled = true;
  atomizeBtn.textContent = "Atomisiere...";
  try {
    const res = await fetchWithTimeout(`${API_BASE}/atomize-file`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ file_path: selected, out_path: out })
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || "Fehler");
    }
    summary.innerHTML = `<div class="summary-card"><h3>Atomisiert</h3><span>${data.count} Logs</span></div>`;
    await loadFiles();
  } catch (err) {
    summary.innerHTML = `<div class="summary-card"><h3>Fehler</h3><span>${err.message}</span></div>`;
  } finally {
    atomizeBtn.disabled = false;
    atomizeBtn.textContent = "Atomisieren";
  }
}

async function trainModels() {
  const selected = trainSelect.value;
  if (!selected) {
    summary.innerHTML = "<div class=\"summary-card\"><h3>Hinweis</h3><span>Bitte eine Trainingsdatei auswählen.</span></div>";
    return;
  }
  trainBtn.disabled = true;
  trainBtn.textContent = "Training läuft...";
  try {
    const res = await fetchWithTimeout(`${API_BASE}/train`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data_path: `data/${selected}` })
    }, 60000);
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || "Fehler");
    }
    summary.innerHTML = "<div class=\"summary-card\"><h3>Training</h3><span>Fertig</span></div>";
    showReportModal("Training Report", formatTrainingReport(data.result || data), data.report_file);
    await loadHealth();
    await loadTrainingReports();
  } catch (err) {
    summary.innerHTML = `<div class="summary-card"><h3>Fehler</h3><span>${err.message}</span></div>`;
  } finally {
    trainBtn.disabled = false;
    trainBtn.textContent = "Training starten";
  }
}

async function openTrainingReport() {
  const name = reportSelect.value;
  if (!name) {
    return;
  }
  try {
    const res = await fetchWithTimeout(`${API_BASE}/training-report?name=${encodeURIComponent(name)}`);
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || "Fehler");
    }
    showReportModal("Training Report", formatTrainingReport(data.report), data.name);
  } catch (err) {
    summary.innerHTML = `<div class="summary-card"><h3>Fehler</h3><span>${err.message}</span></div>`;
  }
}

async function loadAnalysisReports() {
  analysisSelect.innerHTML = "";
  try {
    const res = await fetchWithTimeout(`${API_BASE}/analysis-files`);
    const data = await res.json();
    const files = data.files || [];
    if (!files.length) {
      const option = document.createElement("option");
      option.textContent = "Keine Reports gefunden";
      option.value = "";
      analysisSelect.appendChild(option);
      openAnalysis.disabled = true;
      return;
    }
    files.forEach((file) => {
      const option = document.createElement("option");
      option.value = file.path;
      option.textContent = `${file.name} (${Math.round(file.size / 1024)} KB)`;
      analysisSelect.appendChild(option);
    });
    openAnalysis.disabled = !analysisSelect.value;
  } catch (err) {
    const option = document.createElement("option");
    option.textContent = "Fehler beim Laden";
    option.value = "";
    analysisSelect.appendChild(option);
    openAnalysis.disabled = true;
  }
}

async function openAnalysisReport() {
  const name = analysisSelect.value;
  if (!name) {
    return;
  }
  try {
    const res = await fetchWithTimeout(`${API_BASE}/analysis-report?name=${encodeURIComponent(name)}`);
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || "Fehler");
    }
    const report = data.report || {};
    lastLogs = report.logs || [];
    lastResults = report.results || [];
    buildSummary(lastResults);
    applyFilters(true);
    renderStats(filteredLogs, filteredResults);
    showReportModal("Analyse Report", JSON.stringify(report, null, 2), data.name);
  } catch (err) {
    summary.innerHTML = `<div class="summary-card"><h3>Fehler</h3><span>${err.message}</span></div>`;
  }
}

async function splitFile() {
  const selected = splitSelect.value;
  if (!selected) {
    summary.innerHTML = "<div class=\"summary-card\"><h3>Hinweis</h3><span>Bitte eine Datei auswählen.</span></div>";
    return;
  }
  const maxMb = parseFloat(splitMaxMb.value || "4");
  if (!maxMb || maxMb <= 0) {
    summary.innerHTML = "<div class=\"summary-card\"><h3>Hinweis</h3><span>Max MB muss > 0 sein.</span></div>";
    return;
  }
  splitBtn.disabled = true;
  splitBtn.textContent = "Splitte...";
  try {
    const res = await fetchWithTimeout(`${API_BASE}/split-file`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ file_path: selected, max_mb: maxMb })
    }, 120000);
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || "Fehler");
    }
    summary.innerHTML = `<div class="summary-card"><h3>Split</h3><span>${data.parts.length} Dateien</span></div>`;
    await loadFiles();
  } catch (err) {
    summary.innerHTML = `<div class="summary-card"><h3>Fehler</h3><span>${err.message}</span></div>`;
  } finally {
    splitBtn.disabled = false;
    splitBtn.textContent = "Splitten";
  }
}

reloadFiles.addEventListener("click", loadFiles);
analyzeBtn.addEventListener("click", analyze);
uploadFileBtn.addEventListener("click", uploadFile);
reloadRaw.addEventListener("click", loadRawFiles);
atomizeBtn.addEventListener("click", atomize);
reloadTrain.addEventListener("click", loadFiles);
trainBtn.addEventListener("click", trainModels);
reloadSplit.addEventListener("click", loadFiles);
splitBtn.addEventListener("click", splitFile);
reloadReports.addEventListener("click", loadTrainingReports);
openReport.addEventListener("click", openTrainingReport);
reloadAnalysis.addEventListener("click", loadAnalysisReports);
openAnalysis.addEventListener("click", openAnalysisReport);
fileSelect.addEventListener("change", () => {
  analyzeBtn.disabled = !fileSelect.value;
});
trainSelect.addEventListener("change", () => {
  trainBtn.disabled = !trainSelect.value;
});
splitSelect.addEventListener("change", () => {
  splitBtn.disabled = !splitSelect.value;
});
reportSelect.addEventListener("change", () => {
  openReport.disabled = !reportSelect.value;
});
analysisSelect.addEventListener("change", () => {
  openAnalysis.disabled = !analysisSelect.value;
});
levelFilter.addEventListener("change", applyFilters);
priorityFilter.addEventListener("change", applyFilters);
searchFilter.addEventListener("input", applyFilters);
clearFilters.addEventListener("click", () => {
  levelFilter.value = "";
  priorityFilter.value = "";
  searchFilter.value = "";
  applyFilters();
});

groupBy.addEventListener("change", applyFilters);
prevPage.addEventListener("click", () => {
  if (currentPage > 1) {
    currentPage -= 1;
    applyFilters(false);
  }
});
nextPage.addEventListener("click", () => {
  currentPage += 1;
  applyFilters(false);
});

closeModal.addEventListener("click", () => {
  trainModal.classList.remove("open");
});

loadHealth();
loadFiles();
loadRawFiles();
loadTrainingReports();
loadAnalysisReports();
