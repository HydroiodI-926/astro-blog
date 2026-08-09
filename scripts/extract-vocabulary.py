#!/usr/bin/env python3
"""Extract numbered vocabulary rows and append them as an import batch."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

try:
	from pypdf import PdfReader
except ImportError as exc:  # pragma: no cover - depends on the local runtime
	raise SystemExit(
		"缺少 pypdf。请先运行 `python -m pip install pypdf`，再重新提取。"
	) from exc


HEADER_PATTERN = re.compile(r"N\s*O\s*\.", re.IGNORECASE)
NUMBER_PATTERN = re.compile(r"^(?:[1-9]|[1-3][0-9]|40)$")
WORD_PATTERN = re.compile(r"^[A-Za-z][A-Za-z\s'-]*$")
HEADER_LINES = {"NO.", "VOCABULARY", "MEANING"}
SCHEMA_VERSION = 2


def normalize_header(value: str) -> str:
	return re.sub(r"\s+", "", value).upper()


def first_text_layer(page_text: str) -> str:
	"""Keep the visible text layer; this PDF embeds every table a second time."""

	header_offsets = [match.start() for match in HEADER_PATTERN.finditer(page_text)]
	if len(header_offsets) < 3:
		raise ValueError("未检测到预期的双列表格结构，PDF 版式可能已变化。")
	return page_text[: header_offsets[2]]


def clean_lines(page_text: str) -> list[str]:
	lines = [line.strip() for line in first_text_layer(page_text).splitlines()]
	return [
		line
		for line in lines
		if line and normalize_header(line) not in HEADER_LINES
	]


def parse_page(page_text: str, page_number: int) -> list[dict[str, Any]]:
	lines = clean_lines(page_text)
	entries: list[dict[str, Any]] = []
	index = 0

	while index < len(lines):
		if not NUMBER_PATTERN.fullmatch(lines[index]):
			index += 1
			continue

		number = int(lines[index])
		index += 1

		# Empty template rows on the final page are just consecutive numbers.
		if index >= len(lines) or NUMBER_PATTERN.fullmatch(lines[index]):
			continue

		word_parts: list[str] = []
		while index < len(lines) and lines[index] != "英":
			if NUMBER_PATTERN.fullmatch(lines[index]):
				break
			word_parts.append(lines[index])
			index += 1

		if index >= len(lines) or lines[index] != "英":
			continue

		word = re.sub(r"\s+", "", "".join(word_parts))
		if not word or not WORD_PATTERN.fullmatch(word):
			raise ValueError(f"第 {page_number} 页编号 {number} 的单词无法识别：{word!r}")

		index += 1
		if index >= len(lines) or lines[index] != "[":
			raise ValueError(f"第 {page_number} 页编号 {number} 缺少音标起始符。")
		index += 1

		phonetic_parts: list[str] = []
		while index < len(lines) and lines[index] != "]":
			phonetic_parts.append(lines[index])
			index += 1
		if index >= len(lines):
			raise ValueError(f"第 {page_number} 页编号 {number} 缺少音标结束符。")
		index += 1

		meaning_parts: list[str] = []
		while index < len(lines) and not NUMBER_PATTERN.fullmatch(lines[index]):
			meaning_parts.append(lines[index])
			index += 1

		meaning = re.sub(r"\s+", " ", "".join(meaning_parts)).strip()
		if not meaning:
			raise ValueError(f"第 {page_number} 页编号 {number} 缺少中文释义。")

		entries.append(
			{
				"page": page_number,
				"number": number,
				"word": word,
				"phonetic": re.sub(r"\s+", "", "".join(phonetic_parts)),
				"meaning": meaning,
				"sourceTruncated": meaning.endswith("…"),
			}
		)

	return entries


def validate_entries(entries: list[dict[str, Any]], expected_counts: list[int]) -> None:
	for page_number, expected_count in enumerate(expected_counts, start=1):
		page_entries = [entry for entry in entries if entry["page"] == page_number]
		if len(page_entries) != expected_count:
			raise ValueError(
				f"第 {page_number} 页提取 {len(page_entries)} 条，预期 {expected_count} 条。"
			)
		expected_numbers = list(range(1, expected_count + 1))
		actual_numbers = [entry["number"] for entry in page_entries]
		if actual_numbers != expected_numbers:
			raise ValueError(f"第 {page_number} 页编号不连续：{actual_numbers}")


def parse_expected_counts(value: str) -> list[int]:
	try:
		counts = [int(part.strip()) for part in value.split(",")]
	except ValueError as exc:
		raise argparse.ArgumentTypeError("页条目数必须是逗号分隔的整数。") from exc
	if not counts or any(count <= 0 or count > 40 for count in counts):
		raise argparse.ArgumentTypeError("每页条目数必须在 1 到 40 之间。")
	return counts


def normalize_uploaded_at(value: str | None) -> str:
	if value is None:
		return datetime.now().astimezone().isoformat(timespec="seconds")

	try:
		parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
	except ValueError as exc:
		raise ValueError("上传时间必须是 ISO 8601 格式，例如 2026-08-08T18:30:00+08:00。") from exc
	if parsed.tzinfo is None:
		parsed = parsed.astimezone()
	return parsed.isoformat(timespec="seconds")


def make_batch_id(uploaded_at: str, source_hash: str) -> str:
	parsed = datetime.fromisoformat(uploaded_at.replace("Z", "+00:00"))
	utc_stamp = parsed.astimezone(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
	return f"{utc_stamp}-{source_hash[:8]}"


def migrate_legacy_payload(payload: dict[str, Any]) -> dict[str, Any]:
	meta = payload.get("meta", {})
	legacy_entries = payload.get("entries", [])
	if not legacy_entries:
		return {"schemaVersion": SCHEMA_VERSION, "meta": {}, "batches": [], "entries": []}

	uploaded_at = normalize_uploaded_at(meta.get("generatedAt"))
	legacy_identity = str(meta.get("sourceFile", "legacy-vocabulary"))
	placeholder_hash = hashlib.sha256(legacy_identity.encode("utf-8")).hexdigest()
	batch_id = make_batch_id(uploaded_at, placeholder_hash)
	batch = {
		"id": batch_id,
		"title": str(meta.get("title", "历史词表")),
		"sourceFile": str(meta.get("sourceFile", "unknown.pdf")),
		"sourceHash": "",
		"uploadedAt": uploaded_at,
		"pageCount": int(meta.get("pageCount", 0)),
		"entryCount": len(legacy_entries),
		"expectedPageCounts": meta.get("expectedPageCounts", []),
		"sourceTruncatedCount": int(meta.get("sourceTruncatedCount", 0)),
	}
	migrated_entries = [
		{
			**{key: value for key, value in entry.items() if key != "id"},
			"id": f"{batch_id}:p{entry['page']}-{entry['number']:02d}",
			"batchId": batch_id,
		}
		for entry in legacy_entries
	]
	return {
		"schemaVersion": SCHEMA_VERSION,
		"meta": {},
		"batches": [batch],
		"entries": migrated_entries,
	}


def load_existing_payload(output_path: Path) -> dict[str, Any]:
	if not output_path.exists():
		return {"schemaVersion": SCHEMA_VERSION, "meta": {}, "batches": [], "entries": []}
	try:
		payload = json.loads(output_path.read_text(encoding="utf-8"))
	except (json.JSONDecodeError, OSError) as exc:
		raise ValueError(f"现有 JSON 无法读取：{exc}") from exc
	if payload.get("schemaVersion") == SCHEMA_VERSION:
		return payload
	return migrate_legacy_payload(payload)


def extract_batch(
	pdf_path: Path,
	expected_counts: list[int],
	uploaded_at: str,
	source_hash: str,
	batch_id: str,
) -> tuple[dict[str, Any], list[dict[str, Any]]]:
	reader = PdfReader(str(pdf_path))
	if len(reader.pages) != len(expected_counts):
		raise ValueError(
			f"PDF 共 {len(reader.pages)} 页，但预期配置了 {len(expected_counts)} 页。"
		)

	parsed_entries = [
		entry
		for page_number, page in enumerate(reader.pages, start=1)
		for entry in parse_page(page.extract_text() or "", page_number)
	]
	validate_entries(parsed_entries, expected_counts)
	entries = [
		{
			"id": f"{batch_id}:p{entry['page']}-{entry['number']:02d}",
			"batchId": batch_id,
			**entry,
		}
		for entry in parsed_entries
	]
	batch = {
		"id": batch_id,
		"title": pdf_path.stem,
		"sourceFile": pdf_path.name,
		"sourceHash": source_hash,
		"uploadedAt": uploaded_at,
		"pageCount": len(reader.pages),
		"entryCount": len(entries),
		"expectedPageCounts": expected_counts,
		"sourceTruncatedCount": sum(
			1 for entry in entries if entry["sourceTruncated"]
		),
	}
	return batch, entries


def merge_batch(
	existing: dict[str, Any],
	pdf_path: Path,
	expected_counts: list[int],
	uploaded_at_arg: str | None,
) -> tuple[dict[str, Any], str, str]:
	source_hash = hashlib.sha256(pdf_path.read_bytes()).hexdigest()
	matching_batch = next(
		(
			batch
			for batch in existing.get("batches", [])
			if batch.get("sourceHash") == source_hash
			or (
				not batch.get("sourceHash")
				and batch.get("sourceFile") == pdf_path.name
			)
		),
		None,
	)

	if matching_batch:
		uploaded_at = (
			normalize_uploaded_at(uploaded_at_arg)
			if uploaded_at_arg is not None
			else matching_batch["uploadedAt"]
		)
		expected_batch_id = make_batch_id(uploaded_at, source_hash)
		batch_id = (
			matching_batch["id"]
			if matching_batch.get("sourceHash")
			and uploaded_at_arg is None
			and matching_batch.get("id") == expected_batch_id
			else expected_batch_id
		)
		action = "更新"
	else:
		uploaded_at = normalize_uploaded_at(uploaded_at_arg)
		batch_id = make_batch_id(uploaded_at, source_hash)
		action = "新增"

	batch, entries = extract_batch(
		pdf_path, expected_counts, uploaded_at, source_hash, batch_id
	)
	replaced_ids = {
		candidate["id"]
		for candidate in existing.get("batches", [])
		if candidate.get("id") == batch_id
		or (matching_batch and candidate.get("id") == matching_batch.get("id"))
	}
	batches = [
		candidate
		for candidate in existing.get("batches", [])
		if candidate.get("id") not in replaced_ids
	]
	all_entries = [
		entry
		for entry in existing.get("entries", [])
		if entry.get("batchId") not in replaced_ids
	]
	batches.append(batch)
	all_entries.extend(entries)
	batches.sort(key=lambda candidate: candidate["uploadedAt"], reverse=True)
	batch_order = {candidate["id"]: index for index, candidate in enumerate(batches)}
	all_entries.sort(
		key=lambda entry: (
			batch_order.get(entry["batchId"], len(batches)),
			entry["page"],
			entry["number"],
		)
	)

	updated_at = datetime.now(timezone.utc).isoformat(timespec="seconds")
	return (
		{
			"schemaVersion": SCHEMA_VERSION,
			"meta": {
				"title": "英语单词学习数据",
				"updatedAt": updated_at,
				"batchCount": len(batches),
				"entryCount": len(all_entries),
				"sourceTruncatedCount": sum(
					candidate["sourceTruncatedCount"] for candidate in batches
				),
			},
			"batches": batches,
			"entries": all_entries,
		},
		action,
		batch_id,
	)


def main() -> int:
	parser = argparse.ArgumentParser(
		description="从奶酪单词中英词表 PDF 提取记录，并按上传时间追加为独立批次。"
	)
	parser.add_argument("pdf", type=Path, help="待提取的 PDF 文件路径")
	parser.add_argument(
		"--output",
		type=Path,
		default=Path("src/data/vocabulary.json"),
		help="JSON 输出路径（默认：src/data/vocabulary.json）",
	)
	parser.add_argument(
		"--expected-page-counts",
		type=parse_expected_counts,
		default=[40, 40, 29],
		help="各页有效条目数，逗号分隔（默认：40,40,29）",
	)
	parser.add_argument(
		"--uploaded-at",
		help="本批次上传时间（ISO 8601）；不提供时使用当前本地时间",
	)
	args = parser.parse_args()

	if not args.pdf.is_file():
		parser.error(f"PDF 文件不存在：{args.pdf}")

	try:
		existing = load_existing_payload(args.output)
		payload, action, batch_id = merge_batch(
			existing,
			args.pdf,
			args.expected_page_counts,
			args.uploaded_at,
		)
	except (ValueError, OSError) as exc:
		print(f"提取失败：{exc}", file=sys.stderr)
		return 1

	args.output.parent.mkdir(parents=True, exist_ok=True)
	args.output.write_text(
		json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
		encoding="utf-8",
	)
	changed_batch = next(
		batch for batch in payload["batches"] if batch["id"] == batch_id
	)
	print(
		f"已{action}批次 {changed_batch['uploadedAt']}，"
		f"本批 {changed_batch['entryCount']} 条，"
		f"当前共 {payload['meta']['batchCount']} 批、{payload['meta']['entryCount']} 条。"
	)
	print(f"JSON 已写入：{args.output.resolve()}")
	return 0


if __name__ == "__main__":
	raise SystemExit(main())
