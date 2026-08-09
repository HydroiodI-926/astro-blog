<script lang="ts">
import { onMount } from "svelte";
import {
	getShanghaiDateKey,
	readVocabularyReviewActivity,
	VOCABULARY_REVIEW_EVENT,
	VOCABULARY_REVIEW_STORAGE_KEY,
	type VocabularyReviewActivity,
} from "@/utils/vocabulary-review-activity";

interface VocabularyUploadBatch {
	id: string;
	title: string;
	uploadedAt: string;
	entryCount: number;
}

interface Props {
	batches: VocabularyUploadBatch[];
}

interface HeatmapCell {
	dateKey: string;
	label: string;
	batchCount: number;
	wordCount: number;
	reviewRoundCount: number;
	reviewWordCount: number;
	level: number;
	isFuture: boolean;
}

const { batches }: Props = $props();
let reviewActivity = $state<VocabularyReviewActivity>({});

function addUtcDays(date: Date, days: number) {
	const result = new Date(date);
	result.setUTCDate(result.getUTCDate() + days);
	return result;
}

function getHeatLevel(wordCount: number) {
	if (wordCount === 0) return 0;
	if (wordCount <= 40) return 1;
	if (wordCount <= 80) return 2;
	if (wordCount <= 120) return 3;
	return 4;
}

const uploadStatsByDate = $derived.by(() => {
	const stats = new Map<string, { batchCount: number; wordCount: number }>();
	for (const batch of batches) {
		const dateKey = getShanghaiDateKey(batch.uploadedAt);
		const current = stats.get(dateKey) ?? { batchCount: 0, wordCount: 0 };
		stats.set(dateKey, {
			batchCount: current.batchCount + 1,
			wordCount: current.wordCount + batch.entryCount,
		});
	}
	return stats;
});

const heatmapCells = $derived.by(() => {
	const todayKey = getShanghaiDateKey();
	const [year, month] = todayKey.split("-").map(Number);
	const firstDay = new Date(Date.UTC(year, month - 1, 1));
	const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
	const leadingEmptyCount = (firstDay.getUTCDay() + 6) % 7;
	const result: Array<HeatmapCell | null> = Array.from(
		{ length: leadingEmptyCount },
		() => null,
	);

	for (let day = 1; day <= daysInMonth; day += 1) {
		const date = addUtcDays(firstDay, day - 1);
		const dateKey = date.toISOString().slice(0, 10);
		const stats = uploadStatsByDate.get(dateKey) ?? {
			batchCount: 0,
			wordCount: 0,
		};
		const review = reviewActivity[dateKey] ?? {
			roundCount: 0,
			wordCount: 0,
		};
		const [, displayMonth, displayDay] = dateKey.split("-");
		result.push({
			dateKey,
			label: `${Number(displayMonth)}月${Number(displayDay)}日`,
			batchCount: stats.batchCount,
			wordCount: stats.wordCount,
			reviewRoundCount: review.roundCount,
			reviewWordCount: review.wordCount,
			level: getHeatLevel(stats.wordCount + review.wordCount),
			isFuture: dateKey > todayKey,
		});
	}
	while (result.length % 7 !== 0) result.push(null);

	return result;
});

const monthLabel = $derived.by(() => {
	const [year, month] = getShanghaiDateKey().split("-");
	return `${year}年${Number(month)}月`;
});

const monthTotals = $derived.by(() => {
	let batchCount = 0;
	let uploadWordCount = 0;
	let reviewRoundCount = 0;
	let reviewWordCount = 0;
	for (const cell of heatmapCells) {
		if (!cell) continue;
		batchCount += cell.batchCount;
		uploadWordCount += cell.wordCount;
		reviewRoundCount += cell.reviewRoundCount;
		reviewWordCount += cell.reviewWordCount;
	}
	return { batchCount, uploadWordCount, reviewRoundCount, reviewWordCount };
});

function getCellTitle(cell: HeatmapCell) {
	const activityParts: string[] = [];
	if (cell.batchCount > 0) {
		activityParts.push(
			`上传 ${cell.batchCount} 份词表，${cell.wordCount} 个单词`,
		);
	}
	if (cell.reviewRoundCount > 0) {
		activityParts.push(
			`复习 ${cell.reviewRoundCount} 轮，抽背 ${cell.reviewWordCount} 词次`,
		);
	}
	return `${cell.label}：${activityParts.join("；") || "没有学习记录"}`;
}

onMount(() => {
	const syncReviewActivity = () => {
		reviewActivity = readVocabularyReviewActivity();
	};
	const syncReviewActivityFromStorage = (event: StorageEvent) => {
		if (event.key === VOCABULARY_REVIEW_STORAGE_KEY) syncReviewActivity();
	};
	syncReviewActivity();
	window.addEventListener(VOCABULARY_REVIEW_EVENT, syncReviewActivity);
	window.addEventListener("storage", syncReviewActivityFromStorage);

	return () => {
		window.removeEventListener(VOCABULARY_REVIEW_EVENT, syncReviewActivity);
		window.removeEventListener("storage", syncReviewActivityFromStorage);
	};
});
</script>

