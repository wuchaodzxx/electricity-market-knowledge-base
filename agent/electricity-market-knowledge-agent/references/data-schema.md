# 知识库数据结构

`knowledge-base/electricity-market.json` 是唯一的可编辑数据源。更新前必须先读取本文件，更新后必须运行 `scripts/validate_knowledge_base.mjs`。

## 顶层字段

- `metadata`：`schemaVersion`、`supportedProvinces`、`lastUpdatedAt`。
- `concepts`：基础概念列表。
- `policyDocuments`：官方政策文件列表。
- `provincialRules`：按省份和交易品种整理的规则列表。
- `updateEvents`：新增、更新、替代、废止、待核验记录。

## 基础概念

每条概念含 `id`、`name`、`plainExplanation`、`knowledgeSummary`、`detailedSummary`、`relatedMechanisms`、`scope`、`sourceDocumentIds`、`lastVerifiedAt`。`plainExplanation` 用小白能懂的话概括，`knowledgeSummary` 是网页和 Excel 表格用于快速扫读的 200 字以内摘要，`detailedSummary` 必须给出机制逻辑、适用场景、关键要求和容易误解处。`sourceDocumentIds` 必须引用已有政策文件；无可核验来源时不新增概念，或将相关内容作为待核验更新记录。

## 政策文件

每条文件含 `id`、`title`、`documentNumber`、`issuer`、`publishedAt`、`officialUrl`、`localFilePath`、`scope`、`status`、`firstRecordedAt`、`lastVerifiedAt`、`knowledgeSummary`、`detailedSummary`，可选 `localAttachments`、`markdownFilePath`、`markdownExtraction`、`attachmentMarkdownFiles`、`replacesDocumentId` 与 `notes`。`knowledgeSummary` 是 200 字以内摘要，用于表格快速理解该文件讲什么、影响什么；`localFilePath` 指向已下载到本地并可由网页打开的 PDF 来源文件副本，例如 `source-files/2026-01-30-关于完善发电侧容量电价机制的通知(发改价格〔2026〕114号).pdf`。`localAttachments` 用于记录官方网页附件的本地归档，每个附件含 `title`、`officialUrl`、`localFilePath`。`detailedSummary` 必须同时基于政策网页正文和已发现附件内容，说明文件具体讲了什么、提出了哪些要求、影响哪些主体和交易品种，不得只写一句话。

`markdownFilePath` 指向由 `scripts/extract_policy_markdown.mjs` 从政策正文归档文件提取出的 Markdown，例如 `knowledge-markdown/doc-ndrc-2026-114/政策正文.md`。`markdownExtraction` 记录提取方式和 OCR 状态，至少含 `method`、`ocrStatus`、`extractedAt`；`ocrStatus` 只能为 `not-needed`、`success`、`partial`、`failed`、`not-run`。`attachmentMarkdownFiles` 记录附件的 Markdown 提取结果，每项含 `title`、`sourceFilePath`、`markdownFilePath`、`extraction`。Markdown 路径必须是站点内安全相对路径，不能包含 `..`，且必须以 `.md` 结尾。

`documentNumber` 必须填写正式文号；官方文件或页面明确未提供正式文号时，填写唯一允许的标识：`未见正式文号`。不得猜测、补写或编造文号。

`scope` 只能为 `国家` 或首期八省之一。`officialUrl` 必须是官方页面或官方附件的 HTTPS 链接。

## 省份规则

每条规则含 `id`、`province`、`tradingProduct`、`knowledgeSummary`、`detailedSummary`、`eligibleParticipants`、`managementRequirements`、`admissionCriteria`、`participationProcess`、`assessmentMethod`、`sourceDocumentIds`、`status`、`lastVerifiedAt`，可选 `notes`。`knowledgeSummary` 是 200 字以内摘要；`detailedSummary` 必须足以让初学者理解该交易品种或规则体系的核心内容。

## 更新记录

每条记录含 `id`、`occurredAt`、`type`、`subjectId`、`note`。`type` 仅使用：`新增`、`更新`、`替代`、`废止`、`待核验`、`核验无变化`。所有知识增加、更新都必须写入更新记录。

## 状态

- `有效`：当前可确认适用。
- `已废止`：文件或规则已明确废止。
- `被替代`：已有后续文件明确替代。
- `待核验`：来源、效力、内容或冲突尚不能可靠确认；不得作为确定性结论输出。
