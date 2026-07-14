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

    for (const field of ["title", "documentNumber", "issuer", "publishedAt", "scope", "status", "firstRecordedAt", "lastVerifiedAt"]) {
      if (!hasText(document[field])) errors.push(`政策文件 ${document.id || "<空>"} 缺少 ${field}`);
    }
    if (!isOfficialUrl(document.officialUrl)) {
      errors.push(`政策文件 ${document.id || "<空>"} 缺少官方 https 链接`);
    }
    if (hasText(document.status) && !VALID_STATUSES.has(document.status)) {
      errors.push(`政策文件 ${document.id || "<空>"} 的状态无效`);
    }
    if (hasText(document.scope) && document.scope !== "国家" && !SUPPORTED_PROVINCES.has(document.scope)) {
      errors.push(`政策文件 ${document.id || "<空>"} 的适用范围不在首期范围内`);
    }
  }

  for (const concept of store.concepts) {
    if (!hasText(concept.id) || !hasText(concept.name) || !hasText(concept.plainExplanation)) {
      errors.push(`基础概念 ${concept.id || "<空>"} 缺少名称或通俗解释`);
    }
    validateSourceReferences(concept, documentIds, errors);
  }

  for (const rule of store.provincialRules) {
    if (!hasText(rule.id) || !SUPPORTED_PROVINCES.has(rule.province)) {
      errors.push(`省份规则 ${rule.id || "<空>"} 的省份不在首期范围内`);
    }
    for (const field of ["tradingProduct", "eligibleParticipants", "managementRequirements", "admissionCriteria", "participationProcess", "assessmentMethod", "status", "lastVerifiedAt"]) {
      if (!hasText(rule[field])) errors.push(`省份规则 ${rule.id || "<空>"} 缺少 ${field}`);
    }
    if (hasText(rule.status) && !VALID_STATUSES.has(rule.status)) {
      errors.push(`省份规则 ${rule.id || "<空>"} 的状态无效`);
    }
    validateSourceReferences(rule, documentIds, errors);
  }

  return errors;
}
