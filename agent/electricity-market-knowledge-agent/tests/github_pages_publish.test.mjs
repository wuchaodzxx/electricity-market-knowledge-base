import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { prepareGitHubPagesSite } from "../scripts/publish_github_pages.mjs";

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
        title: "示例政策",
        documentNumber: "发改价格〔2026〕1号",
        issuer: "国家发展改革委",
        publishedAt: "2026-01-01",
        officialUrl: "https://example.gov.cn/policy",
        localFilePath: "source-files/2026-01-01-示例政策(发改价格〔2026〕1号).pdf",
        scope: "国家",
        status: "有效",
        firstRecordedAt: "2026-07-14",
        lastVerifiedAt: "2026-07-14",
        detailedSummary: "示例政策详细解读，用于验证 GitHub Pages 首页生成。",
      },
    ],
    concepts: [
      {
        id: "concept-1",
        name: "机制电价",
        plainExplanation: "示例解释。",
        detailedSummary: "示例详细解读。",
        relatedMechanisms: ["差价结算"],
        scope: "国家",
        sourceDocumentIds: ["doc-1"],
        lastVerifiedAt: "2026-07-14",
      },
    ],
    provincialRules: [],
    updateEvents: [],
  };
}

test("prepares GitHub Pages index and dated web archive", async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "electricity-pages-"));
  const inputPath = path.join(tmpDir, "knowledge.json");
  const outputsDir = path.join(tmpDir, "outputs");
  const sitePath = path.join(tmpDir, "docs", "index.html");
  await fs.writeFile(inputPath, JSON.stringify(sampleStore()), "utf8");

  const result = await prepareGitHubPagesSite({
    inputPath,
    outputsDir,
    sitePath,
    date: "2026-07-14",
  });

  const siteHtml = await fs.readFile(sitePath, "utf8");
  const archiveHtml = await fs.readFile(result.archivePath, "utf8");
  const nojekyll = await fs.readFile(path.join(tmpDir, "docs", ".nojekyll"), "utf8");

  assert.match(siteHtml, /电力市场知识库/);
  assert.match(archiveHtml, /电力市场知识库/);
  assert.equal(nojekyll, "");
  assert.equal(result.pagesUrl, "https://wuchaodzxx.github.io/electricity-market-knowledge-base/");
});
