# Electricity Market Knowledge Agent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (\`- [ ]\`) syntax for tracking.

**Goal:** Build an installable Codex skill that maintains a source-traceable Chinese electricity-market knowledge base and exports it to a multi-sheet Excel workbook.

**Architecture:** Use a version-controlled JSON file as the durable store: concepts, policy documents, provincial rules, and update events. The Codex skill governs research and updates; two Node scripts validate data and create the workbook with @oai/artifact-tool.

**Tech Stack:** Codex skill, Node.js built-in node:test, @oai/artifact-tool 2.8.6+, JSON.

---

## File structure

~~~text
agent/electricity-market-knowledge-agent/
├── SKILL.md
├── agents/openai.yaml
├── references/data-schema.md
├── scripts/validate_knowledge_base.mjs
├── scripts/export_knowledge_base.mjs
└── tests/
    ├── fixtures/minimal-knowledge.json
    ├── validate_knowledge_base.test.mjs
    ├── export_knowledge_base.test.mjs
    └── skill_content.test.mjs
knowledge-base/electricity-market.json
outputs/
~~~

Install the tested workspace package into ~/.codex/skills/electricity-market-knowledge-agent. The workspace copy stays the editable source.

### Task 1: Specify and validate the knowledge store

**Files:**
- Create: agent/electricity-market-knowledge-agent/references/data-schema.md
- Create: agent/electricity-market-knowledge-agent/scripts/validate_knowledge_base.mjs
- Create: agent/electricity-market-knowledge-agent/tests/fixtures/minimal-knowledge.json
- Create: agent/electricity-market-knowledge-agent/tests/validate_knowledge_base.test.mjs
- Create: knowledge-base/electricity-market.json

- [ ] **Step 1: Write the failing validator test**

~~~js
import test from "node:test";
import assert from "node:assert/strict";
import { validateKnowledgeBase } from "../scripts/validate_knowledge_base.mjs";

const store = {
  metadata: { schemaVersion: 1, supportedProvinces: ["江苏"], lastUpdatedAt: "2026-07-14" },
  concepts: [],
  policyDocuments: [{ id: "doc-1", title: "示例文件", documentNumber: "苏发改价格〔2026〕1号", issuer: "江苏省发展和改革委员会", publishedAt: "2026-01-01", officialUrl: "https://example.gov.cn/a", scope: "江苏", status: "有效", firstRecordedAt: "2026-07-14", lastVerifiedAt: "2026-07-14" }],
  provincialRules: [],
  updateEvents: [],
};

test("accepts a policy document with traceable fields", () => {
  assert.deepEqual(validateKnowledgeBase(store), []);
});
test("rejects blank documentNumber", () => {
  const bad = structuredClone(store);
  bad.policyDocuments[0].documentNumber = "";
  assert.match(validateKnowledgeBase(bad).join("\n"), /documentNumber/);
});
test("rejects a rule with a missing source document", () => {
  const bad = structuredClone(store);
  bad.provincialRules.push({ id: "rule-1", province: "江苏", tradingProduct: "绿电交易", eligibleParticipants: "用户", managementRequirements: "按规则执行", admissionCriteria: "完成注册", participationProcess: "注册后申报", assessmentMethod: "按规则考核", sourceDocumentIds: ["missing-doc"], status: "有效", lastVerifiedAt: "2026-07-14" });
  assert.match(validateKnowledgeBase(bad).join("\n"), /missing-doc/);
});
~~~

- [ ] **Step 2: Verify RED**

Run: node --test agent/electricity-market-knowledge-agent/tests/validate_knowledge_base.test.mjs

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement the validator and schema**

~~~js
const PROVINCES = new Set(["江苏", "浙江", "山西", "湖北", "四川", "山东", "甘肃", "安徽"]);
const STATUSES = new Set(["有效", "已废止", "被替代", "待核验"]);

export function validateKnowledgeBase(store) {
  const errors = [];
  for (const key of ["metadata", "concepts", "policyDocuments", "provincialRules", "updateEvents"]) {
    if (!(key in store)) errors.push("缺少顶层字段：" + key);
  }
  if (errors.length) return errors;
  const ids = new Set();
  for (const document of store.policyDocuments) {
    if (!document.id || ids.has(document.id)) errors.push("政策文件 ID 无效或重复：" + (document.id || "<空>"));
    ids.add(document.id);
    if (!document.documentNumber) errors.push("政策文件 " + document.id + " 缺少 documentNumber");
    if (!document.officialUrl?.startsWith("https://")) errors.push("政策文件 " + document.id + " 缺少官方 https 链接");
    if (!STATUSES.has(document.status)) errors.push("政策文件 " + document.id + " 的状态无效");
  }
  for (const rule of store.provincialRules) {
    if (!PROVINCES.has(rule.province)) errors.push("省份规则 " + rule.id + " 的省份不在首期范围内");
    if (!STATUSES.has(rule.status)) errors.push("省份规则 " + rule.id + " 的状态无效");
    for (const id of rule.sourceDocumentIds ?? []) if (!ids.has(id)) errors.push("省份规则 " + rule.id + " 引用了不存在的文件：" + id);
  }
  return errors;
}
~~~

