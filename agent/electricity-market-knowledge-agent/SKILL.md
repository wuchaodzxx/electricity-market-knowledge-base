---
name: electricity-market-knowledge-agent
description: Use when explaining electricity-market concepts such as 机制电价 and 容量电价, researching or updating official Chinese power-market policies for 江苏、浙江、山西、湖北、四川、山东、甘肃、安徽, querying provincial trading rules, exporting the maintained knowledge base to Excel/web preview, or publishing it to GitHub Pages.
---

# 电力市场知识库智能体

## 工作范围与固定要求

覆盖国家层面和江苏、浙江、山西、湖北、四川、山东、甘肃、安徽。面向电力市场小白：先用简明语言解释，再给出适用范围、规则要点、参与要求和可追溯来源。

在当前工作区定位 `knowledge-base/electricity-market.json`；在修改前读取 `references/data-schema.md`，并使用同一技能目录下的 `scripts/validate_knowledge_base.mjs`、`scripts/export_knowledge_base.mjs`、`scripts/export_web_preview.mjs`、`scripts/archive_source_files.mjs` 与 `scripts/publish_github_pages.mjs`。

必须长期保留并执行这些要求：

- 基础概念至少覆盖并持续补充：机制电价、机制电量、差价结算、容量电价、容量电费、可靠容量补偿、电力市场注册、新能源上网电价市场化等；“包括不限于这些”，发现同等重要概念时一并入库。
- 各省政策和各类交易品种要整理适用对象、管理要求、准入条件、参与流程、考核方式，并写入对应省份规则。
- 每个政策文件、基础概念、省份规则都必须有 `detailedSummary`：这是详细总结或详细解读，必须让用户能明白文件或知识具体讲了什么、提出什么要求、影响什么主体；不是一句话。
- 总结篇幅不限，按文件复杂度自动调整：简单通知可较短，综合性政策、市场规则、实施细则、附件较多的文件要充分展开。
- 用户要求“尽可能完整”时，要优先覆盖官方政策文件、政策解读、附件、交易中心规则和监管通知；找不到或无法确认时记录为待核验，不用空白假装完整。

## 来源与结论规则

- 正式入库仅使用官方渠道：国家部委、国家能源局及派出机构、地方政府及发展改革部门、监管机构、交易中心的官网或官方附件。
- 行业解读只能作为检索线索，不能作为入库依据。
- 文件有正式文号时必须逐字记录；官方来源未提供时填写“未见正式文号”。不得猜测、补写或编造文号。
- 每个政策文件必须下载来源文件到本地 `docs/source-files/`，并在知识库中记录 `localFilePath`，防止官方链接失效后不可查看。文件命名格式为“发布日期-标题(发文编号)”，例如 `2026-01-30-关于完善发电侧容量电价机制的通知(发改价格〔2026〕114号)`；没有具体日期时省略前面的日期部分。
- 对来源不可访问、规则冲突、文件效力不明或证据不足的内容，标记为“待核验”，不作为确定性结论。

## 查询与解释

先读取知识库并按概念、省份、交易品种、文号或状态筛选。回答顺序为：

1. 一段适合小白的通俗解释。
2. 详细总结/详细解读，说明机制逻辑、政策要求、适用主体、关键流程、考核或结算影响。
3. 适用对象、管理要求、准入条件、参与流程和考核方式（不存在的字段明确说明未收录）。
4. 来源文件标题、发文编号、官方链接、最后核验日期和状态。

## 手动更新

仅在用户下达更新指令后执行。没有明确指令时只查询和解释，不修改知识库。

1. 明确更新范围：国家、一个省份、指定交易品种或全部首期范围。
2. 搜索相应官方渠道，尽可能完整收集正式文件、官方附件、官方政策解读、交易中心规则和监管通知。
3. 以官方链接、发文编号和标题三项比对去重；有修订、替代或废止依据时更新状态和关联关系，保留历史记录。
4. 提取标题、发布单位、发布日期、正式文号、官方链接、适用范围、交易品种、参与主体、管理要求、准入条件、参与流程、考核方式和详细总结。
5. 先更新政策文件，再更新概念或省份规则；每条概念和规则必须引用已有政策文件 ID。
6. 下载每个政策文件的官方来源到 `docs/source-files/` 并写回 `localFilePath`：

