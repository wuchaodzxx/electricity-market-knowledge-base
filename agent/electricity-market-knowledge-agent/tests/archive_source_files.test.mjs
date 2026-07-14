import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  archivePolicyDocuments,
  buildArchivedFileName,
} from "../scripts/archive_source_files.mjs";

test("builds archived source file names from date title and document number", () => {
  assert.equal(
    buildArchivedFileName({
      publishedAt: "2026-01-30",
      title: "国家发展改革委 国家能源局关于完善发电侧容量电价机制的通知",
      documentNumber: "发改价格〔2026〕114号",
      officialUrl: "https://example.gov.cn/a",
    }),
    "2026-01-30-关于完善发电侧容量电价机制的通知(发改价格〔2026〕114号).html",
  );
  assert.equal(
    buildArchivedFileName({
      publishedAt: "",
      title: "山西电力中长期市场实施细则",
      documentNumber: "晋监能市场规〔2026〕1号",
      officialUrl: "https://example.gov.cn/a.pdf",
    }),
    "山西电力中长期市场实施细则(晋监能市场规〔2026〕1号).pdf",
  );
});

test("archives policy source files and writes localFilePath", async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "electricity-source-archive-"));
  const inputPath = path.join(tmpDir, "knowledge.json");
  const sourceDir = path.join(tmpDir, "docs", "source-files");
  const store = {
    metadata: {
      schemaVersion: 1,
      supportedProvinces: ["江苏", "浙江", "山西", "湖北", "四川", "山东", "甘肃", "安徽"],
      lastUpdatedAt: "2026-07-14",
    },
    concepts: [],
    provincialRules: [],
    updateEvents: [],
    policyDocuments: [
      {
        id: "doc-1",
        title: "国家发展改革委 国家能源局关于完善发电侧容量电价机制的通知",
        documentNumber: "发改价格〔2026〕114号",
        issuer: "国家发展改革委、国家能源局",
        publishedAt: "2026-01-30",
        officialUrl: "https://example.gov.cn/policy",
        scope: "国家",
        status: "有效",
        firstRecordedAt: "2026-07-14",
        lastVerifiedAt: "2026-07-14",
        detailedSummary: "示例详细解读。",
      },
    ],
  };
  await fs.writeFile(inputPath, JSON.stringify(store), "utf8");

  const fetchImpl = async () => ({
    ok: true,
    status: 200,
    headers: { get: () => "text/html; charset=utf-8" },
    arrayBuffer: async () => new TextEncoder().encode("<html>官方文件</html>").buffer,
  });

  const result = await archivePolicyDocuments({
    inputPath,
    sourceDir,
    publicPrefix: "source-files",
    fetchImpl,
  });

  const updated = JSON.parse(await fs.readFile(inputPath, "utf8"));
  assert.equal(result.archived.length, 1);
  assert.equal(
    updated.policyDocuments[0].localFilePath,
    "source-files/2026-01-30-关于完善发电侧容量电价机制的通知(发改价格〔2026〕114号).html",
  );
  assert.match(
    await fs.readFile(path.join(sourceDir, "2026-01-30-关于完善发电侧容量电价机制的通知(发改价格〔2026〕114号).html"), "utf8"),
    /官方文件/,
  );
});
