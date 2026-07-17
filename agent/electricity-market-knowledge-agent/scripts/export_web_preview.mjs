import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath, pathToFileURL } from "node:url";
import { validateKnowledgeBase } from "./validate_knowledge_base.mjs";

const PROVINCES = [
  "北京",
  "天津",
  "河北",
  "山西",
  "内蒙古",
  "山东",
  "辽宁",
  "吉林",
  "黑龙江",
  "上海",
  "江苏",
  "浙江",
  "安徽",
  "福建",
  "河南",
  "湖北",
  "湖南",
  "江西",
  "重庆",
  "四川",
  "西藏",
  "陕西",
  "甘肃",
  "青海",
  "宁夏",
  "新疆",
  "广东",
  "广西",
  "海南",
  "贵州",
  "云南",
];
const HERO_ASSET_FILE = "electricity-market-hero.png";
const HERO_ASSET_RELATIVE_PATH = `assets/${HERO_ASSET_FILE}`;
const LOGO_ASSET_FILE = "electricity-market-logo.png";
const LOGO_ASSET_RELATIVE_PATH = `assets/${LOGO_ASSET_FILE}`;
const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const HERO_ASSET_SOURCE_PATH = path.resolve(SCRIPT_DIR, "../assets", HERO_ASSET_FILE);
const LOGO_ASSET_SOURCE_PATH = path.resolve(SCRIPT_DIR, "../assets", LOGO_ASSET_FILE);
const POLICY_COLUMNS = ["文件标题", "知识摘要", "发文编号", "发布单位", "发布日期", "链接", "查看文件", "附件归档", "状态", "最后核验日期"];
const ALL_POLICY_COLUMNS = ["文件标题", "知识摘要", "发文编号", "发布单位", "发布日期", "适用范围", "链接", "查看文件", "附件归档", "状态", "最后核验日期"];

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

function markdownEntriesForDocument(document) {
  const entries = [];
  if (document.markdownFilePath) {
    entries.push({
      title: "政策正文",
      sourceTitle: document.title,
      markdownFilePath: document.markdownFilePath,
      sourceFilePath: document.localFilePath,
      extraction: document.markdownExtraction,
    });
  }
  for (const attachment of document.attachmentMarkdownFiles ?? []) {
    entries.push({
      title: attachment.title,
      sourceTitle: document.title,
      markdownFilePath: attachment.markdownFilePath,
      sourceFilePath: attachment.sourceFilePath,
      extraction: attachment.extraction,
    });
  }
  return entries;
}

function compareByPublishedAtDesc(left, right) {
  return String(right.publishedAt ?? "").localeCompare(String(left.publishedAt ?? ""));
}

function joinSourceAttachments(documentIds, documents) {
  return documentIds
    .map((documentId) => formatAttachments(documents.get(documentId)?.localAttachments ?? []))
    .filter(Boolean)
    .join("；");
}

function policyRow(document) {
  return {
    title: document.title,
    detail: document.detailedSummary,
    browserFiles: markdownEntriesForDocument(document),
    values: [
      document.title,
      document.knowledgeSummary,
      document.documentNumber,
      document.issuer,
      document.publishedAt,
      document.officialUrl,
      document.localFilePath,
      formatAttachments(document.localAttachments ?? []),
      document.status,
      document.lastVerifiedAt,
    ],
  };
}

function allPolicyRow(document) {
  return {
    ...policyRow(document),
    values: [
      document.title,
      document.knowledgeSummary,
      document.documentNumber,
      document.issuer,
      document.publishedAt,
      document.scope,
      document.officialUrl,
      document.localFilePath,
      formatAttachments(document.localAttachments ?? []),
      document.status,
      document.lastVerifiedAt,
    ],
  };
}

