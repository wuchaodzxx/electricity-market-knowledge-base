import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  classifySourceFile,
  extractPolicyMarkdown,
  isScannedPdfText,
  markdownRelativePath,
} from "../scripts/extract_policy_markdown.mjs";

function sampleStore() {
  return {
    metadata: {
      schemaVersion: 1,
      supportedProvinces: ["江苏", "浙江", "山西", "湖北", "四川", "山东", "甘肃", "安徽"],
      lastUpdatedAt: "2026-07-15",
    },
    concepts: [],
    policyDocuments: [
      {
        id: "doc-test",
        title: "测试政策",
        documentNumber: "测政〔2026〕1号",
        issuer: "测试单位",
        publishedAt: "2026-01-02",
        officialUrl: "https://example.gov.cn/policy",
        localFilePath: "source-files/test-policy.pdf",
        localAttachments: [
          {
            title: "附件：测试表格",
            officialUrl: "https://example.gov.cn/attachment.xlsx",
            localFilePath: "source-files/attachments/test/attachment.xlsx",
          },
        ],
        scope: "江苏",
        status: "有效",
        firstRecordedAt: "2026-07-15",
        lastVerifiedAt: "2026-07-15",
        knowledgeSummary: "测试政策用于验证来源文件和附件可提取为 Markdown。",
        detailedSummary: "用于测试。",
      },
    ],
    provincialRules: [],
    updateEvents: [],
  };
}

test("classifies policy source file formats that the extractor must support", () => {
  assert.equal(classifySourceFile("a.pdf"), "pdf");
  assert.equal(classifySourceFile("a.doc"), "word");
  assert.equal(classifySourceFile("a.docx"), "word");
  assert.equal(classifySourceFile("a.wps"), "word");
  assert.equal(classifySourceFile("a.xls"), "excel");
  assert.equal(classifySourceFile("a.xlsx"), "excel");
});

test("detects likely scanned PDFs from sparse extracted text", () => {
  assert.equal(isScannedPdfText("", 3), true);
  assert.equal(isScannedPdfText("目录\n1\n2", 5), true);
  assert.equal(isScannedPdfText("这是可直接提取的中文政策文本。".repeat(60), 2), false);
});

test("builds stable markdown paths under docs/knowledge-markdown", () => {
  assert.equal(
    markdownRelativePath("doc-test", "政策正文"),
    "knowledge-markdown/doc-test/政策正文.md",
  );
  assert.equal(
    markdownRelativePath("doc-test", "附件：测试/表格"),
    "knowledge-markdown/doc-test/附件-测试-表格.md",
  );
});

test("extracts policy files and attachments to markdown and writes metadata", async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "policy-md-"));
  const docsRoot = path.join(tmpDir, "docs");
  await fs.mkdir(path.join(docsRoot, "source-files", "attachments", "test"), { recursive: true });
  await fs.writeFile(path.join(docsRoot, "source-files", "test-policy.pdf"), "fake pdf", "utf8");
  await fs.writeFile(path.join(docsRoot, "source-files", "attachments", "test", "attachment.xlsx"), "fake xlsx", "utf8");

  const calls = [];
  const store = sampleStore();
  await extractPolicyMarkdown(store, {
    docsRoot,
    extractedAt: "2026-07-15",
    runCommand: async (command, args) => {
      calls.push([command, args]);
      if (command === "pdftotext") {
        return { stdout: "这是测试政策 PDF 正文，可直接提取为 Markdown。".repeat(20), stderr: "" };
      }
      throw new Error(`unexpected command ${command}`);
    },
    extractSpreadsheet: async () => "# Sheet1\n\n| A | B |\n| --- | --- |\n| 1 | 2 |",
  });

  const document = store.policyDocuments[0];
  assert.equal(document.markdownFilePath, "knowledge-markdown/doc-test/政策正文.md");
  assert.equal(document.markdownExtraction.method, "pdf-text");
  assert.equal(document.markdownExtraction.ocrStatus, "not-needed");
  assert.equal(document.attachmentMarkdownFiles[0].markdownFilePath, "knowledge-markdown/doc-test/附件-测试表格.md");
  assert.equal(document.attachmentMarkdownFiles[0].extraction.method, "excel");
  assert.ok(calls.some(([command]) => command === "pdftotext"), "PDF 应优先尝试 pdftotext");

  const markdown = await fs.readFile(path.join(docsRoot, document.markdownFilePath), "utf8");
  assert.match(markdown, /extractionMethod: pdf-text/);
  assert.match(markdown, /ocrStatus: not-needed/);
  assert.match(markdown, /# 测试政策/);
});

test("records OCR fallback status for likely scanned PDFs", async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "policy-md-ocr-"));
  const docsRoot = path.join(tmpDir, "docs");
  await fs.mkdir(path.join(docsRoot, "source-files"), { recursive: true });
  await fs.writeFile(path.join(docsRoot, "source-files", "test-policy.pdf"), "fake pdf", "utf8");

  const store = sampleStore();
  store.policyDocuments[0].localAttachments = [];
  await extractPolicyMarkdown(store, {
    docsRoot,
    extractedAt: "2026-07-15",
    runCommand: async (command) => {
      if (command === "pdftotext") return { stdout: "", stderr: "" };
      if (command === "ocrmypdf") return { stdout: "", stderr: "ocrmypdf missing", exitCode: 127 };
      throw new Error(`unexpected command ${command}`);
    },
  });

  const document = store.policyDocuments[0];
  assert.equal(document.markdownExtraction.method, "ocr");
  assert.equal(document.markdownExtraction.ocrStatus, "failed");
  const markdown = await fs.readFile(path.join(docsRoot, document.markdownFilePath), "utf8");
  assert.match(markdown, /OCR 工具不可用或识别失败/);
});