~~~bash
node scripts/archive_source_files.mjs --input <知识库路径>/electricity-market.json --source-dir <工作区>/docs/source-files --public-prefix source-files
~~~

7. 当用户已明确“继续，不需要我再次确认”或同一轮更新范围未变化时，后续批次无需反复确认；遇到扩省、删改既有结论、使用非官方来源等重大变化再停下来说明。
8. 运行校验器。校验失败时修复数据，不能绕过。
9. 输出本次“新增、更新、替代/废止、待核验、无变化”摘要，并包含所有来源链接。

## 导出与网页预览

先验证数据，再创建带当天日期的 Excel：

~~~bash
node scripts/validate_knowledge_base.mjs --input <知识库路径>/electricity-market.json
node scripts/export_knowledge_base.mjs --input <知识库路径>/electricity-market.json --output <工作区>/outputs/电力市场知识库-YYYY-MM-DD.xlsx
~~~

导出必须包含：基础概念、国家政策、江苏、浙江、山西、湖北、四川、山东、甘肃、安徽、更新记录。基础概念页必须包含“详细解读”，国家政策页必须包含“详细解读”，每个省份页必须包含“政策/规则总结”。不得用未经核验的内容填充空白数据。

当用户要求“网页展示”“网页预览”“打开网页看知识库”或类似表达时，生成本地 HTML 网页预览：

~~~bash
node scripts/validate_knowledge_base.mjs --input <知识库路径>/electricity-market.json
node scripts/export_web_preview.mjs --input <知识库路径>/electricity-market.json --output <工作区>/outputs/电力市场知识库-网页预览-YYYY-MM-DD.html
~~~

网页预览必须按 Excel 的页签结构展示：基础概念、国家政策、江苏、浙江、山西、湖北、四川、山东、甘肃、安徽、更新记录。为优化阅读体验，长文本列（如“详细解读”“政策/规则总结”“适用对象”“管理要求”“准入条件”“参与流程”“考核方式”）默认折叠为摘要，不在表格中全部铺开；每行提供“查看详情”按钮，点击后用弹窗展示完整内容；官方来源“链接”必须可点击并支持跳转；“链接”后必须增加“查看文件”字段，点击后在新标签页打开本地归档文件。网页应提供关键词搜索，便于按概念、政策标题、交易品种、文号或主体查找。

## 公开发布到 GitHub Pages

用户已确认网页可公开访问，目标仓库为 `wuchaodzxx/electricity-market-knowledge-base`，公开地址为 `https://wuchaodzxx.github.io/electricity-market-knowledge-base/`。发布采用 GitHub Pages 的 `main` 分支 `/docs` 目录：固定首页是 `docs/index.html`，带日期的网页归档仍保留在 `outputs/`。

当用户要求“发布到 GitHub”“更新并发布”“自动发布网页”或类似表达时：

1. 先完成知识库更新、来源文件归档、校验、Excel 导出和网页预览导出。
2. 运行：

~~~bash
node scripts/publish_github_pages.mjs --input <知识库路径>/electricity-market.json --outputs-dir <工作区>/outputs --site <工作区>/docs/index.html --date YYYY-MM-DD
~~~

3. 确认 `docs/index.html` 已生成，链接可点击、长文本折叠、详情弹窗可用。
4. 若 GitHub Pages 尚未启用，提示用户在仓库 Settings → Pages 中选择 `Deploy from a branch`，分支为 `main`，目录为 `/docs`；启用后每次推送都会自动公开刷新。
5. 提交并推送到 `origin main`。若本机 GitHub 登录失效或没有推送权限，说明阻塞点并给出重新登录或手动推送步骤；不要假装已发布。
