import test from "node:test";
import assert from "node:assert/strict";
import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";
import { exportKnowledgeBase } from "../scripts/export_knowledge_base.mjs";

test("exports all required knowledge-base sheets", async () => {
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
    range: "江苏!A1:L1",
    include: "values",
  });
  assert.match(provinceHeader.ndjson, /政策\/规则总结/);
});
