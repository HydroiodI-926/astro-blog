#!/usr/bin/env python3
"""Build lexical relations for the local vocabulary library.

The script combines sense-aware synonyms from Open English WordNet with
etymology and word-family information from Wiktextract's Kaikki endpoint.
Only explicit etymological root markers are used to connect same-root words.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import zipfile
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable


OEWN_URL = "https://en-word.net/static/english-wordnet-2025-json.zip"
OEWN_PAGE = "https://en-word.net/"
KAIKKI_BASE_URL = "https://kaikki.org/dictionary/English/meaning"
KAIKKI_PAGE = "https://kaikki.org/dictionary/English/"
WORD_PATTERN = re.compile(r"^[A-Za-z][A-Za-z' -]*$")
ROOT_CATEGORY_PATTERN = re.compile(
    r"English terms derived from (?:the )?(.+? root .+)$", re.IGNORECASE
)
POS_LABELS = {
    "n": "名词",
    "v": "动词",
    "a": "形容词",
    "s": "形容词",
    "r": "副词",
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="生成单词词族、同根词和同义词关系 JSON")
    parser.add_argument(
        "--input",
        type=Path,
        default=Path("src/data/vocabulary.json"),
        help="词表 JSON 路径",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("src/data/vocabulary-relations.json"),
        help="关系 JSON 输出路径",
    )
    parser.add_argument(
        "--cache-dir",
        type=Path,
        default=Path("cache/vocabulary"),
        help="下载缓存目录",
    )
    parser.add_argument(
        "--wordnet-archive",
        type=Path,
        help="已有 Open English WordNet JSON ZIP；未提供时写入缓存",
    )
    parser.add_argument(
        "--offline",
        action="store_true",
        help="仅使用已有缓存，不发起网络请求",
    )
    parser.add_argument("--workers", type=int, default=6, help="Kaikki 并发下载数")
    return parser.parse_args()


def normalize_word(value: str) -> str:
    return " ".join(value.strip().lower().split())


def clean_root(value: str) -> str:
    return " ".join(value.strip().strip("[](){}").split())


def valid_related_word(value: object) -> bool:
    return isinstance(value, str) and len(value) <= 48 and bool(WORD_PATTERN.fullmatch(value.strip()))


def read_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def download(url: str, destination: Path, retries: int = 3) -> bytes:
    request = urllib.request.Request(
        url,
        headers={"User-Agent": "astro-blog-vocabulary-enricher/1.0"},
    )
    for attempt in range(retries):
        try:
            with urllib.request.urlopen(request, timeout=45) as response:
                data = response.read()
            destination.parent.mkdir(parents=True, exist_ok=True)
            destination.write_bytes(data)
            return data
        except (urllib.error.URLError, TimeoutError):
            if attempt == retries - 1:
                raise
            time.sleep(1.5 * (attempt + 1))
    raise RuntimeError("unreachable")


def ensure_wordnet_archive(args: argparse.Namespace) -> Path:
    archive = args.wordnet_archive or args.cache_dir / "english-wordnet-2025-json.zip"
    if archive.exists():
        return archive
    if args.offline:
        raise FileNotFoundError(f"离线模式下找不到 WordNet 文件：{archive}")
    print(f"下载 Open English WordNet：{OEWN_URL}")
    download(OEWN_URL, archive)
    return archive


def kaikki_url(word: str) -> str:
    encoded = urllib.parse.quote(word, safe="")
    return f"{KAIKKI_BASE_URL}/{encoded[0]}/{encoded[:2]}/{encoded}.jsonl"


def load_kaikki_word(word: str, cache_dir: Path, offline: bool) -> tuple[str, list[dict[str, Any]], str | None]:
    cache_path = cache_dir / "wiktextract" / f"{urllib.parse.quote(word, safe='')}.jsonl"
    try:
        if cache_path.exists():
            payload = cache_path.read_bytes()
        elif offline:
            return word, [], "缓存缺失"
        else:
            payload = download(kaikki_url(word), cache_path)
    except urllib.error.HTTPError as error:
        if error.code == 404:
            return word, [], "Kaikki 未收录"
        return word, [], f"HTTP {error.code}"
    except (urllib.error.URLError, TimeoutError) as error:
        return word, [], str(error)

    records: list[dict[str, Any]] = []
    for raw_line in payload.decode("utf-8").splitlines():
        if not raw_line.strip():
            continue
        try:
            item = json.loads(raw_line)
        except json.JSONDecodeError:
            continue
        if item.get("lang_code") == "en" and normalize_word(item.get("word", "")) == word:
            records.append(item)
    return word, records, None if records else "Kaikki 未返回匹配词条"


def relation_items(values: Iterable[dict[str, Any]], relation: str) -> list[tuple[str, str]]:
    result: list[tuple[str, str]] = []
    for item in values:
        value = item.get("word") or item.get("form")
        if valid_related_word(value):
            result.append((value.strip(), relation))
    return result


def extract_kaikki(records: list[dict[str, Any]], self_word: str) -> dict[str, Any]:
    family: dict[str, dict[str, str]] = {}
    roots: dict[str, str] = {}
    etymologies: list[str] = []

    def add_family(value: str, relation: str) -> None:
        key = normalize_word(value)
        if key == self_word:
            return
        priority = {"派生词": 0, "词形变化": 1, "相关词": 2}
        current = family.get(key)
        if current is None or priority[relation] < priority[current["relation"]]:
            family[key] = {"word": value, "relation": relation}

    for record in records:
        etymology = record.get("etymology_text")
        if isinstance(etymology, str) and etymology.strip() and etymology not in etymologies:
            etymologies.append(etymology.strip())

        for value, relation in relation_items(record.get("forms", []), "词形变化"):
            add_family(value, relation)
        for value, relation in relation_items(record.get("derived", []), "派生词"):
            add_family(value, relation)
        for value, relation in relation_items(record.get("related", []), "相关词"):
            add_family(value, relation)
        for sense in record.get("senses", []):
            for value, relation in relation_items(sense.get("derived", []), "派生词"):
                add_family(value, relation)
            for value, relation in relation_items(sense.get("related", []), "相关词"):
                add_family(value, relation)

        for category in record.get("categories", []):
            if not isinstance(category, dict):
                continue
            name = category.get("name", "")
            match = ROOT_CATEGORY_PATTERN.fullmatch(name)
            if match:
                root = clean_root(match.group(1))
                roots[root.casefold()] = root

        for template in record.get("etymology_templates", []):
            if template.get("name") != "root":
                continue
            args = template.get("args", {})
            for index in range(3, 10):
                value = args.get(str(index))
                if isinstance(value, str) and value.strip():
                    root = clean_root(value)
                    roots[root.casefold()] = root

    return {
        "etymology": min(etymologies, key=len) if etymologies else "",
        "roots": sorted(roots.values(), key=str.casefold),
        "family": sorted(family.values(), key=lambda item: (item["relation"], item["word"].casefold())),
    }


def load_wordnet_synonyms(archive: Path, target_words: set[str]) -> dict[str, list[dict[str, Any]]]:
    word_senses: dict[str, list[tuple[str, str]]] = defaultdict(list)
    target_synsets: set[str] = set()

    with zipfile.ZipFile(archive) as bundle:
        for name in bundle.namelist():
            if not name.startswith("entries-") or not name.endswith(".json"):
                continue
            entries = json.loads(bundle.read(name))
            for lemma, parts in entries.items():
                key = normalize_word(lemma)
                if key not in target_words:
                    continue
                for pos, value in parts.items():
                    for sense in value.get("sense", []):
                        synset_id = sense.get("synset")
                        if synset_id:
                            word_senses[key].append((pos, synset_id))
                            target_synsets.add(synset_id)

        synsets: dict[str, dict[str, Any]] = {}
        for name in bundle.namelist():
            if name.startswith("entries-") or not name.endswith(".json"):
                continue
            if name in {"frames.json", "lexdomains.json"}:
                continue
            data = json.loads(bundle.read(name))
            for synset_id in target_synsets.intersection(data):
                synsets[synset_id] = data[synset_id]

    result: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for word, senses in word_senses.items():
        seen: set[tuple[str, tuple[str, ...]]] = set()
        for pos, synset_id in senses:
            synset = synsets.get(synset_id)
            if not synset:
                continue
            members = sorted(
                {
                    member.strip()
                    for member in synset.get("members", [])
                    if valid_related_word(member) and normalize_word(member) != word
                },
                key=str.casefold,
            )
            if not members:
                continue
            definition = next(
                (item.strip() for item in synset.get("definition", []) if isinstance(item, str) and item.strip()),
                "",
            )
            signature = (definition, tuple(member.casefold() for member in members))
            if signature in seen:
                continue
            seen.add(signature)
            result[word].append(
                {
                    "senseId": synset_id,
                    "partOfSpeech": POS_LABELS.get(pos, pos),
                    "definition": definition,
                    "words": members,
                    "source": "oewn",
                }
            )
    return result


def attach_library_metadata(word: str, library_index: dict[str, list[str]]) -> dict[str, Any]:
    entry_ids = library_index.get(normalize_word(word), [])
    return {
        "word": word,
        "inLibrary": bool(entry_ids),
        "entryIds": entry_ids,
    }


def main() -> int:
    args = parse_args()
    vocabulary = read_json(args.input)
    library_index: dict[str, list[str]] = defaultdict(list)
    display_words: dict[str, str] = {}
    for entry in vocabulary["entries"]:
        key = normalize_word(entry["word"])
        library_index[key].append(entry["id"])
        display_words.setdefault(key, entry["word"])
    target_words = set(library_index)

    archive = ensure_wordnet_archive(args)
    print(f"读取 Open English WordNet：{archive}")
    synonyms = load_wordnet_synonyms(archive, target_words)

    kaikki_data: dict[str, dict[str, Any]] = {}
    unresolved: dict[str, str] = {}
    worker_count = max(1, min(args.workers, 10))
    print(f"读取 Wiktextract / Kaikki：{len(target_words)} 个唯一单词")
    with ThreadPoolExecutor(max_workers=worker_count) as executor:
        futures = {
            executor.submit(load_kaikki_word, word, args.cache_dir, args.offline): word
            for word in sorted(target_words)
        }
        completed = 0
        for future in as_completed(futures):
            word, records, error = future.result()
            completed += 1
            kaikki_data[word] = extract_kaikki(records, word)
            if error:
                unresolved[word] = error
            if completed % 20 == 0 or completed == len(futures):
                print(f"  已处理 {completed}/{len(futures)}")

    root_members: dict[str, set[str]] = defaultdict(set)
    root_labels: dict[str, str] = {}
    for word, item in kaikki_data.items():
        for root in item["roots"]:
            root_key = root.casefold()
            root_members[root_key].add(word)
            root_labels[root_key] = root

    words_payload: dict[str, dict[str, Any]] = {}
    for word in sorted(target_words):
        item = kaikki_data.get(word, {"etymology": "", "roots": [], "family": []})
        family = []
        for member in item["family"]:
            enriched = attach_library_metadata(member["word"], library_index)
            enriched.update({"relation": member["relation"], "source": "wiktextract"})
            family.append(enriched)
        family.sort(key=lambda member: (not member["inLibrary"], member["relation"], member["word"].casefold()))

        same_root_map: dict[str, set[str]] = defaultdict(set)
        for root in item["roots"]:
            root_key = root.casefold()
            for member in root_members[root_key]:
                if member != word:
                    same_root_map[member].add(root_labels[root_key])
        same_root = []
        for member in sorted(same_root_map):
            related = attach_library_metadata(display_words[member], library_index)
            related.update(
                {
                    "sharedRoots": sorted(same_root_map[member], key=str.casefold),
                    "source": "wiktextract",
                }
            )
            same_root.append(related)

        synonym_groups = []
        for group in synonyms.get(word, []):
            enriched_words = [attach_library_metadata(member, library_index) for member in group["words"]]
            enriched_words.sort(key=lambda member: (not member["inLibrary"], member["word"].casefold()))
            synonym_groups.append({**group, "words": enriched_words})

        words_payload[word] = {
            "word": display_words[word],
            "etymology": item["etymology"],
            "roots": item["roots"],
            "family": family,
            "sameRoot": same_root,
            "synonymGroups": synonym_groups,
        }

    meta = {
        "wordCount": len(target_words),
        "withEtymology": sum(bool(item["etymology"]) for item in words_payload.values()),
        "withFamily": sum(bool(item["family"]) for item in words_payload.values()),
        "withSameRoot": sum(bool(item["sameRoot"]) for item in words_payload.values()),
        "withSynonyms": sum(bool(item["synonymGroups"]) for item in words_payload.values()),
        "unresolvedWords": [
            {"word": display_words[word], "reason": reason}
            for word, reason in sorted(unresolved.items())
        ],
    }
    output = {
        "schemaVersion": 1,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "sources": {
            "oewn": {
                "name": "Open English WordNet 2025",
                "license": "CC BY 4.0",
                "url": OEWN_PAGE,
            },
            "wiktextract": {
                "name": "Kaikki / Wiktextract",
                "license": "CC BY-SA 4.0 / GFDL",
                "url": KAIKKI_PAGE,
            },
        },
        "meta": meta,
        "words": words_payload,
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(output, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(
        f"已生成 {args.output}：{meta['wordCount']} 词，"
        f"{meta['withFamily']} 个有词族，{meta['withSameRoot']} 个有同根词，"
        f"{meta['withSynonyms']} 个有同义词"
    )
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (FileNotFoundError, ValueError, zipfile.BadZipFile, json.JSONDecodeError) as error:
        print(f"错误：{error}", file=sys.stderr)
        raise SystemExit(1) from error