Document every field in data-schema.md. The only permitted no-number marker is 未见正式文号. The initial store must list all eight provinces and contain no invented policy entries.

- [ ] **Step 4: Verify GREEN and commit**

Run: node --test agent/electricity-market-knowledge-agent/tests/validate_knowledge_base.test.mjs

Expected: PASS, 3 tests.

~~~bash
git add agent/electricity-market-knowledge-agent/references agent/electricity-market-knowledge-agent/scripts/validate_knowledge_base.mjs agent/electricity-market-knowledge-agent/tests/validate_knowledge_base.test.mjs agent/electricity-market-knowledge-agent/tests/fixtures/minimal-knowledge.json knowledge-base/electricity-market.json
git commit -m "feat: add electricity market knowledge schema"
~~~

### Task 2: Build and test the multi-sheet exporter

**Files:**
- Create: agent/electricity-market-knowledge-agent/scripts/export_knowledge_base.mjs
- Create: agent/electricity-market-knowledge-agent/tests/export_knowledge_base.test.mjs
- Modify: agent/electricity-market-knowledge-agent/tests/fixtures/minimal-knowledge.json

- [ ] **Step 1: Write the failing export test**

~~~js
import test from "node:test";
import assert from "node:assert/strict";
import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";
import { exportKnowledgeBase } from "../scripts/export_knowledge_base.mjs";

test("exports required sheets", async () => {
  const output = "outputs/test-electricity-market.xlsx";
  await exportKnowledgeBase("agent/electricity-market-knowledge-agent/tests/fixtures/minimal-knowledge.json", output);
  const workbook = await SpreadsheetFile.importXlsx(await FileBlob.load(output));
  const result = await workbook.inspect({ kind: "sheet", include: "name" });
  for (const name of ["基础概念", "国家政策", "江苏", "浙江", "山西", "湖北", "四川", "山东", "甘肃", "安徽", "更新记录"]) {
    assert.match(result.ndjson, new RegExp(name));
  }
});
~~~

- [ ] **Step 2: Verify RED**

Run: node --test agent/electricity-market-knowledge-agent/tests/export_knowledge_base.test.mjs

Expected: FAIL because exporter module does not exist.

- [ ] **Step 3: Implement the exporter**

Use this stable public API shape:

~~~js
import fs from "node:fs/promises";
import path from "node:path";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";
import { validateKnowledgeBase } from "./validate_knowledge_base.mjs";

const provinces = ["江苏", "浙江", "山西", "湖北", "四川", "山东", "甘肃", "安徽"];

function writeSheet(workbook, name, headers, rows) {
  const sheet = workbook.worksheets.add(name);
  sheet.showGridLines = false;
  sheet.getRangeByIndexes(0, 0, 1, headers.length).values = [headers];
  if (rows.length) sheet.getRangeByIndexes(1, 0, rows.length, headers.length).values = rows;
  const used = sheet.getUsedRange();
  used.format.wrapText = true;
  sheet.getRangeByIndexes(0, 0, 1, headers.length).format = { fill: "#0F4C5C", font: { bold: true, color: "#FFFFFF" }, horizontalAlignment: "center" };
  used.format.autofitColumns();
  sheet.freezePanes.freezeRows(1);
}
~~~

The complete module must validate before export, write these exact sheets in order: 基础概念, 国家政策, 江苏, 浙江, 山西, 湖北, 四川, 山东, 甘肃, 安徽, 更新记录, then export with SpreadsheetFile.exportXlsx. Province columns must be: 交易品种, 适用对象, 管理要求, 准入条件, 参与流程, 考核方式, 来源文件, 发文编号, 链接, 状态, 最后核验日期. Link source document IDs to title, documentNumber and officialUrl from policyDocuments. Implement --input and --output command-line options.

After writing values, inspect header ranges, scan for formula errors, render 基础概念 and 江苏, and cap overly wide URL columns so headers and wrapped content remain readable.

- [ ] **Step 4: Verify GREEN and commit**

Run: node --test agent/electricity-market-knowledge-agent/tests/export_knowledge_base.test.mjs

Expected: PASS, and outputs/test-electricity-market.xlsx contains 11 named sheets.

~~~bash
git add agent/electricity-market-knowledge-agent/scripts/export_knowledge_base.mjs agent/electricity-market-knowledge-agent/tests/export_knowledge_base.test.mjs agent/electricity-market-knowledge-agent/tests/fixtures/minimal-knowledge.json
git commit -m "feat: export electricity market knowledge to xlsx"
~~~

### Task 3: Create and verify the Codex skill

**Files:**
- Create: agent/electricity-market-knowledge-agent/SKILL.md
- Create: agent/electricity-market-knowledge-agent/agents/openai.yaml
- Create: agent/electricity-market-knowledge-agent/tests/skill_content.test.mjs

