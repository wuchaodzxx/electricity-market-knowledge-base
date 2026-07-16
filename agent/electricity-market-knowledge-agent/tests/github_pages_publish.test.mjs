import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
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
        knowledgeSummary: "示例政策用于验证 GitHub Pages 首页生成、知识摘要展示和网页浏览。",
        detailedSummary: "示例政策详细解读，用于验证 GitHub Pages 首页生成。",
      },
    ],
    concepts: [
      {
        id: "concept-1",
        name: "机制电价",
        plainExplanation: "示例解释。",
        knowledgeSummary: "机制电价示例摘要，用于验证 GitHub Pages 发布时的知识摘要字段。",
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
  const sourcePath = path.join(tmpDir, "docs", "source-files", "2026-01-01-示例政策(发改价格〔2026〕1号).pdf");
  const markdownPath = path.join(tmpDir, "docs", "knowledge-markdown", "doc-1", "政策正文.md");
  const sourceBody = "示例政策归档文件，用于验证发布流程中的增量 Markdown 提取会跳过未变化文件。";
  const sourceHash = createHash("sha256").update(sourceBody).digest("hex");
  await fs.mkdir(path.dirname(sourcePath), { recursive: true });
  await fs.mkdir(path.dirname(markdownPath), { recursive: true });
  await fs.writeFile(sourcePath, sourceBody, "utf8");
  await fs.writeFile(markdownPath, "# 示例政策\n\n已提取的 Markdown。", "utf8");
  const store = sampleStore();
  store.policyDocuments[0].markdownFilePath = "knowledge-markdown/doc-1/政策正文.md";
  store.policyDocuments[0].markdownExtraction = {
    method: "pdf-text",
    ocrStatus: "not-needed",
    extractedAt: "2026-07-14",
    sourceHash,
  };
  await fs.writeFile(inputPath, JSON.stringify(store), "utf8");

  const result = await prepareGitHubPagesSite({
    inputPath,
    outputsDir,
    sitePath,
    date: "2026-07-14",
  });

  const siteHtml = await fs.readFile(sitePath, "utf8");
  const archiveHtml = await fs.readFile(result.archivePath, "utf8");
  const nojekyll = await fs.readFile(path.join(tmpDir, "docs", ".nojekyll"), "utf8");
  const siteHeroAsset = await fs.stat(path.join(tmpDir, "docs", "assets", "electricity-market-hero.png"));
  const archiveHeroAsset = await fs.stat(path.join(tmpDir, "outputs", "assets", "electricity-market-hero.png"));

  assert.match(siteHtml, /电力市场知识库/);
  assert.doesNotMatch(siteHtml, /downloads\/电力市场知识库-2026-07-14\.xlsx/);
  assert.doesNotMatch(siteHtml, /导出 Excel|exportExcelLink|excelDownloadHref/);
  assert.match(siteHtml, /assets\/electricity-market-hero\.png/);
  assert.match(siteHtml, /hero-card/);
  assert.match(archiveHtml, /电力市场知识库/);
  assert.doesNotMatch(archiveHtml, /导出 Excel|exportExcelLink|excelDownloadHref/);
  assert.match(archiveHtml, /assets\/electricity-market-hero\.png/);
  assert.ok(siteHeroAsset.size > 1000);
  assert.ok(archiveHeroAsset.size > 1000);
  await assert.rejects(
    fs.stat(path.join(tmpDir, "docs", "downloads", "电力市场知识库-2026-07-14.xlsx")),
    /ENOENT/,
    "发布流程不应再生成 Excel 下载文件",
  );
  assert.equal("excelPath" in result, false);
  assert.equal(nojekyll, "");
  assert.equal(result.pagesUrl, "https://wuchaodzxx.github.io/electricity-market-knowledge-base/");
});
