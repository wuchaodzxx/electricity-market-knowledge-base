import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { validateKnowledgeBase } from "./validate_knowledge_base.mjs";

const PROVINCES = ["江苏", "浙江", "山西", "湖北", "四川", "山东", "甘肃", "安徽"];

function joinSourceField(documentIds, documents, field) {
  return documentIds
    .map((documentId) => documents.get(documentId)?.[field] ?? "")
    .filter(Boolean)
    .join("；");
}

function buildSheets(store) {
  const documents = new Map(store.policyDocuments.map((document) => [document.id, document]));

  const sheets = [
    {
      name: "基础概念",
      columns: ["概念", "通俗解释", "详细解读", "关联机制", "适用范围", "来源文件", "发文编号", "链接", "查看文件", "核验日期"],
      rows: store.concepts.map((concept) => ({
        title: concept.name,
        values: [
          concept.name,
          concept.plainExplanation,
          concept.detailedSummary,
          (concept.relatedMechanisms ?? []).join("；"),
          concept.scope,
          joinSourceField(concept.sourceDocumentIds, documents, "title"),
          joinSourceField(concept.sourceDocumentIds, documents, "documentNumber"),
          joinSourceField(concept.sourceDocumentIds, documents, "officialUrl"),
          joinSourceField(concept.sourceDocumentIds, documents, "localFilePath"),
          concept.lastVerifiedAt,
        ],
      })),
    },
    {
      name: "国家政策",
      columns: ["文件标题", "详细解读", "发文编号", "发布单位", "发布日期", "链接", "查看文件", "状态", "最后核验日期"],
      rows: store.policyDocuments
        .filter((document) => document.scope === "国家")
        .map((document) => ({
          title: document.title,
          values: [
            document.title,
            document.detailedSummary,
            document.documentNumber,
            document.issuer,
            document.publishedAt,
            document.officialUrl,
            document.localFilePath,
            document.status,
            document.lastVerifiedAt,
          ],
        })),
    },
  ];

  for (const province of PROVINCES) {
    sheets.push({
      name: province,
      columns: [
        "交易品种",
        "政策/规则总结",
        "适用对象",
        "管理要求",
        "准入条件",
        "参与流程",
        "考核方式",
        "来源文件",
        "发文编号",
        "链接",
        "查看文件",
        "状态",
        "最后核验日期",
      ],
      rows: store.provincialRules
        .filter((rule) => rule.province === province)
        .map((rule) => ({
          title: `${rule.province}｜${rule.tradingProduct}`,
          values: [
            rule.tradingProduct,
            rule.detailedSummary,
            rule.eligibleParticipants,
            rule.managementRequirements,
            rule.admissionCriteria,
            rule.participationProcess,
            rule.assessmentMethod,
            joinSourceField(rule.sourceDocumentIds, documents, "title"),
            joinSourceField(rule.sourceDocumentIds, documents, "documentNumber"),
            joinSourceField(rule.sourceDocumentIds, documents, "officialUrl"),
            joinSourceField(rule.sourceDocumentIds, documents, "localFilePath"),
            rule.status,
            rule.lastVerifiedAt,
          ],
        })),
    });
  }

  sheets.push({
    name: "更新记录",
    columns: ["日期", "类型", "对象 ID", "说明"],
    rows: store.updateEvents.map((event) => ({
      title: `${event.type}｜${event.subjectId}`,
      values: [event.occurredAt, event.type, event.subjectId, event.note],
    })),
  });

  return sheets;
}

function jsonForHtml(value) {
  return JSON.stringify(value).replaceAll("<", "\\u003c").replaceAll(">", "\\u003e").replaceAll("&", "\\u0026");
}

