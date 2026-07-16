import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createPolicyDraft } from "../scripts/ingest_policy.mjs";

test("creates a policy draft from an official page", async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "policy-draft-"));
  const outputDir = path.join(tmpDir, "intake", "policy-drafts");
  const result = await createPolicyDraft({
    officialUrl: "https://example.gov.cn/202607/t20260716_123.html",
    scope: "国家",
    outputDir,
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      headers: { get: () => "text/html; charset=utf-8" },
      text: async () => `<!doctype html><html><head><title>国家发展改革委 国家能源局关于测试政策的通知</title></head><body><h1>国家发展改革委 国家能源局关于测试政策的通知</h1><p>发改能源规〔2026〕99号</p><p>发布时间：2026-07-16</p><a href="/files/rule.pdf">附件：测试规则</a></body></html>`,
    }),
  });

  assert.equal(result.draft.title, "国家发展改革委 国家能源局关于测试政策的通知");
  assert.equal(result.draft.documentNumber, "发改能源规〔2026〕99号");
  assert.equal(result.draft.publishedAt, "2026-07-16");
  assert.equal(result.draft.scope, "国家");
  assert.equal(result.draft.officialUrl, "https://example.gov.cn/202607/t20260716_123.html");
  assert.equal(result.draft.attachments[0].officialUrl, "https://example.gov.cn/files/rule.pdf");
  assert.equal(result.draft.readyForKnowledgeBase, false);
  assert.ok(result.outputPath.endsWith(".json"));
  const saved = JSON.parse(await fs.readFile(result.outputPath, "utf8"));
  assert.equal(saved.id, result.draft.id);
});
