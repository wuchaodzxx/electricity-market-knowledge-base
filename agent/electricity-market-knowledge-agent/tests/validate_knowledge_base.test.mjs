import test from "node:test";
import assert from "node:assert/strict";
import { validateKnowledgeBase } from "../scripts/validate_knowledge_base.mjs";

const store = {
  metadata: {
    schemaVersion: 1,
    supportedProvinces: ["江苏"],
    lastUpdatedAt: "2026-07-14",
  },
  concepts: [],
  policyDocuments: [
    {
      id: "doc-1",
      title: "示例文件",
      documentNumber: "苏发改价格〔2026〕1号",
      issuer: "江苏省发展和改革委员会",
      publishedAt: "2026-01-01",
      officialUrl: "https://example.gov.cn/a",
      scope: "江苏",
      status: "有效",
      firstRecordedAt: "2026-07-14",
      lastVerifiedAt: "2026-07-14",
      localFilePath: "source-files/2026-01-01-示例文件(苏发改价格〔2026〕1号).pdf",
      markdownFilePath: "knowledge-markdown/doc-1/政策正文.md",
      markdownExtraction: {
        method: "pdf-text",
        ocrStatus: "not-needed",
        extractedAt: "2026-07-15",
      },
      localAttachments: [
        {
          title: "附件：交易执行规则",
          officialUrl: "https://example.gov.cn/files/rule.docx",
          localFilePath: "source-files/attachments/2026-01-01-示例文件(苏发改价格〔2026〕1号)/rule.docx",
        },
      ],
      attachmentMarkdownFiles: [
        {
          title: "附件：交易执行规则",
          sourceFilePath: "source-files/attachments/2026-01-01-示例文件(苏发改价格〔2026〕1号)/rule.docx",
          markdownFilePath: "knowledge-markdown/doc-1/附件-交易执行规则.md",
          extraction: {
            method: "office",
            ocrStatus: "not-needed",
            extractedAt: "2026-07-15",
          },
        },
      ],
      knowledgeSummary: "示例文件用于测试政策文件的知识摘要字段，要求内容简明、可用于表格快速扫读，并控制在 200 字以内。",
      detailedSummary: "这是一段用于测试的政策文件详细解读，说明文件的适用范围、核心要求和后续规则整理依据。",
    },
  ],
  provincialRules: [],
  updateEvents: [],
};

test("accepts a policy document with traceable fields", () => {
  assert.deepEqual(validateKnowledgeBase(store), []);
});

test("rejects blank documentNumber", () => {
  const invalidStore = structuredClone(store);
  invalidStore.policyDocuments[0].documentNumber = "";
  assert.match(
    validateKnowledgeBase(invalidStore).join("\n"),
    /documentNumber/,
  );
});

test("rejects a policy document without local archived file path", () => {
  const invalidStore = structuredClone(store);
  invalidStore.policyDocuments[0].localFilePath = "";
  assert.match(
    validateKnowledgeBase(invalidStore).join("\n"),
    /localFilePath/,
  );
});

test("rejects a policy document whose local archive is not a PDF", () => {
  const invalidStore = structuredClone(store);
  invalidStore.policyDocuments[0].localFilePath = "source-files/2026-01-01-示例文件(苏发改价格〔2026〕1号).html";
  assert.match(
    validateKnowledgeBase(invalidStore).join("\n"),
    /PDF/,
  );
});

test("rejects a policy document without knowledge summary", () => {
  const invalidStore = structuredClone(store);
  invalidStore.policyDocuments[0].knowledgeSummary = "";
  assert.match(
    validateKnowledgeBase(invalidStore).join("\n"),
    /knowledgeSummary/,
  );
});

test("rejects a knowledge summary longer than 200 characters", () => {
  const invalidStore = structuredClone(store);
  invalidStore.policyDocuments[0].knowledgeSummary = "超".repeat(201);
  assert.match(
    validateKnowledgeBase(invalidStore).join("\n"),
    /200/,
  );
});

test("rejects unsafe local attachment paths", () => {
  const invalidStore = structuredClone(store);
  invalidStore.policyDocuments[0].localAttachments[0].localFilePath = "../secret.docx";
  assert.match(
    validateKnowledgeBase(invalidStore).join("\n"),
    /localAttachments/,
  );
});

test("rejects unsafe policy markdown paths", () => {
  const invalidStore = structuredClone(store);
  invalidStore.policyDocuments[0].markdownFilePath = "../secret.md";
  assert.match(
    validateKnowledgeBase(invalidStore).join("\n"),
    /markdownFilePath/,
  );
});

test("rejects invalid markdown extraction status", () => {
  const invalidStore = structuredClone(store);
  invalidStore.policyDocuments[0].markdownExtraction.ocrStatus = "maybe";
  assert.match(
    validateKnowledgeBase(invalidStore).join("\n"),
    /ocrStatus/,
  );
});

test("rejects a rule with a missing source document", () => {
  const invalidStore = structuredClone(store);
  invalidStore.provincialRules.push({
    id: "rule-1",
    province: "江苏",
    tradingProduct: "绿电交易",
    knowledgeSummary: "绿电交易规则摘要，用于验证省份规则的知识摘要字段。",
    detailedSummary: "这是一段用于测试的省份规则详细总结，说明交易品种的适用对象、准入和考核要求。",
    eligibleParticipants: "用户",
    managementRequirements: "按规则执行",
    admissionCriteria: "完成注册",
    participationProcess: "注册后申报",
    assessmentMethod: "按规则考核",
    sourceDocumentIds: ["missing-doc"],
    status: "有效",
    lastVerifiedAt: "2026-07-14",
  });
  assert.match(
    validateKnowledgeBase(invalidStore).join("\n"),
    /missing-doc/,
  );
});

test("rejects a provincial rule without detailed summary", () => {
  const invalidStore = structuredClone(store);
  invalidStore.provincialRules.push({
    id: "rule-1",
    province: "江苏",
    tradingProduct: "绿电交易",
    knowledgeSummary: "绿电交易规则摘要，用于验证省份规则的知识摘要字段。",
    detailedSummary: "",
    eligibleParticipants: "用户",
    managementRequirements: "按规则执行",
    admissionCriteria: "完成注册",
    participationProcess: "注册后申报",
    assessmentMethod: "按规则考核",
    sourceDocumentIds: ["doc-1"],
    status: "有效",
    lastVerifiedAt: "2026-07-14",
  });
  assert.match(
    validateKnowledgeBase(invalidStore).join("\n"),
    /detailedSummary/,
  );
});