function buildSheets(store) {
  const documents = new Map(store.policyDocuments.map((document) => [document.id, document]));
  const sortedPolicyDocuments = [...store.policyDocuments].sort(compareByPublishedAtDesc);

  const sheets = [
    {
      name: "基础概念",
      columns: ["概念", "通俗解释", "知识摘要", "关联机制", "适用范围", "来源文件", "发文编号", "链接", "查看文件", "附件归档", "核验日期"],
      rows: store.concepts.map((concept) => ({
        title: concept.name,
        detail: concept.detailedSummary,
        browserFiles: concept.sourceDocumentIds.flatMap((documentId) => markdownEntriesForDocument(documents.get(documentId) ?? {})),
        values: [
          concept.name,
          concept.plainExplanation,
          concept.knowledgeSummary,
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
      name: "全部",
      columns: ALL_POLICY_COLUMNS,
      rows: sortedPolicyDocuments.map((document) => allPolicyRow(document)),
    },
    {
      name: "国家政策",
      columns: POLICY_COLUMNS,
      rows: sortedPolicyDocuments
        .filter((document) => document.scope === "国家")
        .map((document) => policyRow(document)),
    },
  ];

  for (const province of PROVINCES) {
    sheets.push({
      name: province,
      columns: POLICY_COLUMNS,
      rows: sortedPolicyDocuments
        .filter((document) => document.scope === province)
        .map((document) => policyRow(document)),
    });
  }

  sheets.push({
    name: "更新记录",
    columns: ["日期", "类型", "对象 ID", "说明"],
    rows: [...store.updateEvents].sort((left, right) => String(right.occurredAt ?? "").localeCompare(String(left.occurredAt ?? ""))).map((event) => ({
      title: `${event.type}｜${event.subjectId}`,
      values: [event.occurredAt, event.type, event.subjectId, event.note],
    })),
  });

  return sheets;
}

function jsonForHtml(value) {
  return JSON.stringify(value).replaceAll("<", "\\u003c").replaceAll(">", "\\u003e").replaceAll("&", "\\u0026");
}

function renderHtml(store, options = {}) {
  const assetVersion = options.assetVersion ? `?v=${options.assetVersion}` : "";
  const heroAssetUrl = `${HERO_ASSET_RELATIVE_PATH}${assetVersion}`;
  const logoAssetUrl = `${LOGO_ASSET_RELATIVE_PATH}${assetVersion}`;
  const data = {
    generatedAt: options.generatedAt ?? new Date().toISOString().slice(0, 10),
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
      height: 100vh;
      overflow: hidden;
    }
    .app-header {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      z-index: 30;
      height: 70px;
      overflow: hidden;
      padding: 0 24px;
      background-image:
        linear-gradient(90deg, rgba(3, 19, 35, .94) 0%, rgba(6, 41, 61, .82) 34%, rgba(6, 58, 76, .38) 72%, rgba(5, 24, 41, .58) 100%),
        url("${heroAssetUrl}");
      background-size: cover;
      background-position: center 42%;
      color: #fff;
      box-shadow: 0 14px 40px rgba(7, 20, 34, .22);
    }
    .app-header::before {
      content: "";
      position: absolute;
      inset: 0;
      background:
        radial-gradient(circle at 24% 38%, rgba(34, 211, 238, .22), transparent 34%),
        linear-gradient(180deg, rgba(255,255,255,.03), rgba(0, 18, 32, .16));
      pointer-events: none;
    }
    .app-header::after {
      content: "";
      position: absolute;
      left: 24px;
      right: 24px;
      bottom: 0;
      height: 1px;
      background: linear-gradient(90deg, rgba(34, 211, 238, .65), rgba(246, 165, 26, .38), transparent);
      opacity: .8;
    }
    .hero-card {
      position: relative;
      z-index: 1;
      height: 70px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 22px;
      width: min(1480px, 100%);
      margin: 0 auto;
      padding: 0 4px;
      border: 1px solid rgba(255, 255, 255, .22);
      border-width: 0 1px;
      border-radius: 0;
      background: linear-gradient(135deg, rgba(8, 51, 68, .18), rgba(8, 83, 102, .08));
      box-shadow: none;
      backdrop-filter: blur(14px);
    }
    .header-title-block {
      display: grid;
      grid-template-columns: auto minmax(220px, 1fr);
      align-items: baseline;
      gap: 14px;
      min-width: 0;
      flex: 1 1 auto;
    }
    .header-brand {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      min-width: 0;
    }
    .header-logo {
      width: 40px;
      height: 40px;
      object-fit: contain;
      flex: 0 0 auto;
      border-radius: 12px;
      filter: drop-shadow(0 7px 16px rgba(0, 0, 0, .28));
    }
    .header-title-block h1 {
      margin: 0;
      font-size: 23px;
      line-height: 1;
      letter-spacing: -.03em;
      white-space: nowrap;
      text-shadow: 0 8px 24px rgba(0, 0, 0, .28);
    }
    .header-meta {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 8px;
      margin: 0;
      flex: 0 0 auto;
    }
    .meta-chip {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      border: 1px solid rgba(255, 255, 255, .18);
      border-radius: 12px;
      padding: 5px 9px;
      background: rgba(4, 28, 44, .24);
      color: rgba(255, 255, 255, .92);
      font-size: 11px;
      white-space: nowrap;
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, .12);
    }
    .meta-chip strong { color: #fff; font-size: 12px; }
    main {
      position: fixed;
      top: 70px;
      left: 0;
      right: 0;
      bottom: 0;
      z-index: 2;
      max-width: 1480px;
      margin: 0 auto;
      padding: 14px 24px 24px;
      display: flex;
      min-height: 0;
    }
    .knowledge-shell {
      width: 100%;
      display: flex;
      flex-direction: column;
      min-height: 0;
      border: 1px solid rgba(255, 255, 255, .76);
      border-radius: 22px;
      background: rgba(255, 255, 255, .72);
      box-shadow: var(--shadow);
      backdrop-filter: blur(16px);
      overflow: hidden;
    }
    .toolbar {
      flex: 0 0 auto;
      z-index: 10;
      display: block;
      padding: 10px 12px;
      border-bottom: 1px solid rgba(219, 229, 238, .9);
      background: rgba(248, 250, 252, .86);
      backdrop-filter: blur(16px);
    }
    .compact-toolbar,
    .toolbar-row {
      display: flex;
      align-items: center;
      gap: 10px;
      min-width: 0;
    }
    .tabs {
      display: flex;
      flex: 1 1 auto;
      gap: 6px;
      padding: 2px 0;
      min-width: 0;
    }
    .tab-shell {
      flex: 1 1 auto;
      min-width: 0;
      display: flex;
      align-items: flex-start;
      gap: 8px;
      position: relative;
    }
    .primary-tabs {
      flex: 1 1 auto;
      flex-wrap: wrap;
      align-items: center;
      max-height: 42px;
      overflow: hidden;
    }
    .province-toggle {
      flex: 0 0 auto;
      min-height: 38px;
      border: 1px solid rgba(7, 86, 107, .18);
      border-radius: 999px;
      padding: 7px 12px;
      background: linear-gradient(135deg, #ffffff, #eefcff);
      color: #07566b;
      font-weight: 800;
      cursor: pointer;
      white-space: nowrap;
      box-shadow: 0 6px 16px rgba(7, 86, 107, .08);
      transition: transform .16s ease, box-shadow .16s ease, border-color .16s ease;
    }
    .province-toggle:hover,
    .province-toggle:focus {
      transform: translateY(-1px);
      border-color: rgba(34, 211, 238, .55);
      outline: none;
      box-shadow: 0 10px 24px rgba(7, 86, 107, .13);
    }
    .toggle-chevron {
      display: inline-block;
      margin-left: 4px;
      transition: transform .18s ease;
    }
    .province-toggle[aria-expanded="true"] .toggle-chevron {
      transform: rotate(180deg);
    }
    .update-tab {
      flex: 0 0 auto;
    }
    .province-panel {
      position: absolute;
      top: calc(100% + 8px);
      right: 0;
      left: 0;
      z-index: 20;
      padding: 12px;
      border: 1px solid rgba(207, 219, 231, .94);
      border-radius: 18px;
      background: rgba(255, 255, 255, .97);
      box-shadow: 0 18px 44px rgba(15, 23, 42, .18);
      backdrop-filter: blur(16px);
    }
    .province-panel[hidden] { display: none; }
    .province-tab-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(74px, 1fr));
      gap: 8px;
    }
    .tab {
      border: 1px solid var(--line);
      background: rgba(255, 255, 255, .88);
      border-radius: 999px;
      padding: 7px 12px;
      cursor: pointer;
      color: var(--ink);
      white-space: nowrap;
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
    #searchInput {
      flex: 0 0 clamp(240px, 28vw, 420px);
      border: 1px solid #cfdbe7;
      border-radius: 999px;
      padding: 10px 14px;
      font-size: 14px;
      background: rgba(255, 255, 255, .94);
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, .9), 0 6px 18px rgba(15, 23, 42, .05);
      outline: none;
    }
    #searchInput:focus {
      border-color: rgba(34, 211, 238, .78);
      box-shadow: 0 0 0 4px rgba(34, 211, 238, .16), 0 8px 22px rgba(15, 23, 42, .08);
    }
    .hint { color: var(--muted); font-size: 13px; }
    .result-meta {
      flex: 0 0 auto;
      color: var(--muted);
      font-size: 12px;
      white-space: nowrap;
    }
    .card {
      flex: 1 1 auto;
      display: flex;
      flex-direction: column;
      min-height: 0;
      background: rgba(255, 255, 255, .92);
      border: 0;
      border-radius: 0;
      overflow: hidden;
    }
    .table-wrap,
    .table-scroll-region {
      flex: 1 1 auto;
      min-height: 0;
      overflow: auto;
      max-height: none;
    }
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
    .summary-tooltip {
      cursor: pointer;
      border: 0;
      border-bottom: 1px dotted rgba(7, 86, 107, .38);
      background: transparent;
      color: inherit;
      font: inherit;
      text-align: left;
      padding: 0;
      width: 100%;
    }
    .summary-tooltip:hover,
    .summary-tooltip:focus {
      color: #07566b;
      outline: none;
      border-bottom-color: rgba(246, 165, 26, .9);
    }
    .summary-popover {
      display: none;
      position: fixed;
      z-index: 80;
      max-width: min(520px, calc(100vw - 28px));
      max-height: min(320px, calc(100vh - 28px));
      overflow: auto;
      padding: 14px 16px;
      border: 1px solid #d9e7ef;
      border-radius: 16px;
      background: rgba(255, 255, 255, .98);
      color: #223448;
      line-height: 1.75;
      font-size: 14px;
      box-shadow: 0 20px 50px rgba(15, 23, 42, .22);
      backdrop-filter: blur(12px);
    }
    .summary-popover.open { display: block; }
    .summary-popover::before {
      content: "知识摘要";
      display: block;
      margin-bottom: 6px;
      color: #07566b;
      font-weight: 800;
      font-size: 13px;
      letter-spacing: .02em;
    }
    .summary-popover strong {
      color: #083344;
      background: linear-gradient(180deg, transparent 58%, rgba(34, 211, 238, .22) 0);
      padding: 0 2px;
    }
    .summary-popover mark {
      border-radius: 6px;
      padding: 1px 4px;
      background: #fff1c2;
      color: #7c2d12;
    }
    .summary-popover code {
      border-radius: 6px;
      padding: 1px 5px;
      background: #edf5f7;
      color: #07566b;
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      font-size: .92em;
    }
    .summary-popover ul {
      margin: 6px 0 0;
      padding-left: 20px;
    }
    .summary-popover li { margin: 4px 0; }
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
    .browse-button {
      border: 1px solid rgba(7, 86, 107, .18);
      border-radius: 999px;
      padding: 8px 12px;
      background: #fff;
      color: #07566b;
      font-weight: 700;
      cursor: pointer;
      white-space: nowrap;
      box-shadow: 0 6px 14px rgba(7, 86, 107, .06);
      margin-left: 6px;
    }
    .browse-button:hover { outline: 2px solid rgba(246, 165, 26, .3); }
    .browse-button[disabled] {
      opacity: .42;
      cursor: not-allowed;
    }
    .action-cell {
      min-width: 182px;
      white-space: nowrap;
    }
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
    .detail-body {
      padding: 18px 22px 28px;
      color: #263546;
      line-height: 1.82;
      font-size: 15px;
    }
    .detail-section {
      margin: 0 0 18px;
      padding: 16px 18px;
      border: 1px solid #e4edf4;
      border-radius: 16px;
      background: linear-gradient(180deg, #ffffff, #f8fcff);
    }
    .detail-section h3 {
      margin: 0 0 10px;
      color: #07566b;
      font-size: 17px;
    }
    .detail-section p { margin: 8px 0; }
    .detail-section ul {
      margin: 8px 0 0;
      padding-left: 22px;
    }
    .detail-section li { margin: 6px 0; }
    .detail-section strong {
      color: #083344;
      background: linear-gradient(180deg, transparent 58%, rgba(34, 211, 238, .22) 0);
      padding: 0 2px;
    }
    mark {
      border-radius: 6px;
      padding: 1px 4px;
      background: #fff1c2;
      color: #7c2d12;
    }
    .markdown-browser-body {
      padding: 18px 22px 28px;
      color: #263546;
      line-height: 1.82;
      font-size: 15px;
    }
    .markdown-source-list {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-bottom: 14px;
      padding-bottom: 14px;
      border-bottom: 1px solid var(--line);
    }
    .markdown-source-tab {
      border: 1px solid #dce8ef;
      border-radius: 999px;
      padding: 7px 11px;
      background: #fff;
      color: #07566b;
      font-weight: 700;
      cursor: pointer;
    }
    .markdown-source-tab.active {
      background: linear-gradient(135deg, #e0fbff, #fff7e6);
      border-color: rgba(34, 211, 238, .5);
    }
    .markdown-content {
      border: 1px solid #e4edf4;
      border-radius: 16px;
      padding: 18px;
      background: #fff;
      max-height: 62vh;
      overflow: auto;
    }
    .markdown-content h1,
    .markdown-content h2,
    .markdown-content h3 {
      color: #07566b;
      line-height: 1.35;
    }
    .markdown-content pre {
      overflow: auto;
      border-radius: 12px;
      padding: 12px;
      background: #f1f7f9;
    }
    .markdown-content code {
      border-radius: 6px;
      padding: 1px 5px;
      background: #edf5f7;
      color: #07566b;
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      font-size: .92em;
    }
    .markdown-content table {
      min-width: 0;
      width: 100%;
      font-size: 13px;
      border-collapse: collapse;
    }
    .markdown-content th,
    .markdown-content td {
      position: static;
      padding: 8px 10px;
      border: 1px solid #e4edf4;
      background: #fff;
    }
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
      .app-header { padding: 0 12px; }
      .app-header::after { left: 12px; right: 12px; }
      .hero-card { gap: 10px; }
      .header-title-block { grid-template-columns: 1fr; gap: 4px; }
      .header-logo { width: 32px; height: 32px; border-radius: 10px; }
      .header-title-block h1 { font-size: 20px; }
      .header-meta .meta-chip:nth-child(n+2) { display: none; }
      main { padding: 10px 10px 16px; }
      .knowledge-shell { border-radius: 18px; }
      .toolbar { padding: 8px; }
      .toolbar-row { flex-wrap: wrap; }
      #searchInput { flex: 1 1 100%; }
      .tab-shell { order: 2; flex-basis: 100%; flex-wrap: wrap; }
      .primary-tabs { max-height: none; }
      .province-panel { position: static; flex-basis: 100%; width: 100%; margin-top: 8px; }
      .modal-backdrop { padding: 10px; }
    }
  </style>
</head>
<body>
  <header class="app-header">
    <section class="hero-card" aria-label="电力市场知识库概览">
      <div class="header-title-block">
        <div class="header-brand">
          <img class="header-logo" src="${logoAssetUrl}" alt="" aria-hidden="true" />
          <h1>电力市场知识库</h1>
        </div>
      </div>
      <div class="header-meta" aria-label="知识库元信息">
        <span class="meta-chip">数据更新 <strong>${data.lastUpdatedAt}</strong></span>
        <span class="meta-chip">网页生成 <strong>${data.generatedAt}</strong></span>
        <span class="meta-chip">覆盖 <strong>国家 + 大陆31省级行政区</strong></span>
      </div>
    </section>
  </header>
  <main class="fixed-workbench">
    <section class="knowledge-shell">
      <section class="toolbar" aria-label="筛选工具">
        <div class="compact-toolbar toolbar-row">
          <input id="searchInput" type="search" placeholder="搜索概念、政策、交易品种、文号、适用对象……" />
          <div id="tabs" class="tab-shell">
            <div id="primaryTabs" class="tabs primary-tabs"></div>
            <button id="provinceToggle" class="province-toggle" type="button" aria-expanded="false" aria-controls="provinceTabs" onclick="toggleProvincePanel()"><span class="province-toggle-label">展开省份</span><span class="toggle-chevron" aria-hidden="true">▾</span></button>
            <button id="updateTab" class="tab update-tab" type="button" onclick="switchSheet(appData.sheets.length - 1)">更新记录</button>
            <div id="provinceTabs" class="province-panel" hidden></div>
          </div>
          <span id="resultMeta" class="result-meta"></span>
        </div>
      </section>
      <section class="card">
        <div id="tableWrap" class="table-wrap table-scroll-region"></div>
      </section>
    </section>
  </main>
  <div id="summaryPopover" class="summary-popover" role="tooltip"></div>
  <div id="detailModal" class="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="modalTitle">
    <article class="modal">
      <div class="modal-header">
        <h2 id="modalTitle" class="modal-title">详情</h2>
        <button class="close-button" type="button" onclick="closeModal()">关闭</button>
      </div>
      <div id="modalDetails" class="detail-body"></div>
    </article>
  </div>
  <div id="knowledgeBrowserModal" class="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="browserTitle">
    <article class="modal">
      <div class="modal-header">
        <h2 id="browserTitle" class="modal-title">知识浏览</h2>
        <button class="close-button" type="button" onclick="closeKnowledgeBrowser()">关闭</button>
      </div>
      <div id="browserDetails" class="markdown-browser-body"></div>
    </article>
  </div>
  <script>
    const appData = ${jsonForHtml(data)};
    let activeSheetIndex = 0;
    let visibleRows = [];
    let provinceTabsExpanded = false;

    const longLabels = new Set(["知识摘要", "政策/规则总结", "通俗解释", "适用对象", "管理要求", "准入条件", "参与流程", "考核方式", "说明"]);
    const tabs = document.getElementById("tabs");
    const primaryTabs = document.getElementById("primaryTabs");
    const provinceTabs = document.getElementById("provinceTabs");
    const provinceToggle = document.getElementById("provinceToggle");
    const updateTab = document.getElementById("updateTab");
    const tableWrap = document.getElementById("tableWrap");
    const searchInput = document.getElementById("searchInput");
    const resultMeta = document.getElementById("resultMeta");
    const modal = document.getElementById("detailModal");
    const modalTitle = document.getElementById("modalTitle");
    const modalDetails = document.getElementById("modalDetails");
    const summaryPopover = document.getElementById("summaryPopover");
    const browserModal = document.getElementById("knowledgeBrowserModal");
    const browserTitle = document.getElementById("browserTitle");
    const browserDetails = document.getElementById("browserDetails");

    function escapeHtml(value) {
      return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
    }

    function renderInline(value) {
      return escapeHtml(value)
        .replace(/\\*\\*([^*]+)\\*\\*/g, "<strong>$1</strong>")
        .replace(/==([^=]+)==/g, "<mark>$1</mark>")
        .replace(/\\x60([^\\x60]+)\\x60/g, "<code>$1</code>");
    }

    function renderSummaryMarkdown(value) {
      const text = String(value ?? "").trim();
      if (!text) return "未收录知识摘要。";
      const lines = text.split(/\\r?\\n/).map((line) => line.trim()).filter(Boolean);
      if (lines.length > 1 && lines.every((line) => /^(?:[-*]|\\d+[.、])\\s+/.test(line))) {
        return '<ul>' + lines.map((line) => {
          const item = line.replace(/^(?:[-*]|\\d+[.、])\\s+/, "");
          return '<li>' + renderInline(item) + '</li>';
        }).join("") + '</ul>';
      }
      return lines.map((line) => {
        const headingMatch = line.match(/^#{1,3}\\s+(.+)$/);
        if (headingMatch) return '<strong>' + renderInline(headingMatch[1]) + '</strong>';
        const listMatch = line.match(/^(?:[-*]|\\d+[.、])\\s+(.+)$/);
        if (listMatch) return "• " + renderInline(listMatch[1]);
        return renderInline(line);
      }).join("<br>");
    }

    function renderKnowledgeMarkdown(value) {
      const text = String(value ?? "").replace(/^---[\\s\\S]*?---\\s*/, "").trim();
      if (!text) return '<p>未提取到可浏览的 Markdown 内容。</p>';
      const lines = text.split(/\\r?\\n/);
      const html = [];
      let inList = false;
      let inCode = false;
      let tableBuffer = [];

      function flushList() {
        if (inList) {
          html.push("</ul>");
          inList = false;
        }
      }

      function flushTable() {
        if (tableBuffer.length === 0) return;
        const rows = tableBuffer.filter((line) => !/^\\|\\s*-+/.test(line));
        html.push("<table><tbody>" + rows.map((line, rowIndex) => {
          const cells = line.replace(/^\\||\\|$/g, "").split("|").map((cell) => cell.trim());
          const tag = rowIndex === 0 ? "th" : "td";
          return "<tr>" + cells.map((cell) => "<" + tag + ">" + renderInline(cell) + "</" + tag + ">").join("") + "</tr>";
        }).join("") + "</tbody></table>");
        tableBuffer = [];
      }

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith("\\x60\\x60\\x60")) {
          flushList();
          flushTable();
          html.push(inCode ? "</code></pre>" : "<pre><code>");
          inCode = !inCode;
          continue;
        }
        if (inCode) {
          html.push(escapeHtml(line) + "\\n");
          continue;
        }
        if (/^\\|.+\\|$/.test(trimmed)) {
          flushList();
          tableBuffer.push(trimmed);
          continue;
        }
        flushTable();
        if (!trimmed) {
          flushList();
          continue;
        }
        const heading = trimmed.match(/^(#{1,3})\\s+(.+)$/);
        if (heading) {
          flushList();
          const level = Math.min(heading[1].length + 1, 4);
          html.push("<h" + level + ">" + renderInline(heading[2]) + "</h" + level + ">");
          continue;
        }
        const listItem = trimmed.match(/^(?:[-*]|\\d+[.、])\\s+(.+)$/);
        if (listItem) {
          if (!inList) {
            html.push("<ul>");
            inList = true;
          }
          html.push("<li>" + renderInline(listItem[1]) + "</li>");
          continue;
        }
        flushList();
        html.push("<p>" + renderInline(trimmed) + "</p>");
      }
      flushList();
      flushTable();
      if (inCode) html.push("</code></pre>");
      return html.join("");
    }

    function splitSentences(value) {
      return String(value ?? "")
        .split(/(?<=[。；])\\s*/)
        .map((item) => item.trim())
        .filter(Boolean);
    }

    function renderStructuredDetail(value) {
      const text = String(value ?? "").trim();
      if (!text) return '<section class="detail-section"><p>未收录详细解读。</p></section>';

      if (!/^#{2,3}\\s|^-\\s|^\\d+[.、]\\s/m.test(text)) {
        const items = splitSentences(text);
        return '<section class="detail-section"><h3>详细解读</h3><ul>' + items.map((item) => '<li>' + renderInline(item) + '</li>').join("") + '</ul></section>';
      }

      const lines = text.split(/\\r?\\n/);
      const sections = [];
      let current = { title: "详细解读", blocks: [] };
      let listItems = [];

      function flushList() {
        if (listItems.length > 0) {
          current.blocks.push({ type: "list", items: listItems });
          listItems = [];
        }
      }

      function flushSection() {
        flushList();
        if (current.blocks.length > 0 || current.title !== "详细解读") sections.push(current);
      }

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) {
          flushList();
          continue;
        }
        const headingMatch = trimmed.match(/^#{2,3}\\s+(.+)$/);
        if (headingMatch) {
          flushSection();
          current = { title: headingMatch[1], blocks: [] };
          continue;
        }
        const listMatch = trimmed.match(/^(?:[-*]|\\d+[.、])\\s+(.+)$/);
        if (listMatch) {
          listItems.push(listMatch[1]);
          continue;
        }
        flushList();
        current.blocks.push({ type: "paragraph", text: trimmed });
      }
      flushSection();

      return sections.map((section) => {
        const blocks = section.blocks.map((block) => {
          if (block.type === "list") return '<ul>' + block.items.map((item) => '<li>' + renderInline(item) + '</li>').join("") + '</ul>';
          return '<p>' + renderInline(block.text) + '</p>';
        }).join("");
        return '<section class="detail-section"><h3>' + renderInline(section.title) + '</h3>' + blocks + '</section>';
      }).join("");
    }

    function detailTextForRow(sheet, row) {
      if (row.detail) return row.detail;
      const preferredLabels = ["详细解读", "政策/规则总结", "通俗解释", "说明"];
      for (const label of preferredLabels) {
        const index = sheet.columns.indexOf(label);
        if (index !== -1 && row.values[index]) return row.values[index];
      }
      return row.values.join("\\n");
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

    function positionSummaryPopover(anchor) {
      const margin = 14;
      const rect = anchor.getBoundingClientRect();
      const maxWidth = Math.min(520, window.innerWidth - margin * 2);
      summaryPopover.style.maxWidth = maxWidth + "px";

      const popoverRect = summaryPopover.getBoundingClientRect();
      const left = Math.min(
        Math.max(margin, rect.left),
        Math.max(margin, window.innerWidth - popoverRect.width - margin)
      );
      const belowTop = rect.bottom + 8;
      const aboveTop = rect.top - popoverRect.height - 8;
      const top = belowTop + popoverRect.height + margin <= window.innerHeight
        ? belowTop
        : Math.max(margin, aboveTop);

      summaryPopover.style.left = left + "px";
      summaryPopover.style.top = top + "px";
    }

    function showSummaryPopover(event) {
      event.stopPropagation();
      const anchor = event.currentTarget;
      const text = anchor.getAttribute("data-summary") || "";
      summaryPopover.innerHTML = renderSummaryMarkdown(text);
      summaryPopover.classList.add("open");
      positionSummaryPopover(anchor);
    }

    function hideSummaryPopover() {
      summaryPopover.classList.remove("open");
    }

    function renderCell(label, value) {
      if (label === "链接") return renderLinks(value, "官方链接");
      if (label === "查看文件") return renderLinks(value, "查看文件");
      if (label === "附件归档") return renderAttachmentLinks(value);
      const safe = escapeHtml(value);
      if (label === "知识摘要") return '<button class="clamped-text summary-tooltip" type="button" data-summary="' + safe + '" onclick="showSummaryPopover(event)" onmouseenter="showSummaryPopover(event)" onfocus="showSummaryPopover(event)" onmouseleave="hideSummaryPopover()" onblur="hideSummaryPopover()">' + renderInline(value) + '</button>';
      if (longLabels.has(label) || safe.length > 90) return '<div class="clamped-text">' + safe + '</div>';
      if (label === "状态" && value === "待核验") return '<span class="badge">待核验</span>';
      return safe || '<span class="hint">未收录</span>';
    }

    function rowSearchText(sheet, row) {
      return sheet.columns.concat(row.values, row.detail ?? "").join(" ").toLowerCase();
    }

    function renderTabs() {
      const provinceStartIndex = 3;
      const provinceEndIndex = appData.sheets.length - 2;
      const isProvinceActive = activeSheetIndex >= provinceStartIndex && activeSheetIndex <= provinceEndIndex;
      const primaryIndexes = [0, 1, 2];
      if (isProvinceActive) primaryIndexes.push(activeSheetIndex);

      primaryTabs.innerHTML = primaryIndexes.map((index) => {
        const sheet = appData.sheets[index];
        const active = index === activeSheetIndex ? " active" : "";
        const role = index === activeSheetIndex && isProvinceActive ? ' data-tab-role="selected-province"' : "";
        return '<button class="tab' + active + '" type="button" onclick="switchSheet(' + index + ')"' + role + '>' + escapeHtml(sheet.name) + '</button>';
      }).join("");

      provinceTabs.innerHTML = '<div class="province-tab-grid">' + appData.sheets.slice(provinceStartIndex, provinceEndIndex + 1).map((sheet, offset) => {
        const index = provinceStartIndex + offset;
        const active = index === activeSheetIndex ? " active" : "";
        return '<button class="tab' + active + '" type="button" data-tab-role="province" onclick="switchSheet(' + index + ')">' + escapeHtml(sheet.name) + '</button>';
      }).join("") + '</div>';

      provinceTabs.hidden = !provinceTabsExpanded;
      provinceToggle.setAttribute("aria-expanded", provinceTabsExpanded ? "true" : "false");
      provinceToggle.querySelector(".province-toggle-label").textContent = provinceTabsExpanded ? "收起省份" : "展开省份";
      updateTab.className = "tab update-tab" + (activeSheetIndex === appData.sheets.length - 1 ? " active" : "");
    }

    function toggleProvincePanel() {
      provinceTabsExpanded = !provinceTabsExpanded;
      renderTabs();
    }

    function renderTable() {
      const sheet = appData.sheets[activeSheetIndex];
      const query = searchInput.value.trim().toLowerCase();
      visibleRows = sheet.rows.filter((row) => !query || rowSearchText(sheet, row).includes(query));
      resultMeta.textContent = '显示 ' + visibleRows.length + ' / ' + sheet.rows.length + ' 条';

      if (visibleRows.length === 0) {
        tableWrap.innerHTML = '<div class="empty">没有匹配记录</div>';
        return;
      }

      const header = sheet.columns.map((column) => '<th>' + escapeHtml(column) + '</th>').join("") + '<th>详情</th>';
      const rows = visibleRows.map((row, rowIndex) => {
        const cells = sheet.columns
          .map((column, columnIndex) => '<td>' + renderCell(column, row.values[columnIndex]) + '</td>')
          .join("");
        const hasBrowserFiles = Array.isArray(row.browserFiles) && row.browserFiles.length > 0;
        const browseButton = '<button class="browse-button" type="button" ' + (hasBrowserFiles ? 'onclick="openKnowledgeBrowser(' + rowIndex + ')"' : 'disabled title="尚未生成 Markdown 原文"') + '>知识浏览</button>';
        return '<tr>' + cells + '<td class="action-cell"><button class="detail-button" type="button" data-detail-index="' + rowIndex + '" onclick="openDetail(' + rowIndex + ')">深度解读</button>' + browseButton + '</td></tr>';
      }).join("");
      tableWrap.innerHTML = '<table><thead><tr>' + header + '</tr></thead><tbody>' + rows + '</tbody></table>';
    }

    function switchSheet(index) {
      activeSheetIndex = index;
      searchInput.value = "";
      hideSummaryPopover();
      if (index >= 3 && index <= appData.sheets.length - 2) provinceTabsExpanded = false;
      renderTabs();
      renderTable();
    }

    function openDetail(rowIndex) {
      hideSummaryPopover();
      const sheet = appData.sheets[activeSheetIndex];
      const row = visibleRows[rowIndex];
      modalTitle.textContent = row.title || sheet.name;
      modalDetails.innerHTML = renderStructuredDetail(detailTextForRow(sheet, row));
      modal.classList.add("open");
    }

    function closeModal() {
      modal.classList.remove("open");
    }

    async function openKnowledgeBrowser(rowIndex) {
      hideSummaryPopover();
      const sheet = appData.sheets[activeSheetIndex];
      const row = visibleRows[rowIndex];
      const files = row.browserFiles ?? [];
      browserTitle.textContent = (row.title || sheet.name) + "｜知识浏览";
      if (files.length === 0) {
        browserDetails.innerHTML = '<p>尚未生成该条知识的 Markdown 原文。</p>';
        browserModal.classList.add("open");
        return;
      }
      browserDetails.innerHTML = '<div class="markdown-source-list">' + files.map((file, index) => '<button class="markdown-source-tab' + (index === 0 ? " active" : "") + '" type="button" onclick="loadKnowledgeMarkdown(' + rowIndex + ',' + index + ')">' + escapeHtml(file.title || ("文件" + (index + 1))) + '</button>').join("") + '</div><div id="markdownContent" class="markdown-content">正在加载 Markdown 内容……</div>';
      browserModal.classList.add("open");
      await loadKnowledgeMarkdown(rowIndex, 0);
    }

    async function loadKnowledgeMarkdown(rowIndex, fileIndex) {
      const row = visibleRows[rowIndex];
      const files = row.browserFiles ?? [];
      const file = files[fileIndex];
      const content = document.getElementById("markdownContent");
      if (!file || !content) return;
      document.querySelectorAll(".markdown-source-tab").forEach((button, index) => {
        button.classList.toggle("active", index === fileIndex);
      });
      try {
        const response = await fetch(file.markdownFilePath);
        if (!response.ok) throw new Error("HTTP " + response.status);
        const markdown = await response.text();
        const meta = '<p class="hint">来源：' + escapeHtml(file.sourceFilePath || file.markdownFilePath) + '</p>';
        content.innerHTML = meta + renderKnowledgeMarkdown(markdown);
      } catch (error) {
        content.innerHTML = '<p>Markdown 内容暂时无法加载。你仍可直接打开：<a href="' + escapeHtml(file.markdownFilePath) + '" target="_blank" rel="noopener noreferrer">' + escapeHtml(file.markdownFilePath) + '</a></p>';
      }
    }

    function closeKnowledgeBrowser() {
      browserModal.classList.remove("open");
    }

    modal.addEventListener("click", (event) => {
      if (event.target === modal) closeModal();
    });
    browserModal.addEventListener("click", (event) => {
      if (event.target === browserModal) closeKnowledgeBrowser();
    });
    document.addEventListener("click", (event) => {
      if (!event.target.closest(".summary-tooltip") && !summaryPopover.contains(event.target)) hideSummaryPopover();
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        closeModal();
        closeKnowledgeBrowser();
        hideSummaryPopover();
      }
    });
    searchInput.addEventListener("input", () => {
      hideSummaryPopover();
      renderTable();
    });
    tableWrap.addEventListener("scroll", hideSummaryPopover);
    window.addEventListener("resize", hideSummaryPopover);

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
  await fs.copyFile(LOGO_ASSET_SOURCE_PATH, path.join(assetDir, LOGO_ASSET_FILE));
}

async function webAssetVersion() {
  const [heroAsset, logoAsset] = await Promise.all([
    fs.readFile(HERO_ASSET_SOURCE_PATH),
    fs.readFile(LOGO_ASSET_SOURCE_PATH),
  ]);
  return createHash("sha256")
    .update(heroAsset)
    .update(logoAsset)
    .digest("hex")
    .slice(0, 12);
}

export async function exportWebPreview(inputPath, outputPath, options = {}) {
  const store = JSON.parse(await fs.readFile(inputPath, "utf8"));
  const validationErrors = validateKnowledgeBase(store);
  if (validationErrors.length > 0) {
    throw new Error(`知识库校验失败：\n${validationErrors.join("\n")}`);
  }

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await copyWebAssets(outputPath);
  const assetVersion = options.assetVersion ?? await webAssetVersion();
  await fs.writeFile(outputPath, renderHtml(store, { ...options, assetVersion }), "utf8");
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
