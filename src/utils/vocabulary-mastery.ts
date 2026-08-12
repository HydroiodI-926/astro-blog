import type {
	MasteryLevel,
	VocabularyProgressRecord,
} from "@components/features/english-learning/types";

export const MIN_MASTERY = 0;
export const MAX_MASTERY = 10;

export function clampMastery(value: number) {
	return Math.min(MAX_MASTERY, Math.max(MIN_MASTERY, Math.round(value)));
}

export function getMasteryLevel(mastery: number): MasteryLevel {
	const normalized = clampMastery(mastery);
	if (normalized <= 3) return "unfamiliar";
	if (normalized <= 8) return "familiar";
	return "mastered";
}

export function applyMasteryChange(mastery: number, delta: -1 | 1 | 3) {
	return clampMastery(mastery + delta);
}

export function getReviewPriority(
	progress: VocabularyProgressRecord | undefined,
	now = Date.now(),
) {
	const mastery = clampMastery(progress?.mastery ?? 0);
	const lastReviewedTime = progress?.lastReviewedAt
		? Date.parse(progress.lastReviewedAt)
		: Number.NaN;
	const daysSinceReview = Number.isFinite(lastReviewedTime)
		? Math.max(0, (now - lastReviewedTime) / 86_400_000)
		: 90;
	const unfamiliarityWeight = MAX_MASTERY + 1 - mastery;
	const recencyWeight = 1 + Math.min(daysSinceReview, 90) / 15;
	return unfamiliarityWeight * recencyWeight;
}

export function weightedSampleWithoutReplacement<T>(
	items: T[],
	count: number,
	getWeight: (item: T) => number,
	random = Math.random,
) {
	const pool = [...items];
	const selected: T[] = [];
	while (pool.length > 0 && selected.length < count) {
		const weights = pool.map((item) => Math.max(0.0001, getWeight(item)));
		const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
		let cursor = random() * totalWeight;
		let selectedIndex = weights.length - 1;
		for (let index = 0; index < weights.length; index += 1) {
			cursor -= weights[index];
			if (cursor < 0) {
				selectedIndex = index;
				break;
			}
		}
		selected.push(pool[selectedIndex]);
		pool.splice(selectedIndex, 1);
	}
	return selected;
}