- [ ] **Step 1: Write the failing skill-contract test**

~~~js
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

test("skill requires official-source and manual-update safety rules", async () => {
  const skill = await fs.readFile("agent/electricity-market-knowledge-agent/SKILL.md", "utf8");
  for (const text of ["官方渠道", "未见正式文号", "仅在用户下达更新指令后", "export_knowledge_base.mjs", "待核验"]) {
    assert.match(skill, new RegExp(text));
  }
});
~~~

- [ ] **Step 2: Verify RED**

Run: node --test agent/electricity-market-knowledge-agent/tests/skill_content.test.mjs

Expected: FAIL because SKILL.md does not exist.

- [ ] **Step 3: Implement the skill package**

SKILL.md frontmatter:

~~~yaml
---
name: electricity-market-knowledge-agent
description: Use when explaining electricity-market concepts, researching or updating official Chinese power-market policies for 江苏、浙江、山西、湖北、四川、山东、甘肃、安徽, querying provincial trading rules, or exporting the maintained knowledge base to Excel.
---
~~~

The skill body must require:
1. Read references/data-schema.md before editing records.
2. Use only official primary sources for formal entries; use industry commentary only as a discovery lead.
3. Update only when the user explicitly directs it; search the requested scope, deduplicate by official URL/document number/title, relate replacements/abolitions, validate JSON, then report 新增、更新、替代/废止、待核验、无变化.
4. Record a real document number or 未见正式文号, never a guess.
5. Mark ambiguity, unreachable primary source, conflict, or unsupported assertion as 待核验.
6. Answer beginners with plain explanation first, then applicability and traceable sources.
7. Run the validator before calling scripts/export_knowledge_base.mjs and date exports in outputs/.

Create agents/openai.yaml:

~~~yaml
interface:
  display_name: "电力市场知识库"
  short_description: "查询、维护并导出可追溯的电力市场知识"
  default_prompt: "使用 $electricity-market-knowledge-agent 维护或查询电力市场知识库。"
policy:
  allow_implicit_invocation: true
~~~

- [ ] **Step 4: Verify GREEN, validate package, and commit**

Run: node --test agent/electricity-market-knowledge-agent/tests/*.test.mjs

Expected: PASS for schema, exporter and skill-contract tests.

Run: python3 /Users/wuchao/.codex/skills/.system/skill-creator/scripts/quick_validate.py agent/electricity-market-knowledge-agent

Expected: no template/TODO or structural validation errors.

~~~bash
git add agent/electricity-market-knowledge-agent/SKILL.md agent/electricity-market-knowledge-agent/agents/openai.yaml agent/electricity-market-knowledge-agent/tests/skill_content.test.mjs
git commit -m "feat: add electricity market knowledge agent skill"
~~~

### Task 4: Package and install the verified agent

**Files:**
- Create: .gitignore
- Create: outputs/电力市场知识库-2026-07-14.xlsx (generated; ignored)
- Install: ~/.codex/skills/electricity-market-knowledge-agent/

- [ ] **Step 1: Add output exclusions**

~~~gitignore
outputs/*.xlsx
outputs/*.png
node_modules/
~~~

- [ ] **Step 2: Generate and verify the empty-but-formatted starter workbook**

Run: node agent/electricity-market-knowledge-agent/scripts/export_knowledge_base.mjs --input knowledge-base/electricity-market.json --output outputs/电力市场知识库-2026-07-14.xlsx

Expected: a readable 11-sheet workbook containing all headers even before the first policy update.

Import it using SpreadsheetFile.importXlsx. Inspect 基础概念!A1:H1 and 江苏!A1:K1, render both sheets, and visually correct any clipped headers before proceeding.

- [ ] **Step 3: Install only after all tests pass**

Run: node --test agent/electricity-market-knowledge-agent/tests/*.test.mjs

Expected: all tests PASS.

Run: mkdir -p ~/.codex/skills && cp -R agent/electricity-market-knowledge-agent ~/.codex/skills/electricity-market-knowledge-agent

Expected: installed copy contains SKILL.md, agents/openai.yaml, references, and both scripts.

- [ ] **Step 4: Commit workspace deliverables**

~~~bash
git add .gitignore agent/electricity-market-knowledge-agent knowledge-base
git commit -m "chore: package electricity market knowledge agent"
~~~

## Plan self-review

- Spec coverage: Task 1 creates the auditable model and safety validation. Task 2 creates the required 11-sheet workbook. Task 3 implements official-source, manual-update, beginner query and traceability behaviors. Task 4 verifies the deliverable and makes it available in Codex.
- No placeholders: all field names, locations, source-status values, sheet names, commands and tests are explicit. The final export date is supplied at runtime.
- Type consistency: policyDocuments[].id is the foreign-key target for concepts[].sourceDocumentIds and provincialRules[].sourceDocumentIds; validator and exporter use those exact names.
