<script lang="ts">
import type { CalendarPost } from "../types/calendar";

interface Props {
	posts: CalendarPost[];
}

interface HeatmapCell {
	dateKey: string;
	label: string;
	publishedCount: number;
	updatedCount: number;
	level: number;
	isFuture: boolean;
}

const { posts }: Props = $props();

function addUtcDays(date: Date, days: number) {
	const result = new Date(date);
	result.setUTCDate(result.getUTCDate() + days);
	return result;
}

function getShanghaiDateKey() {
	return new Intl.DateTimeFormat("en-CA", {
		timeZone: "Asia/Shanghai",
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
	}).format(new Date());
}

function getHeatLevel(activityCount: number) {
	if (activityCount === 0) return 0;
	if (activityCount === 1) return 1;
	if (activityCount === 2) return 2;
	if (activityCount === 3) return 3;
	return 4;
}

const activityStatsByDate = $derived.by(() => {
	const stats = new Map<
		string,
		{ publishedCount: number; updatedCount: number }
	>();
	for (const post of posts) {
		const publishedStats = stats.get(post.date) ?? {
			publishedCount: 0,
			updatedCount: 0,
		};
		publishedStats.publishedCount += 1;
		stats.set(post.date, publishedStats);

		if (post.updated) {
			const updatedStats = stats.get(post.updated) ?? {
				publishedCount: 0,
				updatedCount: 0,
			};
			updatedStats.updatedCount += 1;
			stats.set(post.updated, updatedStats);
		}
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
		const stats = activityStatsByDate.get(dateKey) ?? {
			publishedCount: 0,
			updatedCount: 0,
		};
		const [, displayMonth, displayDay] = dateKey.split("-");
		result.push({
			dateKey,
			label: `${Number(displayMonth)}月${Number(displayDay)}日`,
			publishedCount: stats.publishedCount,
			updatedCount: stats.updatedCount,
			level: getHeatLevel(stats.publishedCount + stats.updatedCount),
			isFuture: dateKey > todayKey,
		});
	}
	while (result.length % 7 !== 0) result.push(null);

	return result;
});

const monthLabel = $derived.by(() => {
	const todayKey = getShanghaiDateKey();
	const [year, month] = todayKey.split("-");
	return `${year}年${Number(month)}月`;
});

const monthTotals = $derived.by(() => {
	let publishedCount = 0;
	let updatedCount = 0;
	for (const cell of heatmapCells) {
		if (!cell) continue;
		publishedCount += cell.publishedCount;
		updatedCount += cell.updatedCount;
	}
	return { publishedCount, updatedCount };
});

function getCellTitle(cell: HeatmapCell) {
	const activityParts: string[] = [];
	if (cell.publishedCount > 0) {
		activityParts.push(`发布 ${cell.publishedCount} 篇文章`);
	}
	if (cell.updatedCount > 0) {
		activityParts.push(`更新 ${cell.updatedCount} 篇文章`);
	}
	return `${cell.label}：${activityParts.join("；") || "没有文章活动"}`;
}
</script>

<section class="article-heatmap" aria-labelledby="article-heatmap-title">
	<header class="heatmap-heading">
		<div>
			<h3 id="article-heatmap-title">文章更新热度</h3>
			<p>{monthLabel} · 发布 + 最新修改</p>
		</div>
		<a href="/" aria-label="打开文章列表">
			发布 {monthTotals.publishedCount} · 更新 {monthTotals.updatedCount}
		</a>
	</header>

	<div
		class="heatmap-chart"
		role="img"
		aria-label={`${monthLabel}文章活动；发布 ${monthTotals.publishedCount} 篇，更新 ${monthTotals.updatedCount} 篇`}
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
	.article-heatmap {
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
