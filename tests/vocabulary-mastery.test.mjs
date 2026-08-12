import assert from "node:assert/strict";
import test from "node:test";

const masteryModuleUrl = new URL(
	"../src/utils/vocabulary-mastery.ts",
	import.meta.url,
);

async function loadMasteryModule() {
	return import(masteryModuleUrl.href);
}

test("mastery values are clamped and mapped to the three requested levels", async () => {
	const { applyMasteryChange, clampMastery, getMasteryLevel } =
		await loadMasteryModule();
	assert.equal(clampMastery(-1), 0);
	assert.equal(clampMastery(11), 10);
	assert.equal(getMasteryLevel(0), "unfamiliar");
	assert.equal(getMasteryLevel(3), "unfamiliar");
	assert.equal(getMasteryLevel(4), "familiar");
	assert.equal(getMasteryLevel(8), "familiar");
	assert.equal(getMasteryLevel(9), "mastered");
	assert.equal(getMasteryLevel(10), "mastered");
	assert.equal(applyMasteryChange(0, -1), 0);
	assert.equal(applyMasteryChange(8, 3), 10);
	assert.equal(applyMasteryChange(5, 1), 6);
});

test("older and less-mastered words receive higher review priority", async () => {
	const { getReviewPriority } = await loadMasteryModule();
	const now = Date.parse("2026-08-13T00:00:00.000Z");
	const recentWeak = getReviewPriority(
		{ mastery: 2, lastReviewedAt: "2026-08-12T00:00:00.000Z" },
		now,
	);
	const oldWeak = getReviewPriority(
		{ mastery: 2, lastReviewedAt: "2026-07-13T00:00:00.000Z" },
		now,
	);
	const oldStrong = getReviewPriority(
		{ mastery: 9, lastReviewedAt: "2026-07-13T00:00:00.000Z" },
		now,
	);
	assert.ok(oldWeak > recentWeak);
	assert.ok(oldWeak > oldStrong);
	assert.ok(getReviewPriority(undefined, now) > recentWeak);
});

test("weighted sampling never repeats a word in the same round", async () => {
	const { weightedSampleWithoutReplacement } = await loadMasteryModule();
	const selected = weightedSampleWithoutReplacement(
		["a", "b", "c"],
		3,
		(word) => ({ a: 10, b: 2, c: 1 })[word],
		() => 0,
	);
	assert.deepEqual(selected, ["a", "b", "c"]);
	assert.equal(new Set(selected).size, selected.length);
});
