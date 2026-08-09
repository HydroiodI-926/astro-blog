import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const vocabularyUrl = new URL("../src/data/vocabulary.json", import.meta.url);

async function readVocabulary() {
	return JSON.parse(await readFile(vocabularyUrl, "utf8"));
}

test("vocabulary JSON uses upload batches with aggregate metadata", async () => {
	const data = await readVocabulary();
	assert.equal(data.schemaVersion, 2);
	assert.equal(data.meta.batchCount, data.batches.length);
	assert.equal(data.meta.entryCount, data.entries.length);
	assert.ok(data.batches.length >= 1);

	for (const batch of data.batches) {
		assert.match(batch.id, /^\d{8}T\d{6}Z-[a-f0-9]{8}$/);
		assert.ok(batch.id.endsWith(batch.sourceHash.slice(0, 8)));
		assert.ok(Number.isFinite(Date.parse(batch.uploadedAt)));
		assert.equal(
			data.entries.filter((entry) => entry.batchId === batch.id).length,
			batch.entryCount,
		);
	}

	assert.deepEqual(
		data.batches.map((batch) => batch.uploadedAt),
		data.batches
			.map((batch) => batch.uploadedAt)
			.slice()
			.sort()
			.reverse(),
	);
});

test("each batch preserves page-local numbering without ID conflicts", async () => {
	const data = await readVocabulary();
	const ids = new Set();

	for (const batch of data.batches) {
		const batchEntries = data.entries.filter(
			(entry) => entry.batchId === batch.id,
		);
		for (const [
			pageIndex,
			expectedCount,
		] of batch.expectedPageCounts.entries()) {
			const page = pageIndex + 1;
			const entries = batchEntries.filter((entry) => entry.page === page);
			assert.equal(entries.length, expectedCount);
			assert.deepEqual(
				entries.map((entry) => entry.number),
				Array.from({ length: expectedCount }, (_, index) => index + 1),
			);
		}
	}

	for (const entry of data.entries) {
		assert.equal(
			entry.id,
			`${entry.batchId}:p${entry.page}-${String(entry.number).padStart(2, "0")}`,
		);
		assert.match(entry.word, /^[A-Za-z][A-Za-z'-]*$/);
		assert.ok(entry.meaning.length > 0);
		assert.equal(ids.has(entry.id), false);
		ids.add(entry.id);
	}
});

test("the migrated first upload still matches the verified PDF", async () => {
	const data = await readVocabulary();
	const firstBatch = data.batches.at(-1);
	const entries = data.entries.filter(
		(entry) => entry.batchId === firstBatch.id,
	);

	assert.equal(firstBatch.entryCount, 109);
	assert.deepEqual(firstBatch.expectedPageCounts, [40, 40, 29]);
	assert.equal(entries[0].word, "proceeding");
	assert.equal(entries.at(-1).word, "benefit");
	assert.equal(
		entries.filter((entry) => entry.sourceTruncated).length,
		firstBatch.sourceTruncatedCount,
	);
});
