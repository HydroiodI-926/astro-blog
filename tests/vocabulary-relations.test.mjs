import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const vocabularyUrl = new URL("../src/data/vocabulary.json", import.meta.url);
const relationsUrl = new URL(
	"../src/data/vocabulary-relations.json",
	import.meta.url,
);

async function readData() {
	const [vocabulary, relations] = await Promise.all([
		readFile(vocabularyUrl, "utf8").then(JSON.parse),
		readFile(relationsUrl, "utf8").then(JSON.parse),
	]);
	return { vocabulary, relations };
}

test("relation JSON covers every unique vocabulary word", async () => {
	const { vocabulary, relations } = await readData();
	const vocabularyWords = new Set(
		vocabulary.entries.map((entry) => entry.word.trim().toLowerCase()),
	);

	assert.equal(relations.schemaVersion, 1);
	assert.equal(relations.meta.wordCount, vocabularyWords.size);
	assert.deepEqual(new Set(Object.keys(relations.words)), vocabularyWords);
	assert.equal(relations.sources.oewn.license, "CC BY 4.0");
	assert.match(relations.sources.wiktextract.name, /Wiktextract/);
});

test("library links always point to real entries for the same word", async () => {
	const { vocabulary, relations } = await readData();
	const entriesById = new Map(
		vocabulary.entries.map((entry) => [entry.id, entry]),
	);
	const entryIdsByWord = new Map();
	for (const entry of vocabulary.entries) {
		const word = entry.word.trim().toLowerCase();
		entryIdsByWord.set(word, [...(entryIdsByWord.get(word) ?? []), entry.id]);
	}

	for (const [word, relation] of Object.entries(relations.words)) {
		const links = [
			...relation.family,
			...relation.sameRoot,
			...relation.synonymGroups.flatMap((group) => group.words),
		];
		for (const link of links) {
			assert.notEqual(link.word.trim().toLowerCase(), word);
			assert.equal(link.inLibrary, link.entryIds.length > 0);
			if (link.inLibrary) {
				assert.deepEqual(
					link.entryIds,
					entryIdsByWord.get(link.word.trim().toLowerCase()),
					`${link.word} 的关系数据未包含全部重复词条，请重新运行 enrich:vocabulary`,
				);
			}
			for (const entryId of link.entryIds) {
				const entry = entriesById.get(entryId);
				assert.ok(entry, `${link.word} 指向不存在的词条 ${entryId}`);
				assert.equal(
					entry.word.trim().toLowerCase(),
					link.word.trim().toLowerCase(),
				);
			}
		}
	}
});

test("duplicate spellings remain searchable records with collision-free IDs", async () => {
	const { vocabulary, relations } = await readData();
	const entriesByWord = new Map();
	for (const entry of vocabulary.entries) {
		const word = entry.word.trim().toLowerCase();
		entriesByWord.set(word, [...(entriesByWord.get(word) ?? []), entry]);
	}
	const duplicateGroups = [...entriesByWord.entries()].filter(
		([, entries]) => entries.length > 1,
	);

	assert.ok(duplicateGroups.length > 0);
	for (const [word, entries] of duplicateGroups) {
		assert.equal(
			new Set(entries.map((entry) => entry.id)).size,
			entries.length,
		);
		assert.ok(relations.words[word], `${word} 缺少共享关系数据`);
	}
});

test("same-root links share an explicit root and synonym groups retain senses", async () => {
	const { relations } = await readData();

	for (const [word, relation] of Object.entries(relations.words)) {
		for (const linked of relation.sameRoot) {
			assert.equal(linked.inLibrary, true);
			assert.ok(linked.sharedRoots.length > 0);
			for (const root of linked.sharedRoots) {
				assert.ok(relation.roots.includes(root));
				assert.ok(
					relations.words[linked.word.toLowerCase()].roots.includes(root),
				);
			}
		}

		for (const group of relation.synonymGroups) {
			assert.equal(group.source, "oewn");
			assert.ok(group.senseId.length > 0);
			assert.ok(group.definition.length > 0, `${word} 的同义词组缺少义项说明`);
			assert.ok(group.words.length > 0);
		}
	}
});

test("known word-family links are preserved for detail navigation", async () => {
	const { relations } = await readData();
	const proceedFamily = relations.words.proceed.family;

	assert.ok(
		proceedFamily.some((link) => link.word === "proceeding" && link.inLibrary),
	);
	assert.ok(
		proceedFamily.some((link) => link.word === "process" && link.inLibrary),
	);
	assert.ok(relations.meta.withFamily > 0);
	assert.ok(relations.meta.withSynonyms > 0);
});
