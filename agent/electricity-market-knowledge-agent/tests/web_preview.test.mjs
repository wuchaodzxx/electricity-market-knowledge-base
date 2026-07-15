import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { exportWebPreview } from "../scripts/export_web_preview.mjs";

const longSummary =
  "这是一段较长的详细解读，用来验证网页表格默认不把长文本全部铺开，而是通过摘要和查看详情按钮改善阅读体验。".repeat(8);

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
        title: "示例政策文件",
        documentNumber: "苏发改价格〔2026〕1号",
        issuer: "江苏省发展和改革委员会",
        publishedAt: "2026-01-01",
        officialUrl: "https://example.gov.cn/policy",
        localFilePath: "source-files/2026-01-01-示例政策文件(苏发改价格〔2026〕1号).pdf",
        markdownFilePath: "knowledge-markdown/doc-1/政策正文.md",
        markdownExtraction: {
          method: "pdf-text",
          ocrStatus: "not-needed",
          extractedAt: "2026-07-15",
        },
        localAttachments: [
          {
            title: "附件：交易执行规则",
            officialUrl: "https://example.gov.cn/files/rule.docx",
            localFilePath: "source-files/attachments/2026-01-01-示例政策文件(苏发改价格〔2026〕1号)/rule.docx",
          },
        ],
        attachmentMarkdownFiles: [
          {
            title: "附件：交易执行规则",
            sourceFilePath: "source-files/attachments/2026-01-01-示例政策文件(苏发改价格〔2026〕1号)/rule.docx",
            markdownFilePath: "knowledge-markdown/doc-1/附件-交易执行规则.md",
            extraction: {
              method: "office",
              ocrStatus: "not-needed",
              extractedAt: "2026-07-15",
            },
          },
        ],
        scope: "江苏",
        status: "有效",
        firstRecordedAt: "2026-07-14",
        lastVerifiedAt: "2026-07-14",
        knowledgeSummary: "江苏示例政策用于验证省份页以政策文件维度展示；摘要重点控制在 200 字以内，完整内容仍可通过深度解读查看。",
        detailedSummary: longSummary,
      },
      {
        id: "doc-3",
        title: "更新的江苏政策",
        documentNumber: "苏发改价格〔2026〕2号",
        issuer: "江苏省发展和改革委员会",
        publishedAt: "2026-03-01",
        officialUrl: "https://example.gov.cn/policy-new",
        localFilePath: "source-files/2026-03-01-更新的江苏政策(苏发改价格〔2026〕2号).pdf",
        localAttachments: [],
        scope: "江苏",
        status: "有效",
        firstRecordedAt: "2026-07-14",
        lastVerifiedAt: "2026-07-14",
        knowledgeSummary: "用于验证政策页按发布日期倒序展示，发布日期更新的政策应排在前面。",
        detailedSummary: "用于验证排序。",
      },
      {
        id: "doc-2",
        title: "示例国家政策",
        documentNumber: "国发〔2026〕1号",
        issuer: "国务院",
        publishedAt: "2026-02-01",
        officialUrl: "https://example.gov.cn/national",
        localFilePath: "source-files/2026-02-01-示例国家政策(国发〔2026〕1号).pdf",
        localAttachments: [],
        scope: "国家",
        status: "有效",
        firstRecordedAt: "2026-07-14",
        lastVerifiedAt: "2026-07-14",
        knowledgeSummary: "国家示例政策用于验证知识摘要、详情弹窗和来源归档链接，摘要用于表格快速扫读。",
        detailedSummary: "### 政策定位\n- **核心**：用于验证结构化详情渲染。\n\n### 主要要求\n- 详情弹窗只展示详细解读。",
      },
    ],
    concepts: [
      {
        id: "concept-1",
        name: "机制电价",
        plainExplanation: "用于差价结算的基准价格。",
        knowledgeSummary: "机制电价是新能源价格结算机制中的基准参数，用于纳入机制电量与市场均价之间的差价结算。",
        detailedSummary: longSummary,
        relatedMechanisms: ["机制电量", "差价结算"],
        scope: "国家",
        sourceDocumentIds: ["doc-1"],
        lastVerifiedAt: "2026-07-14",
      },
    ],
    provincialRules: [
      {
        id: "rule-1",
        province: "江苏",
        tradingProduct: "中长期交易",
        knowledgeSummary: "江苏中长期交易规则摘要，用于验证省份规则也具备 200 字以内知识摘要。",
        detailedSummary: longSummary,
        eligibleParticipants: "发电企业、售电公司、电力用户。",
        managementRequirements: "按交易规则完成申报、成交、结算和信息披露。",
        admissionCriteria: "完成市场注册并满足信用履约要求。",
        participationProcess: "注册后按交易公告申报，成交后履约结算。",
        assessmentMethod: "按偏差、履约和违规行为进行考核。",
        sourceDocumentIds: ["doc-1"],
        status: "有效",
        lastVerifiedAt: "2026-07-14",
      },
    ],
    updateEvents: [
      {
        id: "event-1",
        occurredAt: "2026-07-14",
        type: "新增",
        subjectId: "doc-1",
        note: "新增示例政策。",
      },
    ],
  };
}