function renderHtml(store) {
  const data = {
    generatedAt: new Date().toISOString().slice(0, 10),
    lastUpdatedAt: store.metadata.lastUpdatedAt,
    sheets: buildSheets(store),
  };

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>电力市场知识库网页预览</title>
  <style>
    :root {
      color-scheme: light;
      --bg: #f6f8fb;
      --card: #ffffff;
      --ink: #18212f;
      --muted: #667085;
      --line: #e5e7eb;
      --brand: #0f4c5c;
      --brand-soft: #e6f3f5;
      --accent: #f59e0b;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
      background: var(--bg);
      color: var(--ink);
    }
    header {
      padding: 28px 32px 18px;
      background: linear-gradient(135deg, #0f4c5c, #167182);
      color: #fff;
    }
    h1 { margin: 0 0 8px; font-size: 28px; }
    .subhead { margin: 0; opacity: .88; }
    main { padding: 18px 24px 40px; }
    .toolbar {
      position: sticky;
      top: 0;
      z-index: 10;
      display: grid;
      gap: 12px;
      padding: 14px 0;
      background: var(--bg);
    }
    .tabs {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    .tab {
      border: 1px solid var(--line);
      background: var(--card);
      border-radius: 999px;
      padding: 8px 14px;
      cursor: pointer;
      color: var(--ink);
    }
    .tab.active {
      background: var(--brand);
      border-color: var(--brand);
      color: #fff;
      font-weight: 700;
    }
    .search-row {
      display: flex;
      gap: 10px;
      align-items: center;
      flex-wrap: wrap;
    }
    #searchInput {
      width: min(680px, 100%);
      border: 1px solid var(--line);
      border-radius: 12px;
      padding: 12px 14px;
      font-size: 15px;
      background: #fff;
    }
    .hint { color: var(--muted); font-size: 13px; }
    .card {
      background: var(--card);
      border: 1px solid var(--line);
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 10px 24px rgba(15, 23, 42, .06);
    }
    .sheet-meta {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      padding: 14px 16px;
      border-bottom: 1px solid var(--line);
      color: var(--muted);
      font-size: 14px;
    }
    .table-wrap { overflow: auto; max-height: calc(100vh - 230px); }
    table {
      border-collapse: separate;
      border-spacing: 0;
      min-width: 1120px;
      width: 100%;
      font-size: 14px;
    }
    th, td {
      border-bottom: 1px solid var(--line);
      border-right: 1px solid #eef0f3;
      padding: 10px 12px;
      text-align: left;
      vertical-align: top;
      background: #fff;
    }
    th {
      position: sticky;
      top: 0;
      z-index: 2;
      background: #f1f5f9;
      color: #344054;
      white-space: nowrap;
    }
    tr:hover td { background: #fbfdff; }
    .clamped-text {
      display: -webkit-box;
      -webkit-line-clamp: 3;
      -webkit-box-orient: vertical;
      overflow: hidden;
      max-width: 360px;
      line-height: 1.55;
    }
    .empty {
      padding: 42px;
      text-align: center;
      color: var(--muted);
    }
    a { color: #0969da; text-decoration: none; }
    a:hover { text-decoration: underline; }
    .detail-button {
      border: 0;
      border-radius: 10px;
      padding: 8px 10px;
      background: var(--brand-soft);
      color: var(--brand);
      font-weight: 700;
      cursor: pointer;
      white-space: nowrap;
    }
    .detail-button:hover { outline: 2px solid #b8dfe5; }
    .modal-backdrop {
      display: none;
      position: fixed;
      inset: 0;
      z-index: 50;
      background: rgba(15, 23, 42, .48);
      padding: 28px;
    }
    .modal-backdrop.open { display: grid; place-items: center; }
    .modal {
      width: min(980px, 100%);
      max-height: min(760px, 92vh);
      overflow: auto;
      background: #fff;
      border-radius: 18px;
      box-shadow: 0 24px 80px rgba(15, 23, 42, .28);
    }
    .modal-header {
      position: sticky;
      top: 0;
      background: #fff;
      display: flex;
      justify-content: space-between;
      gap: 12px;
      align-items: center;
      padding: 18px 20px;
      border-bottom: 1px solid var(--line);
    }
    .modal-title { margin: 0; font-size: 20px; }
    .close-button {
      border: 1px solid var(--line);
      background: #fff;
      border-radius: 10px;
      padding: 8px 12px;
      cursor: pointer;
    }
    .details {
      display: grid;
      grid-template-columns: 140px 1fr;
      gap: 0;
      padding: 6px 20px 22px;
    }
    .details dt, .details dd {
      margin: 0;
      padding: 12px 0;
      border-bottom: 1px solid #f0f2f5;
      line-height: 1.75;
    }
    .details dt { color: var(--muted); font-weight: 700; }
    .details dd { white-space: pre-wrap; }
    .badge {
      display: inline-flex;
      align-items: center;
      border-radius: 999px;
      padding: 2px 8px;
      background: #fff7ed;
      color: #9a3412;
      font-size: 12px;
      font-weight: 700;
    }
    @media (max-width: 720px) {
      header { padding: 22px 18px 16px; }
      main { padding: 12px; }
      .details { grid-template-columns: 1fr; }
      .details dt { border-bottom: 0; padding-bottom: 0; }
      .modal-backdrop { padding: 10px; }
    }
  </style>
</head>
<body>
  <header>
    <h1>电力市场知识库</h1>
    <p class="subhead">网页预览 · 数据更新日期：${data.lastUpdatedAt} · 生成日期：${data.generatedAt}</p>
  </header>
  <main>
    <section class="toolbar" aria-label="筛选工具">
      <div id="tabs" class="tabs"></div>
      <div class="search-row">
        <input id="searchInput" type="search" placeholder="搜索概念、政策、交易品种、文号、适用对象……" />
        <span class="hint">长文本默认折叠，点击“查看详情”阅读完整内容；“链接”跳转官方来源，“查看文件”打开本站归档副本。</span>
      </div>
    </section>
    <section class="card">
      <div id="sheetMeta" class="sheet-meta"></div>
      <div id="tableWrap" class="table-wrap"></div>
    </section>
  </main>
  <div id="detailModal" class="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="modalTitle">
    <article class="modal">
      <div class="modal-header">
        <h2 id="modalTitle" class="modal-title">详情</h2>
        <button class="close-button" type="button" onclick="closeModal()">关闭</button>
      </div>
      <dl id="modalDetails" class="details"></dl>
    </article>
  </div>
  <script>
    const appData = ${jsonForHtml(data)};
    let activeSheetIndex = 0;
    let visibleRows = [];

    const longLabels = new Set(["详细解读", "政策/规则总结", "通俗解释", "适用对象", "管理要求", "准入条件", "参与流程", "考核方式", "说明"]);
    const tabs = document.getElementById("tabs");
    const tableWrap = document.getElementById("tableWrap");
    const searchInput = document.getElementById("searchInput");
    const sheetMeta = document.getElementById("sheetMeta");
    const modal = document.getElementById("detailModal");
    const modalTitle = document.getElementById("modalTitle");
    const modalDetails = document.getElementById("modalDetails");

    function escapeHtml(value) {
      return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
    }

    function renderLinks(value, linkText) {
      return String(value ?? "")
        .split("；")
        .filter(Boolean)
        .map((url, index) => '<a href="' + escapeHtml(url) + '" target="_blank" rel="noopener noreferrer">' + linkText + (index + 1) + '</a>')
        .join("<br>");
    }

    function renderCell(label, value) {
      if (label === "链接") return renderLinks(value, "官方链接");
      if (label === "查看文件") return renderLinks(value, "查看文件");
      const safe = escapeHtml(value);
      if (longLabels.has(label) || safe.length > 90) return '<div class="clamped-text">' + safe + '</div>';
      if (label === "状态" && value === "待核验") return '<span class="badge">待核验</span>';
      return safe || '<span class="hint">未收录</span>';
    }

    function rowSearchText(sheet, row) {
      return sheet.columns.concat(row.values).join(" ").toLowerCase();
    }

    function renderTabs() {
      tabs.innerHTML = appData.sheets.map((sheet, index) => {
        const active = index === activeSheetIndex ? " active" : "";
        return '<button class="tab' + active + '" type="button" onclick="switchSheet(' + index + ')">' + escapeHtml(sheet.name) + '</button>';
      }).join("");
    }

    function renderTable() {
      const sheet = appData.sheets[activeSheetIndex];
      const query = searchInput.value.trim().toLowerCase();
      visibleRows = sheet.rows.filter((row) => !query || rowSearchText(sheet, row).includes(query));
      sheetMeta.innerHTML = '<span>当前页：<strong>' + escapeHtml(sheet.name) + '</strong></span><span>显示 ' + visibleRows.length + ' / ' + sheet.rows.length + ' 条</span>';

      if (visibleRows.length === 0) {
        tableWrap.innerHTML = '<div class="empty">没有匹配记录</div>';
        return;
      }

      const header = sheet.columns.map((column) => '<th>' + escapeHtml(column) + '</th>').join("") + '<th>详情</th>';
      const rows = visibleRows.map((row, rowIndex) => {
        const cells = sheet.columns
          .map((column, columnIndex) => '<td>' + renderCell(column, row.values[columnIndex]) + '</td>')
          .join("");
        return '<tr>' + cells + '<td><button class="detail-button" type="button" data-detail-index="' + rowIndex + '" onclick="openDetail(' + rowIndex + ')">查看详情</button></td></tr>';
      }).join("");
      tableWrap.innerHTML = '<table><thead><tr>' + header + '</tr></thead><tbody>' + rows + '</tbody></table>';
    }

    function switchSheet(index) {
      activeSheetIndex = index;
      searchInput.value = "";
      renderTabs();
      renderTable();
    }

    function openDetail(rowIndex) {
      const sheet = appData.sheets[activeSheetIndex];
      const row = visibleRows[rowIndex];
      modalTitle.textContent = row.title || sheet.name;
      modalDetails.innerHTML = sheet.columns.map((column, columnIndex) => {
        const value = column === "链接" ? renderLinks(row.values[columnIndex], "官方链接") : column === "查看文件" ? renderLinks(row.values[columnIndex], "查看文件") : escapeHtml(row.values[columnIndex] || "未收录");
        return '<dt>' + escapeHtml(column) + '</dt><dd>' + value + '</dd>';
      }).join("");
      modal.classList.add("open");
    }

    function closeModal() {
      modal.classList.remove("open");
    }

    modal.addEventListener("click", (event) => {
      if (event.target === modal) closeModal();
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeModal();
    });
    searchInput.addEventListener("input", renderTable);

    renderTabs();
    renderTable();
  </script>
</body>
</html>`;
}

export async function exportWebPreview(inputPath, outputPath) {
  const store = JSON.parse(await fs.readFile(inputPath, "utf8"));
  const validationErrors = validateKnowledgeBase(store);
  if (validationErrors.length > 0) {
    throw new Error(`知识库校验失败：\n${validationErrors.join("\n")}`);
  }

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, renderHtml(store), "utf8");
}

function readOption(name) {
  const position = process.argv.indexOf(name);
  return position === -1 ? undefined : process.argv[position + 1];
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const inputPath = readOption("--input");
  const outputPath = readOption("--output");
  if (!inputPath || !outputPath) {
    throw new Error("用法：node export_web_preview.mjs --input <知识库.json> --output <网页预览.html>");
  }
  await exportWebPreview(inputPath, outputPath);
}
