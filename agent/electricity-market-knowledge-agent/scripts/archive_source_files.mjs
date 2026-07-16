import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const INVALID_FILENAME_CHARS = /[\\/:*?"<>|]/g;
const HTML_CONTENT_TYPES = ["text/html", "application/xhtml+xml"];
const ATTACHMENT_EXTENSIONS = new Set([
  ".pdf",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".csv",
  ".zip",
  ".rar",
  ".7z",
]);

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

function cleanFileNamePart(value) {
  return String(value ?? "")
    .replace(INVALID_FILENAME_CHARS, "")
    .replace(/\s+/g, "")
    .trim();
}

function baseArchivedFileName(document) {
  const date = normalizedDate(document.publishedAt);
  const title = cleanFileNamePart(titleForFileName(document.title));
  const documentNumber = cleanFileNamePart(document.documentNumber);
  return [
    date,
    `${title}${documentNumber ? `(${documentNumber})` : ""}`,
  ].filter(Boolean).join("-").slice(0, 180);
}

export function buildArchivedFileName(document) {
  return `${baseArchivedFileName(document)}.pdf`;
}

function isHtmlContentType(contentType = "") {
  const normalized = contentType.toLowerCase();
  return HTML_CONTENT_TYPES.some((item) => normalized.includes(item));
}

function extensionFromContentType(contentType = "") {
  const normalized = contentType.toLowerCase();
  if (normalized.includes("pdf")) return ".pdf";
  if (normalized.includes("wordprocessingml")) return ".docx";
  if (normalized.includes("msword")) return ".doc";
  if (normalized.includes("spreadsheetml")) return ".xlsx";
  if (normalized.includes("excel")) return ".xls";
  if (normalized.includes("zip")) return ".zip";
  if (normalized.includes("csv")) return ".csv";
  return "";
}

function extensionFromUrl(url) {
  try {
    const ext = path.extname(new URL(url).pathname).toLowerCase();
    return ATTACHMENT_EXTENSIONS.has(ext) ? ext : "";
  } catch {
    return "";
  }
}

function decodeHtmlEntities(value) {
  return String(value ?? "")
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(Number.parseInt(code, 16)));
}

function stripTags(value) {
  return decodeHtmlEntities(String(value ?? "").replace(/<[^>]*>/g, ""))
    .replace(/\s+/g, " ")
    .trim();
}

