import { pathToFileURL } from "node:url";

const SUPPORTED_PROVINCES = new Set([
  "江苏",
  "浙江",
  "山西",
  "湖北",
  "四川",
  "山东",
  "甘肃",
  "安徽",
]);

const VALID_STATUSES = new Set(["有效", "已废止", "被替代", "待核验"]);
const VALID_OCR_STATUSES = new Set(["not-needed", "success", "partial", "failed", "not-run"]);
const REQUIRED_TOP_LEVEL_KEYS = [
  "metadata",
  "concepts",
  "policyDocuments",
  "provincialRules",
  "updateEvents",
];

function hasText(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function validateKnowledgeSummary(label, value, errors) {
  if (!hasText(value)) {
    errors.push(`${label} 缺少 knowledgeSummary`);
    return;
  }
  const trimmed = value.trim();
  if (Array.from(trimmed).length > 200) {
    errors.push(`${label} 的 knowledgeSummary 必须控制在 200 字以内`);
  }
  if (/#{1,6}\s*\S/.test(trimmed)) {
    errors.push(`${label} 的 knowledgeSummary 不得包含 Markdown 标题标记`);
  }
  if (/(?:\*\*|__|`|==)/.test(trimmed)) {
    errors.push(`${label} 的 knowledgeSummary 必须为纯文本，不得包含 Markdown 强调、代码或高亮标记`);
  }
}

function isOfficialUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:";
  } catch {
    return false;
  }
}

function validateSourceReferences(record, documentIds, errors) {
  if (!Array.isArray(record.sourceDocumentIds) || record.sourceDocumentIds.length === 0) {
    errors.push(`${record.id} 缺少来源文件引用`);
    return;
  }

  for (const documentId of record.sourceDocumentIds) {
    if (!documentIds.has(documentId)) {
      errors.push(`${record.id} 引用了不存在的文件：${documentId}`);
    }
  }
}

function validateMarkdownPath(label, value, errors) {
  if (value === undefined) return;
  if (!hasText(value)) {
    errors.push(`${label} 缺少 markdownFilePath`);
    return;
  }
  if (value.includes("..") || !value.toLowerCase().endsWith(".md")) {
    errors.push(`${label} 的 markdownFilePath 必须是安全的 .md 相对路径`);
  }
}

function validateExtraction(label, extraction, errors) {
  if (extraction === undefined) return;
  if (!extraction || typeof extraction !== "object" || Array.isArray(extraction)) {
    errors.push(`${label} 的 markdownExtraction 必须是对象`);
    return;
  }
  if (!hasText(extraction.method)) errors.push(`${label} 的 markdownExtraction 缺少 method`);
  if (!hasText(extraction.extractedAt)) errors.push(`${label} 的 markdownExtraction 缺少 extractedAt`);
  if (!hasText(extraction.ocrStatus) || !VALID_OCR_STATUSES.has(extraction.ocrStatus)) {
    errors.push(`${label} 的 markdownExtraction.ocrStatus 无效`);
  }
}

export function validateKnowledgeBase(store) {
  const errors = [];

  if (!store || typeof store !== "object" || Array.isArray(store)) {
    return ["知识库根对象必须是 JSON 对象"];
  }

  for (const key of REQUIRED_TOP_LEVEL_KEYS) {
    if (!(key in store)) errors.push(`缺少顶层字段：${key}`);
  }

  if (errors.length > 0) return errors;

  for (const key of ["concepts", "policyDocuments", "provincialRules", "updateEvents"]) {
    if (!Array.isArray(store[key])) errors.push(`${key} 必须是数组`);
  }
  if (!store.metadata || typeof store.metadata !== "object") {
    errors.push("metadata 必须是对象");
  }
  if (errors.length > 0) return errors;

  const documentIds = new Set();
  for (const document of store.policyDocuments) {
    if (!hasText(document.id) || documentIds.has(document.id)) {
      errors.push(`政策文件 ID 无效或重复：${document.id || "<空>"}`);
    }
    documentIds.add(document.id);

    for (const field of ["title", "documentNumber", "issuer", "publishedAt", "scope", "status", "firstRecordedAt", "lastVerifiedAt", "localFilePath", "detailedSummary"]) {
      if (!hasText(document[field])) errors.push(`政策文件 ${document.id || "<空>"} 缺少 ${field}`);
    }
    validateKnowledgeSummary(`政策文件 ${document.id || "<空>"}`, document.knowledgeSummary, errors);
    if (!isOfficialUrl(document.officialUrl)) {
      errors.push(`政策文件 ${document.id || "<空>"} 缺少官方 https 链接`);
    }
    if (hasText(document.localFilePath) && document.localFilePath.includes("..")) {
      errors.push(`政策文件 ${document.id || "<空>"} 的 localFilePath 不得包含上级目录`);
    }
    if (hasText(document.localFilePath) && !document.localFilePath.toLowerCase().endsWith(".pdf")) {
      errors.push(`政策文件 ${document.id || "<空>"} 的 localFilePath 必须指向 PDF 归档文件`);
    }
    validateMarkdownPath(`政策文件 ${document.id || "<空>"}`, document.markdownFilePath, errors);
    validateExtraction(`政策文件 ${document.id || "<空>"}`, document.markdownExtraction, errors);
    if (document.localAttachments !== undefined) {
      if (!Array.isArray(document.localAttachments)) {
        errors.push(`政策文件 ${document.id || "<空>"} 的 localAttachments 必须是数组`);
      } else {
        for (const [attachmentIndex, attachment] of document.localAttachments.entries()) {
          const label = `政策文件 ${document.id || "<空>"} 的 localAttachments[${attachmentIndex}]`;
          if (!hasText(attachment?.title)) errors.push(`${label} 缺少 title`);
          if (!isOfficialUrl(attachment?.officialUrl)) errors.push(`${label} 缺少官方 https 链接`);
          if (!hasText(attachment?.localFilePath)) {
            errors.push(`${label} 缺少 localFilePath`);
          } else if (attachment.localFilePath.includes("..")) {
            errors.push(`${label} 的 localFilePath 不得包含上级目录`);
          }
        }
      }
    }
    if (document.attachmentMarkdownFiles !== undefined) {
      if (!Array.isArray(document.attachmentMarkdownFiles)) {
        errors.push(`政策文件 ${document.id || "<空>"} 的 attachmentMarkdownFiles 必须是数组`);
      } else {
        for (const [attachmentIndex, attachment] of document.attachmentMarkdownFiles.entries()) {
          const label = `政策文件 ${document.id || "<空>"} 的 attachmentMarkdownFiles[${attachmentIndex}]`;
          if (!hasText(attachment?.title)) errors.push(`${label} 缺少 title`);
          if (!hasText(attachment?.sourceFilePath)) errors.push(`${label} 缺少 sourceFilePath`);
          validateMarkdownPath(label, attachment?.markdownFilePath, errors);
          validateExtraction(label, attachment?.extraction, errors);
        }
      }
    }
    if (hasText(document.status) && !VALID_STATUSES.has(document.status)) {
      errors.push(`政策文件 ${document.id || "<空>"} 的状态无效`);
    }
    if (hasText(document.scope) && document.scope !== "国家" && !SUPPORTED_PROVINCES.has(document.scope)) {
      errors.push(`政策文件 ${document.id || "<空>"} 的适用范围不在首期范围内`);
    }
  }

  for (const concept of store.concepts) {
    if (!hasText(concept.id) || !hasText(concept.name) || !hasText(concept.plainExplanation) || !hasText(concept.detailedSummary)) {
      errors.push(`基础概念 ${concept.id || "<空>"} 缺少名称、通俗解释或详细解读`);
    }
    validateKnowledgeSummary(`基础概念 ${concept.id || "<空>"}`, concept.knowledgeSummary, errors);
    validateSourceReferences(concept, documentIds, errors);
  }

  for (const rule of store.provincialRules) {
    if (!hasText(rule.id) || !SUPPORTED_PROVINCES.has(rule.province)) {
      errors.push(`省份规则 ${rule.id || "<空>"} 的省份不在首期范围内`);
    }
    for (const field of ["tradingProduct", "detailedSummary", "eligibleParticipants", "managementRequirements", "admissionCriteria", "participationProcess", "assessmentMethod", "status", "lastVerifiedAt"]) {
      if (!hasText(rule[field])) errors.push(`省份规则 ${rule.id || "<空>"} 缺少 ${field}`);
    }
    validateKnowledgeSummary(`省份规则 ${rule.id || "<空>"}`, rule.knowledgeSummary, errors);
    if (hasText(rule.status) && !VALID_STATUSES.has(rule.status)) {
      errors.push(`省份规则 ${rule.id || "<空>"} 的状态无效`);
    }
    validateSourceReferences(rule, documentIds, errors);
  }

  return errors;
}

function readOption(name) {
  const position = process.argv.indexOf(name);
  return position === -1 ? undefined : process.argv[position + 1];
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const inputPath = readOption("--input");
  if (!inputPath) throw new Error("用法：node validate_knowledge_base.mjs --input <知识库.json>");
  const fs = await import("node:fs/promises");
  const store = JSON.parse(await fs.readFile(inputPath, "utf8"));
  const errors = validateKnowledgeBase(store);
  if (errors.length > 0) throw new Error(`知识库校验失败：\n${errors.join("\n")}`);
  console.log("知识库校验通过");
}
