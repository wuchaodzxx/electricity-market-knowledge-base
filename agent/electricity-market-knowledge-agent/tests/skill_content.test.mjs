import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

test("skill enforces official-source and manual-update safety rules", async () => {
  const skill = await fs.readFile(
    "agent/electricity-market-knowledge-agent/SKILL.md",
    "utf8",
  );
  for (const requiredText of [
    "官方渠道",
    "未见正式文号",
    "仅在用户下达更新指令后",
    "extract_policy_markdown.mjs",
    "ingest_policy.mjs",
    "待核验",
  ]) {
    assert.match(skill, new RegExp(requiredText));
  }
});

test("skill preserves the user's detailed-summary and export requirements", async () => {
  const skill = await fs.readFile(
    "agent/electricity-market-knowledge-agent/SKILL.md",
    "utf8",
  );
  for (const requiredText of [
    "机制电价",
    "容量电价",
    "容量电费",
    "详细总结",
    "详细解读",
    "不是一句话",
    "按文件复杂度自动调整",
    "尽可能完整",
    "所有知识增加、更新都必须写入更新记录",
    "政策/规则总结",
    "无需反复确认",
  ]) {
    assert.match(skill, new RegExp(requiredText));
  }
});

test("skill preserves web preview requirements", async () => {
  const skill = await fs.readFile(
    "agent/electricity-market-knowledge-agent/SKILL.md",
    "utf8",
  );
  for (const requiredText of [
    "export_web_preview.mjs",
    "网页预览",
    "电力元素背景图",
    "整体美学设计",
    "头部固定",
    "头部不展示英文标题",
    "中文标题和元信息排版紧凑清晰",
    "紧凑工具栏",
    "知识摘要",
    "200 字以内",
    "纯文本",
    "不得包含 Markdown 标题标记",
    "不得写入 `knowledgeSummary`",
    "Markdown 样式",
    "安全渲染",
    "不再自动生成或保存 Excel",
    "不得调用 `export_knowledge_base.mjs`",
    "搜索框和页签固定",
    "表格区域滚动",
    "基础概念、全部、国家政策",
    "全部页签",
    "全国及各省政策",
    "不包含基础概念",
    "适用范围",
    "省份页按政策文件维度",
    "只展示完整详细解读",
    "深度解读",
    "知识浏览",
    "发布日期倒序",
    "灵活结构化",
    "长文本折叠",
    "弹窗",
    "链接可点击",
    "长文本",
  ]) {
    assert.match(skill, new RegExp(requiredText));
  }
});

test("skill preserves GitHub Pages publish requirements", async () => {
  const skill = await fs.readFile(
    "agent/electricity-market-knowledge-agent/SKILL.md",
    "utf8",
  );
  for (const requiredText of [
    "publish_github_pages.mjs",
    "GitHub Pages",
    "docs/index.html",
    "公开访问",
    "不再生成 Excel 下载文件",
    "wuchaodzxx/electricity-market-knowledge-base",
    "https://wuchaodzxx.github.io/electricity-market-knowledge-base/",
  ]) {
    assert.match(skill, new RegExp(requiredText.replaceAll("/", "\\/")));
  }
  assert.doesNotMatch(skill, /publish_gitee_pages\.mjs|gitee\.io|gitee main/);
  assert.doesNotMatch(skill, /导出 Excel|exportExcelLink|docs\/downloads\/电力市场知识库-YYYY-MM-DD\.xlsx/);
});

test("skill preserves source-file archive requirements", async () => {
  const skill = await fs.readFile(
    "agent/electricity-market-knowledge-agent/SKILL.md",
    "utf8",
  );
  for (const requiredText of [
    "archive_source_files.mjs",
    "docs/source-files",
    "localFilePath",
    "PDF",
    "附件",
    "localAttachments",
    "Markdown",
    "OCR",
    "ocrmypdf",
    "tesseract",
    "chi_sim\\+eng",
    "阅读",
    "纳入详细解读",
    "查看文件",
    "新标签页",
    "官方链接失效",
    "增量",
    "--force",
    "sourceHash",
    "2026-01-30-关于完善发电侧容量电价机制的通知(发改价格〔2026〕114号)",
  ]) {
    assert.match(skill, new RegExp(requiredText.replaceAll("/", "\\/").replaceAll("(", "\\(").replaceAll(")", "\\)")));
  }
});

test("skill documents the efficient incremental maintenance workflow", async () => {
  const skill = await fs.readFile(
    "agent/electricity-market-knowledge-agent/SKILL.md",
    "utf8",
  );
  for (const requiredText of [
    "录入加速",
    "政策草稿",
    "默认跳过已归档且本地文件存在的政策正文和附件",
    "默认跳过未变化文件",
    "sourceHash",
    "--force",
    "--force-extract",
    "常规发布沿用增量 Markdown 提取",
    "不直接写入正式知识库",
  ]) {
    assert.match(skill, new RegExp(requiredText));
  }
});
