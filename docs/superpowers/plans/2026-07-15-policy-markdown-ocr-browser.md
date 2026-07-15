# Policy Markdown OCR Browser Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a local Markdown extraction pipeline for archived policy files and attachments, then expose the extracted content in the static web knowledge base.

**Architecture:** Keep the existing JSON + static GitHub Pages architecture. A new extraction script reads `knowledge-base/electricity-market.json`, converts archived source files under `docs/source-files/` into Markdown under `docs/knowledge-markdown/`, writes Markdown path/status metadata back to each policy document, and the existing web exporter renders a “知识浏览” button from that metadata.

**Tech Stack:** Node.js ESM scripts, Poppler CLI (`pdftotext`, `pdftoppm`), OCRmyPDF + Tesseract (`chi_sim+eng`) when installed, LibreOffice for office/WPS conversion, Python `openpyxl` for spreadsheets, Node test runner.

---

### Task 1: Data schema and validator

**Files:**
- Modify: `agent/electricity-market-knowledge-agent/references/data-schema.md`
- Modify: `agent/electricity-market-knowledge-agent/scripts/validate_knowledge_base.mjs`
- Modify: `agent/electricity-market-knowledge-agent/tests/validate_knowledge_base.test.mjs`

- [ ] Add optional `markdownFilePath`, `markdownExtraction`, and `attachmentMarkdownFiles` to policy documents.
- [ ] Validate that Markdown paths do not contain `..` and end with `.md`.
- [ ] Validate extraction status values: `not-needed`, `success`, `partial`, `failed`, `not-run`.

### Task 2: Markdown extraction script

**Files:**
- Create: `agent/electricity-market-knowledge-agent/scripts/extract_policy_markdown.mjs`
- Create: `agent/electricity-market-knowledge-agent/tests/extract_policy_markdown.test.mjs`

- [ ] Write failing tests for Markdown path generation, text extraction, OCR fallback metadata, and JSON write-back.
- [ ] Implement PDF direct extraction with `pdftotext`.
- [ ] Implement scanned-PDF detection and OCRmyPDF fallback.
- [ ] Implement Office/WPS conversion with LibreOffice/textutil fallback.
- [ ] Implement Excel extraction with Python `openpyxl`.
- [ ] Emit Markdown front matter with source path, extraction method, OCR status, and timestamp.

### Task 3: Web browser UI

**Files:**
- Modify: `agent/electricity-market-knowledge-agent/scripts/export_web_preview.mjs`
- Modify: `agent/electricity-market-knowledge-agent/tests/web_preview.test.mjs`

- [ ] Sort policy rows by `publishedAt` descending.
- [ ] Rename row detail button from “查看详情” to “深度解读”.
- [ ] Add “知识浏览” button when Markdown extraction metadata exists.
- [ ] Render policy/attachment Markdown in a modal with tabs/sections.

### Task 4: Skill instructions and publishing workflow

**Files:**
- Modify: `agent/electricity-market-knowledge-agent/SKILL.md`
- Modify: `agent/electricity-market-knowledge-agent/tests/skill_content.test.mjs`
- Modify: `agent/electricity-market-knowledge-agent/scripts/publish_github_pages.mjs`

- [ ] Require Markdown extraction after source-file archiving and before webpage publication.
- [ ] Prepare GitHub Pages after extraction so `docs/knowledge-markdown/` is published.
- [ ] Sync updated skill files into `/Users/wuchao/.codex/skills/electricity-market-knowledge-agent/`.

### Task 5: Verification and release

**Files:**
- Modify generated `docs/index.html`, dated web archive, and Excel.
- Modify `knowledge-base/electricity-market.json` with Markdown metadata.

- [ ] Run all skill tests.
- [ ] Run extraction on the current knowledge base.
- [ ] Regenerate GitHub Pages output.
- [ ] Commit and push to GitHub.