<section class="vocabulary-heatmap" aria-labelledby="vocabulary-heatmap-title">
	<header class="heatmap-heading">
		<div>
			<h3 id="vocabulary-heatmap-title">背单词热度</h3>
			<p>{monthLabel} · 上传 + 本机抽背</p>
		</div>
		<a href="/english/" aria-label="打开英语单词清单">
			上传 {monthTotals.uploadWordCount} · 抽背 {monthTotals.reviewWordCount}
		</a>
	</header>

	<div
		class="heatmap-chart"
		role="img"
		aria-label={`${monthLabel}词汇活动；上传 ${monthTotals.batchCount} 份词表、${monthTotals.uploadWordCount} 个单词，当前浏览器复习 ${monthTotals.reviewRoundCount} 轮、抽背 ${monthTotals.reviewWordCount} 词次`}
	>
		<div class="weekday-labels" aria-hidden="true">
			<span>一</span><span>二</span><span>三</span><span>四</span><span>五</span><span>六</span><span>日</span>
		</div>
		<div class="heatmap-grid" aria-hidden="true">
			{#each heatmapCells as cell, index (cell?.dateKey ?? `empty-${index}`)}
				{#if cell}
					<span
						class="heatmap-cell"
						class:future={cell.isFuture}
						data-level={cell.level}
						title={getCellTitle(cell)}
					></span>
				{:else}
					<span class="heatmap-placeholder"></span>
				{/if}
			{/each}
		</div>
	</div>

	<footer class="heatmap-legend" aria-label="热度图例">
		<span>少</span>
		{#each [0, 1, 2, 3, 4] as level}
			<i data-level={level}></i>
		{/each}
		<span>多</span>
	</footer>
</section>

<style>
	.vocabulary-heatmap {
		display: grid;
		gap: 0.75rem;
		margin-top: 1rem;
		padding-top: 0.9rem;
		border-top: 1px solid var(--line-divider);
	}

	.heatmap-heading {
		display: flex;
		align-items: flex-end;
		justify-content: space-between;
		gap: 0.75rem;
	}

	.heatmap-heading h3,
	.heatmap-heading p {
		margin: 0;
	}

	.heatmap-heading h3 {
		font-size: 0.9rem;
		font-weight: 700;
		color: var(--btn-content);
	}

	.heatmap-heading p {
		margin-top: 0.15rem;
		font-size: 0.64rem;
		color: color-mix(in oklch, currentColor 45%, transparent);
	}

	.heatmap-heading a {
		font-size: 0.68rem;
		font-weight: 700;
		color: var(--primary);
		text-decoration: none;
		white-space: nowrap;
	}

	.heatmap-chart {
		display: grid;
		gap: 0.3rem;
	}

	.weekday-labels,
	.heatmap-grid {
		display: grid;
		grid-template-columns: repeat(7, 0.9rem);
		justify-content: space-between;
		gap: 0.25rem;
	}

	.weekday-labels {
		font-size: 0.5rem;
		line-height: 1;
		color: color-mix(in oklch, currentColor 38%, transparent);
	}

	.weekday-labels span {
		display: grid;
		place-items: center;
	}

	.heatmap-grid {
		grid-auto-rows: 0.9rem;
	}

	.heatmap-cell,
	.heatmap-placeholder,
	.heatmap-legend i {
		aspect-ratio: 1;
		border-radius: 0.14rem;
		background: color-mix(in oklch, currentColor 7%, transparent);
	}

	.heatmap-cell[data-level="1"],
	.heatmap-legend i[data-level="1"] {
		background: color-mix(in oklch, var(--primary) 24%, transparent);
	}

	.heatmap-cell[data-level="2"],
	.heatmap-legend i[data-level="2"] {
		background: color-mix(in oklch, var(--primary) 44%, transparent);
	}

	.heatmap-cell[data-level="3"],
	.heatmap-legend i[data-level="3"] {
		background: color-mix(in oklch, var(--primary) 68%, transparent);
	}

	.heatmap-cell[data-level="4"],
	.heatmap-legend i[data-level="4"] {
		background: var(--primary);
	}

	.heatmap-cell.future {
		opacity: 0.3;
	}

	.heatmap-placeholder {
		background: transparent;
	}

	.heatmap-legend {
		display: flex;
		align-items: center;
		justify-content: flex-end;
		gap: 0.25rem;
		font-size: 0.58rem;
		color: color-mix(in oklch, currentColor 42%, transparent);
	}

	.heatmap-legend i {
		width: 0.55rem;
		height: 0.55rem;
	}
</style>