function isAttachmentCandidate(href, text) {
  const lowerHref = String(href ?? "").toLowerCase();
  const linkText = String(text ?? "");
  if (/\.(pdf|doc|docx|xls|xlsx|csv|zip|rar|7z)(?:[?#]|$)/i.test(lowerHref)) return true;
  return /附件|下载|附表/i.test(linkText) && /\/[PW]\d{12,}/i.test(lowerHref);
}

export function extractAttachmentLinks(html, pageUrl) {
  const attachments = [];
  const seen = new Set();
  const anchorPattern = /<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  for (const match of html.matchAll(anchorPattern)) {
    const href = decodeHtmlEntities(match[1]).trim();
    const title = stripTags(match[2]) || "附件";
    if (!href || href.startsWith("#") || href.startsWith("javascript:") || href.startsWith("mailto:")) continue;
    if (!isAttachmentCandidate(href, title)) continue;
    let absoluteUrl;
    try {
      absoluteUrl = new URL(href, pageUrl).href;
    } catch {
      continue;
    }
    if (!absoluteUrl.startsWith("https://")) continue;
    if (seen.has(absoluteUrl)) continue;
    seen.add(absoluteUrl);
    attachments.push({ title, officialUrl: absoluteUrl });
  }
  return attachments;
}

function safeAttachmentFileName({ title, officialUrl, contentType }, index) {
  let rawName = "";
  try {
    rawName = decodeURIComponent(path.basename(new URL(officialUrl).pathname));
  } catch {
    rawName = "";
  }
  const urlExt = extensionFromUrl(officialUrl);
  const contentExt = extensionFromContentType(contentType);
  const ext = urlExt || contentExt || ".bin";
  const baseFromUrl = rawName && path.extname(rawName) ? rawName.slice(0, -path.extname(rawName).length) : rawName;
  const base = cleanFileNamePart(baseFromUrl || title || `附件${index + 1}`) || `附件${index + 1}`;
  return `${base.slice(0, 120)}${ext}`;
}

function uniqueFileName(fileName, usedNames) {
  if (!usedNames.has(fileName)) {
    usedNames.add(fileName);
    return fileName;
  }
  const ext = path.extname(fileName);
  const base = fileName.slice(0, -ext.length);
  let index = 2;
  while (usedNames.has(`${base}-${index}${ext}`)) index += 1;
  const unique = `${base}-${index}${ext}`;
  usedNames.add(unique);
  return unique;
}

function publicUrl(siteBaseUrl, localFilePath) {
  if (!siteBaseUrl) return localFilePath;
  return new URL(localFilePath, siteBaseUrl.endsWith("/") ? siteBaseUrl : `${siteBaseUrl}/`).href;
}

function attachmentAppendixHtml(document, attachments, siteBaseUrl) {
  if (attachments.length === 0) return "";
  const items = attachments.map((attachment) => {
    const href = publicUrl(siteBaseUrl, attachment.localFilePath);
    return `<li style="margin: 10px 0;"><a href="${href}" target="_blank" rel="noopener noreferrer">${escapeHtml(attachment.title)}</a><br><small style="color:#4b5563;">${escapeHtml(attachment.localFilePath)}</small></li>`;
  }).join("");
  return `
    <section lang="zh-CN" style="break-before: page; page-break-before: always; padding: 32px; font-family: 'PingFang SC', 'Songti SC', 'Heiti SC', 'STHeiti', 'Arial Unicode MS', sans-serif !important; color: #111827; font-size: 14px; line-height: 1.8;">
      <h1 style="font-size: 22px; margin: 0 0 12px;">附件归档</h1>
      <p style="color: #555; line-height: 1.7;">以下附件已随政策《${escapeHtml(document.title)}》下载到本地归档。点击链接可打开本站保存的附件副本。</p>
      <ol style="line-height: 1.8; padding-left: 24px;">${items}</ol>
    </section>
  `;
}

function fallbackPolicyHtml(document, html, attachments, siteBaseUrl) {
  const text = stripTags(html).slice(0, 18_000);
  return `<!doctype html>
  <html lang="zh-CN">
    <head>
      <meta charset="utf-8" />
      <style>
        @page { size: A4; margin: 16mm; }
        body { font-family: "PingFang SC", "Songti SC", "Heiti SC", "STHeiti", sans-serif; line-height: 1.75; color: #111827; }
        h1 { font-size: 24px; line-height: 1.35; }
        .meta { color: #4b5563; border: 1px solid #e5e7eb; border-radius: 10px; padding: 12px; margin: 16px 0; }
        pre { white-space: pre-wrap; font-family: inherit; }
        a { color: #0969da; }
      </style>
    </head>
    <body>
      <h1>${escapeHtml(document.title)}</h1>
      <section class="meta">
        <div>发文编号：${escapeHtml(document.documentNumber)}</div>
        <div>发布单位：${escapeHtml(document.issuer)}</div>
        <div>发布日期：${escapeHtml(document.publishedAt)}</div>
        <div>官方链接：<a href="${escapeHtml(document.officialUrl)}">${escapeHtml(document.officialUrl)}</a></div>
      </section>
      <p>说明：官方网页无法完整渲染样式时，本 PDF 使用抓取到的网页正文生成兜底归档，并保留官方链接与附件归档入口。</p>
      <pre>${escapeHtml(text || "未能提取正文。请通过官方链接核验。")}</pre>
      ${attachmentAppendixHtml(document, attachments, siteBaseUrl)}
    </body>
  </html>`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function defaultRenderPdf({ document, html, outputPath, attachments, siteBaseUrl }) {
  const { chromium } = await import("playwright");
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
  } catch (error) {
    const fallbackExecutablePath = "/Users/wuchao/Library/Caches/ms-playwright/chromium-1228/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing";
    try {
      await fs.access(fallbackExecutablePath);
      browser = await chromium.launch({ headless: true, executablePath: fallbackExecutablePath });
    } catch {
      throw error;
    }
  }
  try {
    const page = await browser.newPage();
    let loadedOfficialPage = false;
    try {
      await page.goto(document.officialUrl, { waitUntil: "networkidle", timeout: 45_000 });
      loadedOfficialPage = true;
    } catch {
      if (!html) throw new Error("官方页面无法由浏览器打开，且没有可用 HTML 兜底内容");
      try {
        await page.setContent(html, { waitUntil: "domcontentloaded", timeout: 10_000 });
      } catch {
        await page.setContent(fallbackPolicyHtml(document, html, attachments, siteBaseUrl), { waitUntil: "load", timeout: 10_000 });
      }
    }

    await page.addStyleTag({
      content: `
        @page { size: A4; margin: 14mm; }
        body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        [lang="zh-CN"], [lang="zh-CN"] * { font-family: "PingFang SC", "Songti SC", "Heiti SC", "STHeiti", "Arial Unicode MS", sans-serif !important; }
        a { color: #0969da; }
      `,
    });
    const appendix = attachmentAppendixHtml(document, attachments, siteBaseUrl);
    if (appendix) {
      await page.evaluate((appendixHtml) => {
        document.body.insertAdjacentHTML("beforeend", appendixHtml);
      }, appendix);
    }
    await page.pdf({
      path: outputPath,
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
      displayHeaderFooter: true,
      headerTemplate: "<div></div>",
      footerTemplate: `<div style="font-size:8px;color:#777;width:100%;padding:0 12mm;text-align:right;"><span class="pageNumber"></span>/<span class="totalPages"></span></div>`,
    });
    return { loadedOfficialPage };
  } finally {
    await browser.close();
  }
}

async function downloadAttachments({
  attachmentLinks,
  document,
  sourceDir,
  publicPrefix,
  fetchImpl,
}) {
  const folderName = baseArchivedFileName(document);
  const attachmentDir = path.join(sourceDir, "attachments", folderName);
  const publicFolder = `${publicPrefix.replace(/\/$/, "")}/attachments/${folderName}`;
  const downloaded = [];
  const usedNames = new Set();

  if (attachmentLinks.length > 0) {
    await fs.mkdir(attachmentDir, { recursive: true });
  }

  for (const [index, attachment] of attachmentLinks.entries()) {
    const response = await fetchImpl(attachment.officialUrl, {
      headers: {
        "user-agent": "Mozilla/5.0 Codex electricity-market-knowledge-agent",
      },
    });
    if (!response.ok) {
      throw new Error(`附件下载失败 ${attachment.officialUrl} HTTP ${response.status}`);
    }
    const contentType = response.headers?.get?.("content-type") ?? "";
    const fileName = uniqueFileName(
      safeAttachmentFileName({ ...attachment, contentType }, index),
      usedNames,
    );
    const filePath = path.join(attachmentDir, fileName);
    const body = Buffer.from(await response.arrayBuffer());
    await fs.writeFile(filePath, body);
    downloaded.push({
      title: attachment.title,
      officialUrl: attachment.officialUrl,
      localFilePath: `${publicFolder}/${fileName}`,
    });
  }

  return downloaded;
}

async function pathExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function hasCompleteLocalArchive(document, sourceDir) {
  if (!document.localFilePath) return false;
  const docsRoot = path.dirname(sourceDir);
  const policyPath = path.join(docsRoot, document.localFilePath);
  if (!await pathExists(policyPath)) return false;
  for (const attachment of document.localAttachments ?? []) {
    if (!attachment.localFilePath) return false;
    if (!await pathExists(path.join(docsRoot, attachment.localFilePath))) return false;
  }
  return true;
}

export async function archivePolicyDocuments({
  inputPath,
  sourceDir = "docs/source-files",
  publicPrefix = "source-files",
  fetchImpl = fetch,
  renderPdfImpl = defaultRenderPdf,
  siteBaseUrl = "",
  force = false,
} = {}) {
  if (!inputPath) throw new Error("缺少 inputPath");

  const store = JSON.parse(await fs.readFile(inputPath, "utf8"));
  await fs.mkdir(sourceDir, { recursive: true });

  const archived = [];
  const failed = [];
  const skipped = [];

  for (const document of store.policyDocuments ?? []) {
    try {
      if (!force && await hasCompleteLocalArchive(document, sourceDir)) {
        skipped.push({
          id: document.id,
          localFilePath: document.localFilePath,
          attachmentCount: (document.localAttachments ?? []).length,
        });
        continue;
      }
      const response = await fetchImpl(document.officialUrl, {
        headers: {
          "user-agent": "Mozilla/5.0 Codex electricity-market-knowledge-agent",
        },
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const contentType = response.headers?.get?.("content-type") ?? "";
      const body = Buffer.from(await response.arrayBuffer());
      const html = isHtmlContentType(contentType) ? body.toString("utf8") : "";
      const attachmentLinks = html ? extractAttachmentLinks(html, document.officialUrl) : [];
      const attachments = await downloadAttachments({
        attachmentLinks,
        document,
        sourceDir,
        publicPrefix,
        fetchImpl,
      });

      const fileName = buildArchivedFileName(document);
      const filePath = path.join(sourceDir, fileName);
      if (contentType.toLowerCase().includes("pdf") || document.officialUrl.toLowerCase().endsWith(".pdf")) {
        await fs.writeFile(filePath, body);
      } else {
        await renderPdfImpl({
          document,
          html,
          outputPath: filePath,
          attachments,
          siteBaseUrl,
        });
      }
      document.localFilePath = `${publicPrefix.replace(/\/$/, "")}/${fileName}`;
      document.localAttachments = attachments;
      archived.push({
        id: document.id,
        filePath,
        localFilePath: document.localFilePath,
        attachmentCount: attachments.length,
      });
    } catch (error) {
      failed.push({ id: document.id, officialUrl: document.officialUrl, error: error.message });
    }
  }

  await fs.writeFile(inputPath, `${JSON.stringify(store, null, 2)}\n`, "utf8");
  return { archived, skipped, failed };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const inputPath = readOption("--input");
  const sourceDir = readOption("--source-dir") ?? "docs/source-files";
  const publicPrefix = readOption("--public-prefix") ?? "source-files";
  const siteBaseUrl = readOption("--site-base-url") ?? "";
  const force = process.argv.includes("--force");
  const result = await archivePolicyDocuments({
    inputPath,
    sourceDir,
    publicPrefix,
    siteBaseUrl,
    force,
  });
  for (const item of result.archived) {
    console.log(`已归档：${item.id} -> ${item.localFilePath}，附件 ${item.attachmentCount} 个`);
  }
  for (const item of result.skipped) {
    console.log(`已跳过：${item.id} -> ${item.localFilePath}，本地归档未变化`);
  }
  for (const item of result.failed) {
    console.error(`归档失败：${item.id} ${item.officialUrl} ${item.error}`);
  }
  if (result.failed.length > 0) {
    process.exitCode = 1;
  }
}
