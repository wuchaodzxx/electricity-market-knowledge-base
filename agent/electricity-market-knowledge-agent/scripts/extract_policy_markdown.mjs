import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { pathToFileURL } from "node:url";

const DEFAULT_OCR_LANGUAGE = "chi_sim+eng";
const SUPPORTED_EXTENSIONS = new Set([".pdf", ".doc", ".docx", ".wps", ".xls", ".xlsx"]);

function readOption(name) {
  const position = process.argv.indexOf(name);
  return position === -1 ? undefined : process.argv[position + 1];
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function safeName(value) {
  return String(value ?? "")
    .trim()
    .replace(/[\\/:*?"<>|]/g, "-")
    .replace(/\s+/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80) || "未命名";
}

function yamlValue(value) {
  return JSON.stringify(String(value ?? ""));
}

function markdownEscape(value) {
  return String(value ?? "").replaceAll("\r\n", "\n").trim();
}

export function classifySourceFile(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  if (extension === ".pdf") return "pdf";
  if ([".doc", ".docx", ".wps"].includes(extension)) return "word";
  if ([".xls", ".xlsx"].includes(extension)) return "excel";
  return "unsupported";
}

export function markdownRelativePath(documentId, title) {
  const fileName = safeName(title).replace(/^附件：?/, "附件-");
  return path.posix.join("knowledge-markdown", safeName(documentId), `${fileName}.md`);
}

export function isScannedPdfText(text, pageCount = 1) {
  const compact = String(text ?? "").replace(/\s+/g, "");
  const chineseCount = (compact.match(/[\u4e00-\u9fff]/g) ?? []).length;
  const pages = Math.max(Number(pageCount) || 1, 1);
  return compact.length < 300 || compact.length / pages < 80 || chineseCount < 30;
}

async function defaultRunCommand(command, args, options = {}) {
  return await new Promise((resolve) => {
    const child = spawn(command, args, { cwd: options.cwd, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", (error) => {
      resolve({ stdout, stderr: `${stderr}\n${error.message}`.trim(), exitCode: 127 });
    });
    child.on("close", (exitCode) => {
      resolve({ stdout, stderr, exitCode: exitCode ?? 0 });
    });
  });
}

async function pathExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function extractPdfPageCount(pdfPath, runCommand) {
  const result = await runCommand("pdfinfo", [pdfPath]);
  const match = result.stdout?.match(/^Pages:\s+(\d+)/m);
  return match ? Number(match[1]) : 1;
}

async function extractPdfText(pdfPath, runCommand) {
  const result = await runCommand("pdftotext", ["-layout", pdfPath, "-"]);
  if ((result.exitCode ?? 0) !== 0) return "";
  return result.stdout ?? "";
}

async function extractPdfMarkdown(sourcePath, context) {
  const { runCommand, tempDir, ocrLanguage } = context;
  const pageCount = await extractPdfPageCount(sourcePath, runCommand).catch(() => 1);
  const directText = await extractPdfText(sourcePath, runCommand);
  if (!isScannedPdfText(directText, pageCount)) {
    return {
      body: directText,
      extraction: {
        method: "pdf-text",
        ocrStatus: "not-needed",
      },
    };
  }

  await fs.mkdir(tempDir, { recursive: true });
  const ocrPdfPath = path.join(tempDir, `${safeName(path.basename(sourcePath, ".pdf"))}-ocr.pdf`);
  const sidecarPath = path.join(tempDir, `${safeName(path.basename(sourcePath, ".pdf"))}-ocr.txt`);
  const ocrResult = await runCommand("ocrmypdf", [
    "--language",
    ocrLanguage,
    "--deskew",
    "--rotate-pages",
    "--skip-text",
    "--sidecar",
    sidecarPath,
    sourcePath,
    ocrPdfPath,
  ]);

  if ((ocrResult.exitCode ?? 0) !== 0) {
    return {
      body: "OCR 工具不可用或识别失败。请安装 OCRmyPDF、Tesseract 及 chi_sim+eng 语言包后重新运行提取脚本。",
      extraction: {
        method: "ocr",
        ocrStatus: "failed",
        note: ocrResult.stderr || "ocrmypdf failed",
      },
    };
  }

  let ocrText = "";
  if (await pathExists(sidecarPath)) {
    ocrText = await fs.readFile(sidecarPath, "utf8");
  }
  if (!ocrText.trim() && await pathExists(ocrPdfPath)) {
    ocrText = await extractPdfText(ocrPdfPath, runCommand);
  }
  return {
    body: ocrText || "OCR 已执行，但未提取到可用文本，需人工核验。",
    extraction: {
      method: "ocr",
      ocrStatus: ocrText.trim().length > 0 ? "success" : "partial",
    },
  };
}

async function extractOfficeMarkdown(sourcePath, context) {
  const { runCommand, tempDir } = context;
  const textutil = await runCommand("textutil", ["-convert", "txt", "-stdout", sourcePath]);
  if ((textutil.exitCode ?? 0) === 0 && textutil.stdout?.trim()) {
    return {
      body: textutil.stdout,
      extraction: { method: "office", ocrStatus: "not-needed" },
    };
  }

  await fs.mkdir(tempDir, { recursive: true });
  const soffice = await runCommand("soffice", ["--headless", "--convert-to", "txt:Text", "--outdir", tempDir, sourcePath]);
  const convertedPath = path.join(tempDir, `${path.basename(sourcePath, path.extname(sourcePath))}.txt`);
  if ((soffice.exitCode ?? 0) === 0 && await pathExists(convertedPath)) {
    const convertedText = await fs.readFile(convertedPath, "utf8");
    return {
      body: convertedText,
      extraction: { method: "office", ocrStatus: "not-needed" },
    };
  }

  return {
    body: "Office/WPS 文件暂未成功提取文本，需人工核验或安装/更新 LibreOffice 后重试。",
    extraction: {
      method: "office",
      ocrStatus: "failed",
      note: soffice.stderr || textutil.stderr || "office extraction failed",
    },
  };
}

export async function extractSpreadsheetWithPython(sourcePath, runCommand = defaultRunCommand) {
  const code = `
import sys, openpyxl
path = sys.argv[1]
wb = openpyxl.load_workbook(path, data_only=True, read_only=True)
parts = []
for ws in wb.worksheets:
    parts.append(f"# {ws.title}")
    rows = []
    for row in ws.iter_rows(values_only=True):
        values = ["" if cell is None else str(cell) for cell in row]
        if any(v.strip() for v in values):
            rows.append(values)
    if not rows:
        parts.append("")
        parts.append("（空表）")
        continue
    width = max(len(row) for row in rows)
    rows = [row + [""] * (width - len(row)) for row in rows]
    parts.append("")
    parts.append("| " + " | ".join(rows[0]) + " |")
    parts.append("| " + " | ".join(["---"] * width) + " |")
    for row in rows[1:]:
        parts.append("| " + " | ".join(cell.replace("|", "\\\\|") for cell in row) + " |")
print("\\n".join(parts))
`;
  const result = await runCommand("python3", ["-c", code, sourcePath]);
  if ((result.exitCode ?? 0) !== 0) {
    return "Excel 文件暂未成功提取文本，需确认 Python openpyxl 可用后重试。";
  }
  return result.stdout ?? "";
}

async function extractExcelMarkdown(sourcePath, context) {
  const body = await context.extractSpreadsheet(sourcePath, context.runCommand);
  return {
    body,
    extraction: {
      method: "excel",
      ocrStatus: body.includes("暂未成功") ? "failed" : "not-needed",
    },
  };
}

function renderMarkdownFile({ title, documentNumber, sourceFilePath, extraction, body, extractedAt }) {
  const status = extraction.ocrStatus ?? "not-run";
  const method = extraction.method ?? "unknown";
  const note = extraction.note ? `note: ${yamlValue(extraction.note)}\n` : "";
  return `---\ntitle: ${yamlValue(title)}\ndocumentNumber: ${yamlValue(documentNumber)}\nsourceFile: ${yamlValue(sourceFilePath)}\nextractionMethod: ${method}\nocrStatus: ${status}\nextractedAt: ${extractedAt}\n${note}---\n\n# ${title}\n\n${markdownEscape(body) || "未提取到可用文本，需人工核验。"}\n`;
}

async function extractOneSource({ sourcePath, sourceFilePath, title, documentNumber, outputPath, extractedAt, context }) {
  const kind = classifySourceFile(sourcePath);
  let result;
  if (!SUPPORTED_EXTENSIONS.has(path.extname(sourcePath).toLowerCase())) {
    result = {
      body: "暂不支持该附件格式，需人工核验。",
      extraction: { method: "unsupported", ocrStatus: "failed" },
    };
  } else if (kind === "pdf") {
    result = await extractPdfMarkdown(sourcePath, context);
  } else if (kind === "word") {
    result = await extractOfficeMarkdown(sourcePath, context);
  } else if (kind === "excel") {
    result = await extractExcelMarkdown(sourcePath, context);
  }

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, renderMarkdownFile({
    title,
    documentNumber,
    sourceFilePath,
    extraction: result.extraction,
    body: result.body,
    extractedAt,
  }), "utf8");

  return {
    method: result.extraction.method,
    ocrStatus: result.extraction.ocrStatus,
    extractedAt,
    note: result.extraction.note,
  };
}

export async function extractPolicyMarkdown(store, options = {}) {
  const docsRoot = options.docsRoot ?? "docs";
  const extractedAt = options.extractedAt ?? today();
  const runCommand = options.runCommand ?? defaultRunCommand;
  const extractSpreadsheet = options.extractSpreadsheet ?? extractSpreadsheetWithPython;
  const ocrLanguage = options.ocrLanguage ?? DEFAULT_OCR_LANGUAGE;
  const tempDir = options.tempDir ?? path.join(os.tmpdir(), "electricity-market-markdown-extract");
  const context = { runCommand, extractSpreadsheet, ocrLanguage, tempDir };
  const results = [];

  for (const document of store.policyDocuments ?? []) {
    const policyRel = markdownRelativePath(document.id, "政策正文");
    const policyOutputPath = path.join(docsRoot, policyRel);
    const policySourcePath = path.join(docsRoot, document.localFilePath);
    const policyExtraction = await extractOneSource({
      sourcePath: policySourcePath,
      sourceFilePath: document.localFilePath,
      title: document.title,
      documentNumber: document.documentNumber,
      outputPath: policyOutputPath,
      extractedAt,
      context,
    });
    document.markdownFilePath = policyRel;
    document.markdownExtraction = policyExtraction;

    document.attachmentMarkdownFiles = [];
    for (const attachment of document.localAttachments ?? []) {
      const attachmentRel = markdownRelativePath(document.id, attachment.title);
      const attachmentOutputPath = path.join(docsRoot, attachmentRel);
      const attachmentExtraction = await extractOneSource({
        sourcePath: path.join(docsRoot, attachment.localFilePath),
        sourceFilePath: attachment.localFilePath,
        title: attachment.title,
        documentNumber: document.documentNumber,
        outputPath: attachmentOutputPath,
        extractedAt,
        context,
      });
      document.attachmentMarkdownFiles.push({
        title: attachment.title,
        sourceFilePath: attachment.localFilePath,
        markdownFilePath: attachmentRel,
        extraction: attachmentExtraction,
      });
    }

    results.push({
      documentId: document.id,
      markdownFilePath: document.markdownFilePath,
      attachmentCount: document.attachmentMarkdownFiles.length,
      ocrStatus: document.markdownExtraction.ocrStatus,
    });
  }

  return results;
}

export async function extractPolicyMarkdownFile({
  inputPath,
  docsRoot = "docs",
  outputPath = inputPath,
  extractedAt = today(),
} = {}) {
  if (!inputPath) throw new Error("缺少 inputPath");
  const store = JSON.parse(await fs.readFile(inputPath, "utf8"));
  const results = await extractPolicyMarkdown(store, { docsRoot, extractedAt });
  await fs.writeFile(outputPath, `${JSON.stringify(store, null, 2)}\n`, "utf8");
  return results;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const inputPath = readOption("--input");
  const docsRoot = readOption("--docs-root") ?? "docs";
  const outputPath = readOption("--output") ?? inputPath;
  const extractedAt = readOption("--date") ?? today();
  const results = await extractPolicyMarkdownFile({ inputPath, docsRoot, outputPath, extractedAt });
  for (const result of results) {
    console.log(`${result.documentId}: ${result.markdownFilePath}，附件 ${result.attachmentCount} 个，OCR 状态 ${result.ocrStatus}`);
  }
}
