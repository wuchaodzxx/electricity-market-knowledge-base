import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { validateKnowledgeBase } from "./validate_knowledge_base.mjs";

const PROVINCES = ["江苏", "浙江", "山西", "湖北", "四川", "山东", "甘肃", "安徽"];
const HERO_ASSET_FILE = "electricity-market-hero.png";
const HERO_ASSET_RELATIVE_PATH = `assets/${HERO_ASSET_FILE}`;
const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const HERO_ASSET_SOURCE_PATH = path.resolve(SCRIPT_DIR, "../assets", HERO_ASSET_FILE);

function joinSourceField(documentIds, documents, field) {
  return documentIds
    .map((documentId) => documents.get(documentId)?.[field] ?? "")
    .filter(Boolean)
    .join("；");
}

function formatAttachments(attachments = []) {
  return attachments
    .map((attachment) => `${attachment.title}|${attachment.localFilePath}`)
    .join("；");
}

function joinSourceAttachments(documentIds, documents) {
  return documentIds
    .map((documentId) => formatAttachments(documents.get(documentId)?.localAttachments ?? []))
    .filter(Boolean)
    .join("；");
}

function buildSheets(store) {
  const documents = new Map(store.policyDocuments.map((document) => [document.id, document]));

  const sheets = [
    {
      name: "基础概念",
      columns: ["概念", "通俗解释", "详细解读", "关联机制", "适用范围", "来源文件", "发文编号", "链接", "查看文件", "附件归档", "核验日期"],
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
          joinSourceAttachments(concept.sourceDocumentIds, documents),
          concept.lastVerifiedAt,
        ],
      })),
    },
    {
      name: "国家政策",
      columns: ["文件标题", "详细解读", "发文编号", "发布单位", "发布日期", "链接", "查看文件", "附件归档", "状态", "最后核验日期"],
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
            formatAttachments(document.localAttachments ?? []),
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
        "附件归档",
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
            joinSourceAttachments(rule.sourceDocumentIds, documents),
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
      --bg: #f3f7fb;
      --bg-radial: radial-gradient(circle at 16% 0%, rgba(20, 184, 166, .16), transparent 34%),
        radial-gradient(circle at 88% 8%, rgba(245, 158, 11, .14), transparent 28%),
        linear-gradient(180deg, #eef6fb 0%, #f8fafc 52%, #eef3f7 100%);
      --card: #ffffff;
      --ink: #101828;
      --muted: #667085;
      --line: #dbe5ee;
      --brand: #07566b;
      --brand-strong: #083344;
      --brand-soft: #e5f5f6;
      --accent: #f6a51a;
      --cyan: #22d3ee;
      --shadow: 0 24px 70px rgba(15, 23, 42, .12);
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
      background: var(--bg-radial);
      color: var(--ink);
    }
    header {
      position: relative;
      min-height: 278px;
      overflow: hidden;
      padding: 34px 32px 84px;
      background-image:
        linear-gradient(90deg, rgba(3, 19, 35, .94) 0%, rgba(6, 41, 61, .82) 34%, rgba(6, 58, 76, .38) 72%, rgba(5, 24, 41, .58) 100%),
        url("${HERO_ASSET_RELATIVE_PATH}");
      background-size: cover;
      background-position: center;
      color: #fff;
    }
    header::before {
      content: "";
      position: absolute;
      inset: 0;
      background:
        radial-gradient(circle at 20% 28%, rgba(34, 211, 238, .24), transparent 32%),
        linear-gradient(180deg, transparent 58%, rgba(243, 247, 251, .96) 100%);
      pointer-events: none;
    }
    header::after {
      content: "";
      position: absolute;
      left: 32px;
      right: 32px;
      bottom: 34px;
      height: 1px;
      background: linear-gradient(90deg, rgba(34, 211, 238, .65), rgba(246, 165, 26, .38), transparent);
      opacity: .8;
    }
    .hero-card {
      position: relative;
      z-index: 1;
      width: min(920px, 100%);
      padding: 28px 30px;
      border: 1px solid rgba(255, 255, 255, .22);
      border-radius: 28px;
      background: linear-gradient(135deg, rgba(8, 51, 68, .62), rgba(8, 83, 102, .24));
      box-shadow: 0 28px 90px rgba(0, 15, 31, .32);
      backdrop-filter: blur(14px);
    }
    .eyebrow {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      margin: 0 0 14px;
      color: #bff7ff;
      font-size: 13px;
      font-weight: 800;
      letter-spacing: .12em;
      text-transform: uppercase;
    }
    .eyebrow::before {
      content: "";
      width: 9px;
      height: 9px;
      border-radius: 999px;
      background: var(--cyan);
      box-shadow: 0 0 18px rgba(34, 211, 238, .95);
    }
    h1 {
      margin: 0 0 12px;
      font-size: clamp(30px, 5vw, 54px);
      line-height: 1.05;
      letter-spacing: -.04em;
    }
    .subhead {
      max-width: 760px;
      margin: 0;
      color: rgba(255, 255, 255, .88);
      line-height: 1.75;
      font-size: 15px;
    }
    .hero-metrics {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      margin-top: 20px;
    }
    .metric-chip {
      display: inline-flex;
      align-items: center;
      gap: 7px;
      border: 1px solid rgba(255, 255, 255, .2);
      border-radius: 999px;
      padding: 8px 12px;
      background: rgba(255, 255, 255, .1);
      color: rgba(255, 255, 255, .92);
      font-size: 13px;
      backdrop-filter: blur(10px);
    }
    .metric-chip strong { color: #fff; }
    main {
      position: relative;
      z-index: 2;
      max-width: 1480px;
      margin: -52px auto 0;
      padding: 0 24px 46px;
    }
    .knowledge-shell {
      border: 1px solid rgba(255, 255, 255, .76);
      border-radius: 28px;
      background: rgba(255, 255, 255, .72);
      box-shadow: var(--shadow);
      backdrop-filter: blur(16px);
      overflow: hidden;
    }
    .toolbar {
      position: sticky;
      top: 0;
      z-index: 10;
      display: grid;
      gap: 12px;
      padding: 18px;
      border-bottom: 1px solid rgba(219, 229, 238, .9);
      background: rgba(248, 250, 252, .86);
      backdrop-filter: blur(16px);
    }
    .tabs {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    .tab {
      border: 1px solid var(--line);
      background: rgba(255, 255, 255, .88);
      border-radius: 999px;
      padding: 9px 15px;
      cursor: pointer;
      color: var(--ink);
      box-shadow: 0 4px 14px rgba(15, 23, 42, .04);
      transition: transform .16s ease, border-color .16s ease, background .16s ease, box-shadow .16s ease;
    }
    .tab:hover {
      transform: translateY(-1px);
      border-color: rgba(34, 211, 238, .42);
      box-shadow: 0 8px 22px rgba(15, 23, 42, .08);
    }
    .tab.active {
      background: linear-gradient(135deg, var(--brand-strong), #0e7490);
      border-color: var(--brand);
      color: #fff;
      font-weight: 700;
      box-shadow: 0 10px 28px rgba(7, 86, 107, .26);
    }
    .search-row {
      display: flex;
      gap: 10px;
      align-items: center;
      flex-wrap: wrap;
    }
    #searchInput {
      width: min(680px, 100%);
      border: 1px solid #cfdbe7;
      border-radius: 16px;
      padding: 13px 16px;
      font-size: 15px;
      background: rgba(255, 255, 255, .94);
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, .9), 0 6px 18px rgba(15, 23, 42, .05);
      outline: none;
    }
    #searchInput:focus {
      border-color: rgba(34, 211, 238, .78);
      box-shadow: 0 0 0 4px rgba(34, 211, 238, .16), 0 8px 22px rgba(15, 23, 42, .08);
    }
    .hint { color: var(--muted); font-size: 13px; }
    .card {
      background: rgba(255, 255, 255, .92);
      border: 0;
      border-radius: 0;
      overflow: hidden;
    }
    .sheet-meta {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      padding: 16px 20px;
      border-bottom: 1px solid var(--line);
      color: var(--muted);
      font-size: 14px;
      background: linear-gradient(90deg, rgba(229, 245, 246, .8), rgba(255, 255, 255, .72));
    }
    .table-wrap { overflow: auto; max-height: calc(100vh - 260px); }
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
      padding: 12px 14px;
      text-align: left;
      vertical-align: top;
      background: rgba(255, 255, 255, .98);
    }
    th {
      position: sticky;
      top: 0;
      z-index: 2;
      background: #eaf3f7;
      color: #274155;
      white-space: nowrap;
      font-size: 13px;
      letter-spacing: .02em;
    }
    tr:hover td { background: #f8fcff; }
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
    a { color: #08738a; text-decoration: none; font-weight: 650; }
    a:hover { text-decoration: underline; }
    .detail-button {
      border: 0;
      border-radius: 999px;
      padding: 8px 12px;
      background: linear-gradient(135deg, #e0fbff, #fff7e6);
      color: #07566b;
      font-weight: 700;
      cursor: pointer;
      white-space: nowrap;
      box-shadow: 0 6px 14px rgba(7, 86, 107, .1);
    }
    .detail-button:hover { outline: 2px solid rgba(34, 211, 238, .34); }
    .modal-backdrop {
      display: none;
      position: fixed;
      inset: 0;
      z-index: 50;
      background: rgba(7, 20, 34, .56);
      padding: 28px;
      backdrop-filter: blur(6px);
    }
    .modal-backdrop.open { display: grid; place-items: center; }
    .modal {
      width: min(980px, 100%);
      max-height: min(760px, 92vh);
      overflow: auto;
      background: linear-gradient(180deg, #ffffff, #fbfdff);
      border-radius: 24px;
      box-shadow: 0 24px 80px rgba(15, 23, 42, .28);
      border: 1px solid rgba(255, 255, 255, .8);
    }
    .modal-header {
      position: sticky;
      top: 0;
      background: rgba(255, 255, 255, .92);
      backdrop-filter: blur(12px);
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
      header { padding: 22px 16px 78px; min-height: 300px; }
      header::after { left: 18px; right: 18px; }
      .hero-card { padding: 22px 18px; border-radius: 22px; }
      main { margin-top: -48px; padding: 0 12px 28px; }
      .knowledge-shell { border-radius: 22px; }
      .toolbar { padding: 14px; }
      .details { grid-template-columns: 1fr; }
      .details dt { border-bottom: 0; padding-bottom: 0; }
      .modal-backdrop { padding: 10px; }
    }
  </style>
</head>
<body>
  <header>
    <section class="hero-card" aria-label="电力市场知识库概览">
      <p class="eyebrow">Electricity Market Knowledge Base</p>
      <h1>电力市场知识库</h1>
      <p class="subhead">面向电力市场小白的政策、概念与省级交易规则知识库。长文本默认折叠，来源链接和本地归档文件可直接跳转查看。</p>
      <div class="hero-metrics" aria-label="知识库元信息">
        <span class="metric-chip">数据更新 <strong>${data.lastUpdatedAt}</strong></span>
        <span class="metric-chip">网页生成 <strong>${data.generatedAt}</strong></span>
        <span class="metric-chip">覆盖 <strong>国家 + 8 省</strong></span>
      </div>
    </section>
  </header>
  <main>
    <section class="knowledge-shell">
      <section class="toolbar" aria-label="筛选工具">
        <div id="tabs" class="tabs"></div>
        <div class="search-row">
          <input id="searchInput" type="search" placeholder="搜索概念、政策、交易品种、文号、适用对象……" />
          <span class="hint">长文本折叠显示，点击“查看详情”阅读完整内容；“链接”跳转官方来源，“查看文件”打开归档 PDF，“附件归档”打开保存的附件。</span>
        </div>
      </section>
      <section class="card">
        <div id="sheetMeta" class="sheet-meta"></div>
        <div id="tableWrap" class="table-wrap"></div>
      </section>
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

    function renderAttachmentLinks(value) {
      const entries = String(value ?? "")
        .split("；")
        .filter(Boolean);
      if (entries.length === 0) return '<span class="hint">未发现附件</span>';
      return entries.map((entry, index) => {
        const separatorIndex = entry.lastIndexOf("|");
        const title = separatorIndex === -1 ? "附件" + (index + 1) : entry.slice(0, separatorIndex);
        const url = separatorIndex === -1 ? entry : entry.slice(separatorIndex + 1);
        return '<a href="' + escapeHtml(url) + '" target="_blank" rel="noopener noreferrer">' + escapeHtml(title || ("附件" + (index + 1))) + '</a>';
      }).join("<br>");
    }

    function renderCell(label, value) {
      if (label === "链接") return renderLinks(value, "官方链接");
      if (label === "查看文件") return renderLinks(value, "查看文件");
      if (label === "附件归档") return renderAttachmentLinks(value);
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
        const value = column === "链接" ? renderLinks(row.values[columnIndex], "官方链接") : column === "查看文件" ? renderLinks(row.values[columnIndex], "查看文件") : column === "附件归档" ? renderAttachmentLinks(row.values[columnIndex]) : escapeHtml(row.values[columnIndex] || "未收录");
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

async function copyWebAssets(outputPath) {
  const assetDir = path.join(path.dirname(outputPath), "assets");
  await fs.mkdir(assetDir, { recursive: true });
  await fs.copyFile(HERO_ASSET_SOURCE_PATH, path.join(assetDir, HERO_ASSET_FILE));
}

export async function exportWebPreview(inputPath, outputPath) {
  const store = JSON.parse(await fs.readFile(inputPath, "utf8"));
  const validationErrors = validateKnowledgeBase(store);
  if (validationErrors.length > 0) {
    throw new Error(`知识库校验失败：\n${validationErrors.join("\n")}`);
  }

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await copyWebAssets(outputPath);
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
