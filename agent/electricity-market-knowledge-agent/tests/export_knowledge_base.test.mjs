import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { exportKnowledgeBase } from "../scripts/export_knowledge_base.mjs";

async function loadArtifactTool() {
  try {
    return await import("@oai/artifact-tool");
  } catch (error) {
    if (error?.code !== "ERR_MODULE_NOT_FOUND") throw error;
    const requireFromWorkspace = createRequire(`${process.cwd()}/package.json`);
    const resolvedPath = requireFromWorkspace.resolve("@oai/artifact-tool");
    return import(pathToFileURL(resolvedPath).href);
  }
}

test("exports all required knowledge-base sheets", async () => {
  const { FileBlob, SpreadsheetFile } = await loadArtifactTool();
  const outputPath = "outputs/test-electricity-market.xlsx";
  await exportKnowledgeBase(
    "agent/electricity-market-knowledge-agent/tests/fixtures/minimal-knowledge.json",
    outputPath,
  );

  const workbook = await SpreadsheetFile.importXlsx(
    await FileBlob.load(outputPath),
  );
  const result = await workbook.inspect({ kind: "sheet", include: "name" });
  for (const sheetName of [
    "基础概念",
    "国家政策",
    "江苏",
    "浙江",
    "山西",
    "湖北",
    "四川",
    "山东",
    "甘肃",
    "安徽",
    "更新记录",
  ]) {
    assert.match(result.ndjson, new RegExp(sheetName));
  }

  const provinceHeader = await workbook.inspect({
    kind: "table",
    range: "江苏!A1:K1",
    include: "values",
  });
  assert.match(provinceHeader.ndjson, /文件标题/);
  assert.match(provinceHeader.ndjson, /知识摘要/);
  assert.match(provinceHeader.ndjson, /详细解读/);
  assert.match(provinceHeader.ndjson, /发布单位/);
  assert.match(provinceHeader.ndjson, /发布日期/);
  assert.match(provinceHeader.ndjson, /查看文件/);
  assert.match(provinceHeader.ndjson, /附件归档/);
  assert.doesNotMatch(provinceHeader.ndjson, /政策\/规则总结|适用对象|管理要求|准入条件|参与流程|考核方式/);
});
