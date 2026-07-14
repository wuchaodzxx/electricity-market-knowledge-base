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
