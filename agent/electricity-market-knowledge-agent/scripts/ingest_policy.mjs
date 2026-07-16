import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { extractAttachmentLinks } from "./archive_source_files.mjs";

function readOption(name) {
  const position = process.argv.indexOf(name);
  return position === -1 ? undefined : process.argv[position + 1];
}

function today() {
  return new Date().toISOString().slice(0, 10);
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

function firstMatch(patterns, text) {
  for (const pattern of patterns) {
    const match = String(text ?? "").match(pattern);
    if (match) return match[1] ?? match[0];
  }
  return "";
}

function extractTitle(html) {
  return firstMatch([
    /<h1\b[^>]*>([\s\S]*?)<\/h1>/i,
    /<title\b[^>]*>([\s\S]*?)<\/title>/i,
  ], html);
}

function normalizeDate(value) {
  const text = String(value ?? "");
  const dashed = text.match(/(20\d{2})[-/.年](\d{1,2})[-/.月](\d{1,2})/);
  if (!dashed) return "";
  const [, year, month, day] = dashed;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

function extractDate(html, officialUrl) {
  return normalizeDate(firstMatch([
    /发布时间[：:\s]*(20\d{2}[-/.年]\d{1,2}[-/.月]\d{1,2})/,
    /发布日期[：:\s]*(20\d{2}[-/.年]\d{1,2}[-/.月]\d{1,2})/,
    /时间[：:\s]*(20\d{2}[-/.年]\d{1,2}[-/.月]\d{1,2})/,
    /(20\d{2}[-/.年]\d{1,2}[-/.月]\d{1,2})/,
  ], stripTags(html))) || normalizeDate(officialUrl);
}

function extractDocumentNumber(html) {
  const text = stripTags(html);
  const knownPrefixMatch = text.match(
    /((?:发改|国能|国发|国办发|能源|价格|市场|工信|财建|环办|苏发改|浙发改|晋发改|鄂发改|川发改|鲁发改|甘发改|皖发改|华中监能|江苏能源监办|浙江能源监办|山西能源监办|湖北能源监办|四川能源监办|山东能源监办|甘肃能源监办|安徽能源监办)[\u4e00-\u9fa5A-Za-z]{0,10}[〔﹝]20\d{2}[〕﹞]\d+号)/
  );
  if (knownPrefixMatch) return knownPrefixMatch[1];

  const broadMatch = text.match(/([\u4e00-\u9fa5A-Za-z]{1,12}[〔﹝]20\d{2}[〕﹞]\d+号)/);
  return broadMatch ? broadMatch[1] : "未见正式文号";
}

function inferIssuerFromTitle(title) {
  const normalized = String(title ?? "");
  const aboutIndex = normalized.indexOf("关于");
  if (aboutIndex > 0) return normalized.slice(0, aboutIndex).replace(/[、，,]\s*$/, "").trim();
  return "";
}

function safeIdPart(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

function buildDraftId({ officialUrl, title, documentNumber, publishedAt }) {
  const numberPart = documentNumber && documentNumber !== "未见正式文号" ? safeIdPart(documentNumber) : "";
  if (numberPart) return `draft-${numberPart}`;
  const datePart = publishedAt || today();
  let urlPart = "";
  try {
    urlPart = safeIdPart(path.basename(new URL(officialUrl).pathname, path.extname(new URL(officialUrl).pathname)));
  } catch {
    urlPart = "";
  }
  return `draft-${safeIdPart(datePart)}-${urlPart || safeIdPart(title) || "policy"}`;
}

async function fetchHtml(officialUrl, fetchImpl) {
  const response = await fetchImpl(officialUrl, {
    headers: {
      "user-agent": "Mozilla/5.0 Codex electricity-market-knowledge-agent",
    },
  });
  if (!response.ok) throw new Error(`官方页面获取失败：HTTP ${response.status}`);
  if (typeof response.text === "function") return await response.text();
  const buffer = Buffer.from(await response.arrayBuffer());
  return buffer.toString("utf8");
}

export async function createPolicyDraft({
  officialUrl,
  localFilePath = "",
  scope = "",
  outputDir = "intake/policy-drafts",
  fetchImpl = fetch,
  overrides = {},
} = {}) {
  const url = officialUrl || overrides.officialUrl;
  if (!url || !String(url).startsWith("https://")) {
    throw new Error("必须提供官方 HTTPS 链接：--url 或 --official-url");
  }

  const html = await fetchHtml(url, fetchImpl);
  const title = overrides.title || stripTags(extractTitle(html)) || "待补充标题";
  const publishedAt = overrides.publishedAt || extractDate(html, url);
  const documentNumber = overrides.documentNumber || extractDocumentNumber(html);
  const issuer = overrides.issuer || inferIssuerFromTitle(title) || "待补充发布单位";
  const attachments = extractAttachmentLinks(html, url);
  const draft = {
    id: overrides.id || buildDraftId({ officialUrl: url, title, documentNumber, publishedAt }),
    title,
    documentNumber,
    issuer,
    publishedAt: publishedAt || "待补充发布日期",
    officialUrl: url,
    scope: scope || overrides.scope || "待确认",
    status: "待核验",
    localSourceCandidate: localFilePath || "",
    attachments,
    knowledgeSummary: "待补充：请阅读官方网页正文和附件后生成 200 字以内纯文本摘要。",
    detailedSummary: "待补充：请基于官方网页正文和附件内容生成结构化详细解读。",
    readyForKnowledgeBase: false,
    createdAt: today(),
    nextSteps: [
      "核对标题、发布单位、发布日期、文号和适用范围。",
      "下载/归档政策正文 PDF 和附件。",
      "提取 Markdown 原文后，补充 knowledgeSummary 与 detailedSummary。",
      "校验通过后再写入 knowledge-base/electricity-market.json。",
    ],
  };

  await fs.mkdir(outputDir, { recursive: true });
  const outputPath = path.join(outputDir, `${draft.id}.json`);
  await fs.writeFile(outputPath, `${JSON.stringify(draft, null, 2)}\n`, "utf8");
  return { draft, outputPath };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const officialUrl = readOption("--url") ?? readOption("--official-url");
  const localFilePath = readOption("--file") ?? "";
  const outputDir = readOption("--output-dir") ?? "intake/policy-drafts";
  const scope = readOption("--scope") ?? "";
  const overrides = {
    id: readOption("--id"),
    title: readOption("--title"),
    documentNumber: readOption("--document-number"),
    issuer: readOption("--issuer"),
    publishedAt: readOption("--published-at"),
  };
  const result = await createPolicyDraft({ officialUrl, localFilePath, outputDir, scope, overrides });
  console.log(`政策草稿已生成：${result.outputPath}`);
}
