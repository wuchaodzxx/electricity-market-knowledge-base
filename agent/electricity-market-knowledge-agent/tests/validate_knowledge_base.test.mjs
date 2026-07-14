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

test("rejects a rule with a missing source document", () => {
  const invalidStore = structuredClone(store);
  invalidStore.provincialRules.push({
    id: "rule-1",
    province: "江苏",
    tradingProduct: "绿电交易",
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
