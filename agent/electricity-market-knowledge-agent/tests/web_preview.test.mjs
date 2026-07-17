import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { exportWebPreview } from "../scripts/export_web_preview.mjs";

const longSummary =
  "这是一段较长的详细解读，用来验证网页表格默认不把长文本全部铺开，而是通过摘要和查看详情按钮改善阅读体验。".repeat(8);

const MAINLAND_PROVINCE_TABS = [
  "北京",
  "天津",
  "河北",
  "山西",
  "内蒙古",
  "山东",
  "辽宁",
  "吉林",
  "黑龙江",
  "上海",
  "江苏",
  "浙江",
  "安徽",
  "福建",
  "河南",
  "湖北",
  "湖南",
  "江西",
  "重庆",
  "四川",
  "西藏",
  "陕西",
  "甘肃",
  "青海",
  "宁夏",
  "新疆",
  "广东",
  "广西",
  "海南",
  "贵州",
  "云南",
];

function sampleStore() {
  return {
    metadata: {
      schemaVersion: 1,
      supportedProvinces: MAINLAND_PROVINCE_TABS,
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
  const faviconSvgAsset = await fs.stat(path.join(tmpDir, "assets", "favicon.svg"));
  const faviconPngAsset = await fs.stat(path.join(tmpDir, "assets", "favicon-32.png"));
  const appleTouchIconAsset = await fs.stat(path.join(tmpDir, "assets", "apple-touch-icon.png"));
  assert.ok(heroAsset.size > 1000, "网页预览应复制电力元素 hero 背景图资产");
  assert.ok(logoAsset.size > 1000, "网页预览应复制电力市场知识库标题 icon 资产");
  assert.ok(faviconSvgAsset.size > 500, "网页预览应复制浏览器页签 SVG favicon");
  assert.ok(faviconPngAsset.size > 100, "网页预览应复制 32px PNG favicon");
  assert.ok(appleTouchIconAsset.size > 100, "网页预览应复制 Apple touch icon");
  for (const expectedText of [
    "<title>电力市场知识库</title>",
    "电力市场知识库",
    "assets/electricity-market-hero.png",
    "assets/electricity-market-logo.png",
    "assets/favicon.svg",
    "assets/favicon-32.png",
    "assets/apple-touch-icon.png",
    "rel=\"icon\" type=\"image/svg+xml\"",
    "rel=\"icon\" type=\"image/png\" sizes=\"32x32\"",
    "rel=\"apple-touch-icon\"",
    "header-brand",
    "header-logo",
    "hero-card",
    "app-header",
    "header-title-block",
    "work-chain-button",
    "工作链",
    "workChainModal",
    "openWorkChain",
    "closeWorkChain",
    "智能体工作链",
    "mermaid.esm.min.mjs",
    "initMermaidWorkChain",
    "renderMermaidFallback",
    "workChainMermaid",
    "workChainSource",
    "mermaid-source",
    "工作链 Mermaid 源码",
    "graph TD",
    "A[用户下达指令]",
    "B{是否为更新/发布指令?}",
    "D[明确范围: 国家/省份/交易品种/链接/本地文件]",
    "E[官方来源检索与去重]",
    "F{是否找到官方依据?}",
    "I[归档政策正文为本地 PDF]",
    "J{是否存在附件?}",
    "L[提取正文与附件 Markdown]",
    "M{PDF 是否疑似扫描件?}",
    "N[调用 OCRmyPDF + Tesseract]",
    "Q[撰写 200 字以内知识摘要]",
    "R[撰写结构化深度解读]",
    "T{校验是否通过?}",
    "W[生成网页: 搜索/页签/深度解读/知识浏览/来源归档]",
    "X[提交并推送 GitHub Pages]",
    "Y{发布是否成功?}",
    "AB[等待下一次手动增量更新]",
    "height: 70px",
    "position: fixed",
    "fixed-workbench",
    "compact-toolbar",
    "toolbar-row",
    "tab-shell",
    "primary-tabs",
    ".primary-tabs {\n      flex: 0 1 auto",
    "selected-province-tabs",
    "selectedProvinceTab",
    "province-toggle",
    "provinceToggle",
    "update-tab",
    "updateTab",
    "margin-left: auto",
    "toggleProvincePanel",
    "provinceTabsExpanded",
    "province-panel",
    "province-tab-grid",
    "展开省份",
    "收起省份",
    "aria-expanded",
    "data-tab-role=\"province\"",
    "table-scroll-region",
    "backdrop-filter",
    "knowledge-shell",
    "基础概念",
    "全部",
    "国家政策",
    "北京",
    "江苏",
    "新疆",
    "广东",
    "云南",
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
  assert.ok(!html.includes("<title>电力市场知识库网页预览</title>"), "浏览器页签名称不应继续包含网页预览");
  assert.ok(!html.includes("网页更新时间"), "头部不应展示网页更新时间");
  assert.ok(!html.includes(">网页生成 <strong>"), "头部不应展示网页生成时间");
  assert.ok(!html.includes("数据更新"), "头部不应展示数据更新时间");
  assert.ok(!html.includes("覆盖 <strong>国家 + 大陆31省级行政区</strong>"), "头部不应展示覆盖范围信息");
  assert.ok(!html.includes("header-meta"), "头部不应继续渲染元信息区域");
  assert.ok(!html.includes("meta-chip"), "头部不应继续渲染元信息标签");
  assert.ok(!html.includes("work-chain-step"), "工作链不应继续使用旧的卡片式流程，应改为 Mermaid 渲染");
  assert.ok(!html.includes("work-chain-index"), "工作链不应继续使用旧的编号卡片流程");
  assert.ok(!html.includes("exportExcelLink"), "网页不应继续提供 Excel 导出入口");
  assert.ok(!html.includes("导出 Excel"), "网页不应继续展示导出 Excel 按钮");
  assert.ok(!html.includes("excelDownloadHref"), "网页数据不应继续内嵌 Excel 下载地址");
  assert.ok(!html.includes("downloads/电力市场知识库-"), "网页不应引用自动生成的 Excel 下载文件");
  assert.ok(!html.includes("class=\"eyebrow\""), "头部不应继续使用英文 eyebrow 排版");
  assert.ok(!html.includes("政策、概念与省级交易规则一站式查询；长文本折叠展示，来源与本地归档可直接打开。"), "头部不应展示旧副标题文案");
  assert.ok(!html.includes("class=\"subhead\""), "头部不应继续渲染副标题元素");
  assert.ok(!html.includes("当前页："), "页面不应保留当前页描述区域");
  assert.ok(!html.includes(">详细解读</th>"), "网页表格不应继续显示详细解读列名");
  assert.ok(!html.includes("background: linear-gradient(135deg, #0f4c5c, #167182)"), "头部不应继续使用旧的纯色渐变背景");
  assert.ok(!html.includes("modalDetails.innerHTML = sheet.columns.map"), "详情弹窗不应重复展示所有字段");
  assert.ok(!html.includes("grid-template-columns: 140px 1fr"), "详情弹窗不应继续使用字段-值详情表格");
  assert.ok(!html.includes(">查看详情</button>"), "详情按钮应改名为深度解读");
  assert.ok(!html.includes("overflow-x: auto"), "省份页签不应继续依赖横向滑动展示");
  assert.ok(!html.includes("tabs.innerHTML = appData.sheets.map"), "页签不应继续把所有页签平铺到同一个横向容器");
  assert.ok(!html.includes(".primary-tabs {\n      flex: 1 1 auto"), "主页签不应占满剩余空间，否则展开省份按钮会被顶到右侧");
  assert.ok(
    html.indexOf('id="provinceToggle"') < html.indexOf('id="updateTab"'),
    "展开省份按钮应位于更新记录左侧，更新记录应靠右展示",
  );
  assert.ok(
    html.indexOf('id="primaryTabs"') < html.indexOf('id="provinceToggle"') &&
      html.indexOf('id="provinceToggle"') < html.indexOf('id="selectedProvinceTab"') &&
      html.indexOf('id="selectedProvinceTab"') < html.indexOf('id="updateTab"'),
    "展开省份按钮应紧跟国家政策所在的主页签区，当前选中省份应位于展开省份和更新记录之间",
  );
  assert.ok(!html.includes("if (isProvinceActive) primaryIndexes.push(activeSheetIndex)"), "当前选中省份不应继续放在国家政策与展开省份之间");
  const dataMatch = html.match(/const appData = ([\s\S]*?);\n    let activeSheetIndex/);
  assert.ok(dataMatch, "网页应内嵌 appData");
  const appData = JSON.parse(dataMatch[1]);
  assert.deepEqual(
    appData.sheets.slice(0, 3).map((sheet) => sheet.name),
    ["基础概念", "全部", "国家政策"],
    "全部页签应位于基础概念之后、国家政策之前",
  );
  assert.deepEqual(
    appData.sheets.slice(3, 34).map((sheet) => sheet.name),
    MAINLAND_PROVINCE_TABS,
    "省级页签应覆盖大陆 31 个省级行政区，并按国网区在前、南网区在后排序",
  );
  assert.deepEqual(
    appData.sheets.slice(-6).map((sheet) => sheet.name),
    ["广东", "广西", "海南", "贵州", "云南", "更新记录"],
    "南网经营区页签应排在省级页签末尾，更新记录仍位于最后",
  );
  assert.equal(appData.sheets.length, 35, "网页应包含基础概念、全部、国家政策、31 个省级页签和更新记录");
  const allSheet = appData.sheets.find((sheet) => sheet.name === "全部");
  assert.ok(allSheet, "网页应提供全国及各省政策混合检索的全部页签");
  assert.ok(allSheet.columns.includes("适用范围"), "全部页签应展示国家/省份适用范围");
  assert.deepEqual(
    allSheet.rows.map((row) => row.title),
    ["更新的江苏政策", "示例国家政策", "示例政策文件"],
    "全部页签应包含国家与各省政策，并按发布日期倒序展示",
  );
  assert.ok(!allSheet.rows.some((row) => row.title === "机制电价"), "全部页签不应混入基础概念");
  const jiangsuSheet = appData.sheets.find((sheet) => sheet.name === "江苏");
  assert.deepEqual(
    jiangsuSheet.rows.map((row) => row.title),
    ["更新的江苏政策", "示例政策文件"],
    "同一省份政策应按发布日期倒序展示",
  );
});
