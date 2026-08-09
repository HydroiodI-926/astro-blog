export const VOCABULARY_REVIEW_STORAGE_KEY =
	"english-vocabulary-review-activity:v1";
export const VOCABULARY_REVIEW_EVENT =
	"english-vocabulary-review-activity-change";

export interface DailyVocabularyReviewActivity {
	roundCount: number;
	wordCount: number;
}

export type VocabularyReviewActivity = Record<
	string,
	DailyVocabularyReviewActivity
>;

const shanghaiDateFormatter = new Intl.DateTimeFormat("en-CA", {
	timeZone: "Asia/Shanghai",
	year: "numeric",
	month: "2-digit",
	day: "2-digit",
});

export function getShanghaiDateKey(value: string | Date = new Date()) {
	const parts = shanghaiDateFormatter.formatToParts(new Date(value));
	const values = Object.fromEntries(
		parts.map((part) => [part.type, part.value]),
	);
	return `${values.year}-${values.month}-${values.day}`;
}

export function readVocabularyReviewActivity(): VocabularyReviewActivity {
	if (typeof window === "undefined") return {};

	try {
		const rawValue = window.localStorage.getItem(VOCABULARY_REVIEW_STORAGE_KEY);
		if (!rawValue) return {};
		const parsed = JSON.parse(rawValue) as Record<string, unknown>;
		const activity: VocabularyReviewActivity = {};

		for (const [dateKey, value] of Object.entries(parsed)) {
			if (
				!/^\d{4}-\d{2}-\d{2}$/.test(dateKey) ||
				!value ||
				typeof value !== "object"
			) {
				continue;
			}
			const record = value as Record<string, unknown>;
			const roundCount = Number(record.roundCount);
			const wordCount = Number(record.wordCount);
			if (
				!Number.isSafeInteger(roundCount) ||
				!Number.isSafeInteger(wordCount) ||
				roundCount < 0 ||
				wordCount < 0
			) {
				continue;
			}
			activity[dateKey] = { roundCount, wordCount };
		}

		return activity;
	} catch (error) {
		console.warn("Failed to restore vocabulary review activity", error);
		return {};
	}
}

export function recordVocabularyReview(wordCount: number) {
	if (
		typeof window === "undefined" ||
		!Number.isSafeInteger(wordCount) ||
		wordCount <= 0
	) {
		return;
	}

	const activity = readVocabularyReviewActivity();
	const dateKey = getShanghaiDateKey();
	const current = activity[dateKey] ?? { roundCount: 0, wordCount: 0 };
	activity[dateKey] = {
		roundCount: current.roundCount + 1,
		wordCount: current.wordCount + wordCount,
	};

	try {
		window.localStorage.setItem(
			VOCABULARY_REVIEW_STORAGE_KEY,
			JSON.stringify(activity),
		);
		window.dispatchEvent(new CustomEvent(VOCABULARY_REVIEW_EVENT));
	} catch (error) {
		console.warn("Failed to save vocabulary review activity", error);
	}
}
