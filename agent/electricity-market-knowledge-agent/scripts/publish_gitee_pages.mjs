import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { exportWebPreview } from "./export_web_preview.mjs";

const DEFAULT_REPOSITORY_URL = "https://gitee.com/wuchaodzxx/electricity-market-knowledge-base.git";
const DEFAULT_PAGES_URL = "https://wuchaodzxx.gitee.io/electricity-market-knowledge-base/";

function readOption(name) {
  const position = process.argv.indexOf(name);
  return position === -1 ? undefined : process.argv[position + 1];
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

async function removeStalePagesMarker(sitePath) {
  const markerPath = path.join(path.dirname(sitePath), ".nojekyll");
  try {
    await fs.rm(markerPath, { force: true });
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}

export async function prepareGiteeSite({
  inputPath,
  outputsDir = "outputs",
  sitePath = "docs/index.html",
  date = today(),
  repositoryUrl = DEFAULT_REPOSITORY_URL,
  pagesUrl = DEFAULT_PAGES_URL,
} = {}) {
  if (!inputPath) {
    throw new Error("缺少 inputPath");
  }

  const archivePath = path.join(outputsDir, `电力市场知识库-网页预览-${date}.html`);
  await exportWebPreview(inputPath, archivePath);
  await exportWebPreview(inputPath, sitePath);
  await removeStalePagesMarker(sitePath);

  return {
    archivePath,
    sitePath,
    repositoryUrl,
    pagesUrl,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const inputPath = readOption("--input");
  const outputsDir = readOption("--outputs-dir") ?? "outputs";
  const sitePath = readOption("--site") ?? "docs/index.html";
  const date = readOption("--date") ?? today();
  const repositoryUrl = readOption("--repository-url") ?? DEFAULT_REPOSITORY_URL;
  const pagesUrl = readOption("--pages-url") ?? DEFAULT_PAGES_URL;

  const result = await prepareGiteeSite({
    inputPath,
    outputsDir,
    sitePath,
    date,
    repositoryUrl,
    pagesUrl,
  });
  console.log(`网页归档已生成：${result.archivePath}`);
  console.log(`Gitee 首页已更新：${result.sitePath}`);
  console.log(`Gitee 仓库地址：${result.repositoryUrl}`);
  console.log(`候选公开访问地址：${result.pagesUrl}`);
}
