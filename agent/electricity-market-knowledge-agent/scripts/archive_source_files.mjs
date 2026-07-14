import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const INVALID_FILENAME_CHARS = /[\\/:*?"<>|]/g;

function readOption(name) {
  const position = process.argv.indexOf(name);
  return position === -1 ? undefined : process.argv[position + 1];
}

function normalizedDate(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : "";
}

function titleForFileName(title) {
  const value = String(title ?? "").trim();
  const aboutIndex = value.indexOf("关于");
  if (aboutIndex > 0) return value.slice(aboutIndex);
  return value;
}

function extensionFrom(document, contentType = "") {
  const urlPath = new URL(document.officialUrl).pathname.toLowerCase();
  if (urlPath.endsWith(".pdf") || contentType.includes("pdf")) return ".pdf";
  if (urlPath.endsWith(".docx") || contentType.includes("wordprocessingml")) return ".docx";
  if (urlPath.endsWith(".doc") || contentType.includes("msword")) return ".doc";
  if (urlPath.endsWith(".xlsx") || contentType.includes("spreadsheetml")) return ".xlsx";
  if (urlPath.endsWith(".xls") || contentType.includes("excel")) return ".xls";
  return ".html";
}

function cleanFileNamePart(value) {
  return String(value ?? "")
    .replace(INVALID_FILENAME_CHARS, "")
    .replace(/\s+/g, "")
    .trim();
}

export function buildArchivedFileName(document, contentType = "") {
  const date = normalizedDate(document.publishedAt);
  const title = cleanFileNamePart(titleForFileName(document.title));
  const documentNumber = cleanFileNamePart(document.documentNumber);
  const base = [
    date,
    `${title}${documentNumber ? `(${documentNumber})` : ""}`,
  ].filter(Boolean).join("-");
  return `${base.slice(0, 180)}${extensionFrom(document, contentType)}`;
}

export async function archivePolicyDocuments({
  inputPath,
  sourceDir = "docs/source-files",
  publicPrefix = "source-files",
  fetchImpl = fetch,
} = {}) {
  if (!inputPath) throw new Error("缺少 inputPath");

  const store = JSON.parse(await fs.readFile(inputPath, "utf8"));
  await fs.mkdir(sourceDir, { recursive: true });

  const archived = [];
  const failed = [];

  for (const document of store.policyDocuments ?? []) {
    try {
      const response = await fetchImpl(document.officialUrl, {
        headers: {
          "user-agent": "Mozilla/5.0 Codex electricity-market-knowledge-agent",
        },
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const contentType = response.headers?.get?.("content-type") ?? "";
      const fileName = buildArchivedFileName(document, contentType);
      const filePath = path.join(sourceDir, fileName);
      const body = Buffer.from(await response.arrayBuffer());
      await fs.writeFile(filePath, body);
      document.localFilePath = `${publicPrefix.replace(/\/$/, "")}/${fileName}`;
      archived.push({ id: document.id, filePath, localFilePath: document.localFilePath });
    } catch (error) {
      failed.push({ id: document.id, officialUrl: document.officialUrl, error: error.message });
    }
  }

  await fs.writeFile(inputPath, `${JSON.stringify(store, null, 2)}\n`, "utf8");
  return { archived, failed };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const inputPath = readOption("--input");
  const sourceDir = readOption("--source-dir") ?? "docs/source-files";
  const publicPrefix = readOption("--public-prefix") ?? "source-files";
  const result = await archivePolicyDocuments({ inputPath, sourceDir, publicPrefix });
  for (const item of result.archived) {
    console.log(`已归档：${item.id} -> ${item.localFilePath}`);
  }
  for (const item of result.failed) {
    console.error(`归档失败：${item.id} ${item.officialUrl} ${item.error}`);
  }
  if (result.failed.length > 0) {
    process.exitCode = 1;
  }
}
