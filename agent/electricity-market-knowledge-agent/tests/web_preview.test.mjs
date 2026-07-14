import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { exportWebPreview } from "../scripts/export_web_preview.mjs";

const longSummary =
  "这是一段较长的详细解读，用来验证网页表格默认不把长文本全部铺开，而是通过摘要和查看详情按钮改善阅读体验。".repeat(8);

function sampleStore() {
  return {
    metadata: {
      schemaVersion: 1,
      supportedProvinces: ["江苏", "浙江", "山西", "湖北", "四川", "山东", "甘肃", "安徽"],
      lastUpdatedAt: "2026-07-14",
    },
    policyDocuments: [
      {
        id: "doc-1",
        title: "示例政策文件",
        documentNumber: "苏发改价格〔2026〕1号",
        issuer: "江苏省发展和改革委员会",
        publishedAt: "2026-01-01",
        officialUrl: "https://example.gov.cn/policy",
        localFilePath: "source-files/2026-01-01-示例政策文件(苏发改价格〔2026〕1号).html",
        scope: "江苏",
        status: "有效",
        firstRecordedAt: "2026-07-14",
        lastVerifiedAt: "2026-07-14",
        detailedSummary: longSummary,
      },
    ],
    concepts: [
      {
        id: "concept-1",
        name: "机制电价",
        plainExplanation: "用于差价结算的基准价格。",
        detailedSummary: longSummary,
        relatedMechanisms: ["机制电量", "差价结算"],
        scope: "国家",
        sourceDocumentIds: ["doc-1"],
        lastVerifiedAt: "2026-07-14",
      },
    ],
    provincialRules: [
      {
        id: "rule-1",
        province: "江苏",
        tradingProduct: "中长期交易",
        detailedSummary: longSummary,
        eligibleParticipants: "发电企业、售电公司、电力用户。",
        managementRequirements: "按交易规则完成申报、成交、结算和信息披露。",
        admissionCriteria: "完成市场注册并满足信用履约要求。",
        participationProcess: "注册后按交易公告申报，成交后履约结算。",
        assessmentMethod: "按偏差、履约和违规行为进行考核。",
        sourceDocumentIds: ["doc-1"],
        status: "有效",
        lastVerifiedAt: "2026-07-14",
      },
    ],
    updateEvents: [
      {
        id: "event-1",
        occurredAt: "2026-07-14",
        type: "新增",
        subjectId: "doc-1",
        note: "新增示例政策。",
      },
    ],
  };
}

test("exports an optimized local HTML web preview", async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "electricity-preview-"));
  const inputPath = path.join(tmpDir, "knowledge.json");
  const outputPath = path.join(tmpDir, "preview.html");
  await fs.writeFile(inputPath, JSON.stringify(sampleStore()), "utf8");

  await exportWebPreview(inputPath, outputPath);

  const html = await fs.readFile(outputPath, "utf8");
  for (const expectedText of [
    "电力市场知识库",
    "基础概念",
    "国家政策",
    "江苏",
    "政策/规则总结",
    "查看文件",
    "查看详情",
    "detailModal",
    "clamped-text",
    "searchInput",
    "https://example.gov.cn/policy",
    "source-files/2026-01-01-示例政策文件(苏发改价格〔2026〕1号).html",
    "target=\"_blank\"",
  ]) {
    assert.ok(html.includes(expectedText), `网页应包含：${expectedText}`);
  }
});
