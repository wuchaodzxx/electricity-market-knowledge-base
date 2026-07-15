import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { exportKnowledgeBase } from "./export_knowledge_base.mjs";
import { exportWebPreview } from "./export_web_preview.mjs";
import { extractPolicyMarkdownFile } from "./extract_policy_markdown.mjs";

function readOption(name) {
  const position = process.argv.indexOf(name);
  return position === -1 ? undefined : process.argv[position + 1];
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

export async function prepareGitHubPagesSite({
  inputPath,
  outputsDir = "outputs",
  sitePath = "docs/index.html",
  date = today(),
} = {}) {
  if (!inputPath) {
    throw new Error("缺少 inputPath");
  }

  const archivePath = path.join(outputsDir, `电力市场知识库-网页预览-${date}.html`);
  const excelFileName = `电力市场知识库-${date}.xlsx`;
  const excelPath = path.join(path.dirname(sitePath), "downloads", excelFileName);
  const excelDownloadHref = `downloads/${excelFileName}`;
  const docsRoot = path.dirname(sitePath);

  await extractPolicyMarkdownFile({
    inputPath,
    outputPath: inputPath,
    docsRoot,
    extractedAt: date,
  });
  await exportKnowledgeBase(inputPath, excelPath);
  await exportWebPreview(inputPath, archivePath, { excelDownloadHref });
  await exportWebPreview(inputPath, sitePath, { excelDownloadHref });
  await fs.writeFile(path.join(path.dirname(sitePath), ".nojekyll"), "", "utf8");

  return {
    archivePath,
    excelPath,
    sitePath,
    pagesUrl: "https://wuchaodzxx.github.io/electricity-market-knowledge-base/",
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const inputPath = readOption("--input");
  const outputsDir = readOption("--outputs-dir") ?? "outputs";
  const sitePath = readOption("--site") ?? "docs/index.html";
  const date = readOption("--date") ?? today();

  const result = await prepareGitHubPagesSite({ inputPath, outputsDir, sitePath, date });
  console.log(`网页归档已生成：${result.archivePath}`);
  console.log(`GitHub Pages 首页已更新：${result.sitePath}`);
  console.log(`公开访问地址：${result.pagesUrl}`);
}
