import fs from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { validateKnowledgeBase } from "./validate_knowledge_base.mjs";

const PROVINCES = ["江苏", "浙江", "山西", "湖北", "四川", "山东", "甘肃", "安徽"];
const POLICY_HEADERS = [
  "文件标题",
  "详细解读",
  "发文编号",
  "发布单位",
  "发布日期",
  "链接",
  "查看文件",
  "附件归档",
  "状态",
  "最后核验日期",
];

function joinSourceField(documentIds, documents, field) {
  return documentIds
    .map((documentId) => documents.get(documentId)?.[field] ?? "")
    .filter(Boolean)
    .join("；");
}

function formatAttachments(attachments = []) {
  return attachments
    .map((attachment) => `${attachment.title}：${attachment.localFilePath}`)
    .join("；");
}

function joinSourceAttachments(documentIds, documents) {
  return documentIds
    .map((documentId) => formatAttachments(documents.get(documentId)?.localAttachments ?? []))
    .filter(Boolean)
    .join("；");
}

function policyRow(document) {
  return [
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
  ];
}

async function loadArtifactTool() {
  try {
    return await import("@oai/artifact-tool");
  } catch (error) {
    if (error?.code !== "ERR_MODULE_NOT_FOUND") throw error;
    const requireFromWorkspace = createRequire(path.join(process.cwd(), "package.json"));
    const resolvedPath = requireFromWorkspace.resolve("@oai/artifact-tool");
    return import(pathToFileURL(resolvedPath).href);
  }
}

function writeSheet(workbook, name, headers, rows) {
  const sheet = workbook.worksheets.add(name);
  sheet.showGridLines = false;
  sheet.getRangeByIndexes(0, 0, 1, headers.length).values = [headers];
  if (rows.length > 0) {
    sheet.getRangeByIndexes(1, 0, rows.length, headers.length).values = rows;
  }

  const used = sheet.getUsedRange();
  used.format.wrapText = true;
  used.format.verticalAlignment = "top";
  used.format.autofitColumns();
  for (let column = 0; column < headers.length; column += 1) {
    const range = sheet.getRangeByIndexes(0, column, Math.max(rows.length + 1, 2), 1);
    range.format.columnWidth = column === 1 || column === headers.length - 3 ? 42 : 20;
  }
  sheet.getRangeByIndexes(0, 0, 1, headers.length).format = {
    fill: "#0F4C5C",
    font: { bold: true, color: "#FFFFFF" },
    horizontalAlignment: "center",
    verticalAlignment: "center",
  };
  sheet.freezePanes.freezeRows(1);
}

export async function exportKnowledgeBase(inputPath, outputPath) {
  const { SpreadsheetFile, Workbook } = await loadArtifactTool();
  const store = JSON.parse(await fs.readFile(inputPath, "utf8"));
  const validationErrors = validateKnowledgeBase(store);
  if (validationErrors.length > 0) {
    throw new Error(`知识库校验失败：\n${validationErrors.join("\n")}`);
  }

  const documents = new Map(store.policyDocuments.map((document) => [document.id, document]));
  const workbook = Workbook.create();

  writeSheet(
    workbook,
    "基础概念",
    ["概念", "通俗解释", "详细解读", "关联机制", "适用范围", "来源文件", "发文编号", "链接", "查看文件", "附件归档", "核验日期"],
    store.concepts.map((concept) => [
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
    ]),
  );

  writeSheet(
    workbook,
    "国家政策",
    POLICY_HEADERS,
    store.policyDocuments
      .filter((document) => document.scope === "国家")
      .map((document) => policyRow(document)),
  );

  for (const province of PROVINCES) {
    writeSheet(
      workbook,
      province,
      POLICY_HEADERS,
      store.policyDocuments
        .filter((document) => document.scope === province)
        .map((document) => policyRow(document)),
    );
  }

  writeSheet(
    workbook,
    "更新记录",
    ["日期", "类型", "对象 ID", "说明"],
    store.updateEvents.map((event) => [event.occurredAt, event.type, event.subjectId, event.note]),
  );

  await workbook.inspect({ kind: "table", range: "基础概念!A1:K2", include: "values" });
  await workbook.inspect({ kind: "match", searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A", options: { useRegex: true, maxResults: 50 } });
  await workbook.render({ sheetName: "基础概念", range: "A1:K2", scale: 1 });
  await workbook.render({ sheetName: "江苏", range: "A1:J2", scale: 1 });

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  const output = await SpreadsheetFile.exportXlsx(workbook);
  await output.save(outputPath);
}

function readOption(name) {
  const position = process.argv.indexOf(name);
  return position === -1 ? undefined : process.argv[position + 1];
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const inputPath = readOption("--input");
  const outputPath = readOption("--output");
  if (!inputPath || !outputPath) {
    throw new Error("用法：node export_knowledge_base.mjs --input <知识库.json> --output <导出.xlsx>");
  }
  await exportKnowledgeBase(inputPath, outputPath);
}
