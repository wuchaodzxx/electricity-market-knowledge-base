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
    "export_knowledge_base.mjs",
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
    "查看详情",
    "弹窗",
    "链接可点击",
    "长文本",
  ]) {
    assert.match(skill, new RegExp(requiredText));
  }
});

test("skill preserves Gitee publish requirements", async () => {
  const skill = await fs.readFile(
    "agent/electricity-market-knowledge-agent/SKILL.md",
    "utf8",
  );
  for (const requiredText of [
    "publish_gitee_pages.mjs",
    "Gitee",
    "docs/index.html",
    "公开访问",
    "https://gitee.com/wuchaodzxx/electricity-market-knowledge-base.git",
    "https://wuchaodzxx.gitee.io/electricity-market-knowledge-base/",
    "gitee main",
  ]) {
    assert.match(skill, new RegExp(requiredText.replaceAll("/", "\\/")));
  }
  assert.doesNotMatch(skill, /GitHub Pages|github\.io|publish_github_pages\.mjs/);
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
    "阅读",
    "纳入详细解读",
    "查看文件",
    "新标签页",
    "官方链接失效",
    "2026-01-30-关于完善发电侧容量电价机制的通知(发改价格〔2026〕114号)",
  ]) {
    assert.match(skill, new RegExp(requiredText.replaceAll("/", "\\/").replaceAll("(", "\\(").replaceAll(")", "\\)")));
  }
});
