import assert from "node:assert/strict";
import test from "node:test";

import { selectPostUpdatedAt } from "../src/utils/post-git-activity.ts";

test("an existing article counts its first post-baseline commit as an update", () => {
	assert.equal(
		selectPostUpdatedAt({
			publishedAt: "2026-08-01T00:00:00.000Z",
			existedAtBaseline: true,
			commitDatesAfterBaseline: ["2026-08-21T09:30:00+08:00"],
		}),
		"2026-08-21T09:30:00+08:00",
	);
});

test("a new article's first commit is only its publication", () => {
	assert.equal(
		selectPostUpdatedAt({
			publishedAt: "2026-08-21T00:00:00.000Z",
			existedAtBaseline: false,
			commitDatesAfterBaseline: ["2026-08-21T09:30:00+08:00"],
		}),
		undefined,
	);
});

test("a later commit to a new article counts as an update", () => {
	assert.equal(
		selectPostUpdatedAt({
			publishedAt: "2026-08-21T00:00:00.000Z",
			existedAtBaseline: false,
			commitDatesAfterBaseline: [
				"2026-08-21T09:30:00+08:00",
				"2026-08-23T14:00:00+08:00",
			],
		}),
		"2026-08-23T14:00:00+08:00",
	);
});

test("published remains the fallback when no real update exists", () => {
	assert.equal(
		selectPostUpdatedAt({
			publishedAt: "2026-08-21T00:00:00.000Z",
			explicitUpdatedAt: "2026-08-21T00:00:00.000Z",
			existedAtBaseline: true,
			commitDatesAfterBaseline: [],
		}),
		undefined,
	);
});