test("exports an optimized local HTML web preview", async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "electricity-preview-"));
  const inputPath = path.join(tmpDir, "knowledge.json");
  const outputPath = path.join(tmpDir, "preview.html");
  await fs.writeFile(inputPath, JSON.stringify(sampleStore()), "utf8");

  await exportWebPreview(inputPath, outputPath);

  const html = await fs.readFile(outputPath, "utf8");
  const heroAsset = await fs.stat(path.join(tmpDir, "assets", "electricity-market-hero.png"));
  const logoAsset = await fs.stat(path.join(tmpDir, "assets", "electricity-market-logo.png"));
  assert.ok(heroAsset.size > 1000, "网页预览应复制电力元素 hero 背景图资产");
  assert.ok(logoAsset.size > 1000, "网页预览应复制电力市场知识库标题 icon 资产");
  for (const expectedText of [
    "电力市场知识库",
    "assets/electricity-market-hero.png",
    "assets/electricity-market-logo.png",
    "header-brand",
    "header-logo",
    "hero-card",
    "app-header",
    "header-title-block",
    "header-meta",
    "meta-chip",
    "height: 70px",
    "position: fixed",
    "fixed-workbench",
    "compact-toolbar",
    "toolbar-row",
    "table-scroll-region",
    "exportExcelLink",
    "导出 Excel",
    "backdrop-filter",
    "knowledge-shell",
    "基础概念",
    "国家政策",
    "江苏",
    "文件标题",
    "知识摘要",
    "发布单位",
    "发布日期",
    "查看文件",
    "深度解读",
    "知识浏览",
    "knowledgeBrowserModal",
    "openKnowledgeBrowser",
    "renderKnowledgeMarkdown",
    "knowledge-markdown/doc-1/政策正文.md",
    "knowledge-markdown/doc-1/附件-交易执行规则.md",
    "detailModal",
    "renderStructuredDetail",
    "summary-tooltip",
    "summaryPopover",
    "summary-popover",
    "showSummaryPopover",
    "hideSummaryPopover",
    "renderSummaryMarkdown",
    "summaryPopover.innerHTML = renderSummaryMarkdown",
    ".summary-popover strong",
    ".summary-popover mark",
    "data-summary",
    "onclick=\"showSummaryPopover",
    "onmouseenter=\"showSummaryPopover",
    "detail-body",
    "detail-section",
    "clamped-text",
    "searchInput",
    "https://example.gov.cn/policy",
    "source-files/2026-01-01-示例政策文件(苏发改价格〔2026〕1号).pdf",
    "target=\"_blank\"",
    "附件归档",
    "附件：交易执行规则",
    "source-files/attachments/2026-01-01-示例政策文件(苏发改价格〔2026〕1号)/rule.docx",
  ]) {
    assert.ok(html.includes(expectedText), `网页应包含：${expectedText}`);
  }
  assert.ok(!html.includes("Electricity Market Knowledge Base"), "头部不应展示英文标题");
  assert.ok(!html.includes("class=\"eyebrow\""), "头部不应继续使用英文 eyebrow 排版");
  assert.ok(!html.includes("当前页："), "页面不应保留当前页描述区域");
  assert.ok(!html.includes(">详细解读</th>"), "网页表格不应继续显示详细解读列名");
  assert.ok(!html.includes("background: linear-gradient(135deg, #0f4c5c, #167182)"), "头部不应继续使用旧的纯色渐变背景");
  assert.ok(!html.includes("modalDetails.innerHTML = sheet.columns.map"), "详情弹窗不应重复展示所有字段");
  assert.ok(!html.includes("grid-template-columns: 140px 1fr"), "详情弹窗不应继续使用字段-值详情表格");
  assert.ok(!html.includes(">查看详情</button>"), "详情按钮应改名为深度解读");
  const dataMatch = html.match(/const appData = ([\s\S]*?);\n    let activeSheetIndex/);
  assert.ok(dataMatch, "网页应内嵌 appData");
  const appData = JSON.parse(dataMatch[1]);
  const jiangsuSheet = appData.sheets.find((sheet) => sheet.name === "江苏");
  assert.deepEqual(
    jiangsuSheet.rows.map((row) => row.title),
    ["更新的江苏政策", "示例政策文件"],
    "同一省份政策应按发布日期倒序展示",
  );
});
