<script lang="ts">
import Icon from "@iconify/svelte";
import { onMount } from "svelte";
import { recordVocabularyReview } from "@/utils/vocabulary-review-activity";
import type {
	LearningStatus,
	VocabularyEntry,
	VocabularyRelationLink,
	VocabularyTrackerProps,
} from "./types";

const STORAGE_KEY = "english-vocabulary-progress:v1";
const statuses: Array<{
	value: LearningStatus;
	label: string;
	shortLabel: string;
}> = [
	{ value: "new", label: "未学习", shortLabel: "未学" },
	{ value: "learning", label: "学习中", shortLabel: "学习中" },
	{ value: "mastered", label: "已掌握", shortLabel: "掌握" },
];

let { entries, batches, meta, relationData }: VocabularyTrackerProps = $props();
let progress = $state<Record<string, LearningStatus>>({});
let query = $state("");
let statusFilter = $state<"all" | LearningStatus>("all");
let batchFilter = $state<"all" | string>("all");
let pageFilter = $state<"all" | number>("all");
let storageReady = $state(false);
let viewMode = $state<"list" | "review">("list");
let reviewCount = $state(10);
let reviewEntryIds = $state<string[]>([]);
let revealedMeanings = $state<Record<string, boolean>>({});
let selectedEntry = $state<VocabularyEntry | null>(null);
let detailDialog = $state<HTMLDialogElement>();

const selectedRelations = $derived(
	selectedEntry
		? relationData.words[selectedEntry.word.trim().toLocaleLowerCase()]
		: undefined,
);

const wordOccurrences = $derived.by(() => {
	const counts = new Map<string, number>();
	for (const entry of entries) {
		const wordKey = entry.word.trim().toLocaleLowerCase();
		counts.set(wordKey, (counts.get(wordKey) ?? 0) + 1);
	}
	return counts;
});

const duplicateSummary = $derived.by(() => {
	const duplicateCounts = [...wordOccurrences.values()].filter(
		(count) => count > 1,
	);
	return {
		wordCount: duplicateCounts.length,
		extraEntryCount: duplicateCounts.reduce(
			(total, count) => total + count - 1,
			0,
		),
	};
});

const summary = $derived.by(() => {
	let learning = 0;
	let mastered = 0;
	for (const entry of entries) {
		const status = progress[entry.id] ?? "new";
		if (status === "learning") learning += 1;
		if (status === "mastered") mastered += 1;
	}
	return {
		learning,
		mastered,
		completion: entries.length
			? Math.round((mastered / entries.length) * 100)
			: 0,
	};
});

const filteredEntries = $derived.by(() => {
	const normalizedQuery = query.trim().toLocaleLowerCase();
	return entries.filter((entry) => {
		const status = progress[entry.id] ?? "new";
		const matchesQuery =
			!normalizedQuery ||
			entry.word.toLocaleLowerCase().includes(normalizedQuery) ||
			entry.meaning.toLocaleLowerCase().includes(normalizedQuery);
		const matchesStatus = statusFilter === "all" || status === statusFilter;
		const matchesBatch = batchFilter === "all" || entry.batchId === batchFilter;
		const matchesPage = pageFilter === "all" || entry.page === pageFilter;
		return matchesQuery && matchesStatus && matchesBatch && matchesPage;
	});
});

const pageNumbers = $derived(
	Array.from(
		new Set(
			entries
				.filter(
					(entry) => batchFilter === "all" || entry.batchId === batchFilter,
				)
				.map((entry) => entry.page),
		),
	),
);

const groupedEntries = $derived(
	batches
		.map((batch) => ({
			batch,
			entries: filteredEntries.filter((entry) => entry.batchId === batch.id),
		}))
		.filter((group) => group.entries.length > 0),
);

const reviewCandidates = $derived.by(() => {
	const seenWords = new Set<string>();
	return filteredEntries.filter((entry) => {
		const wordKey = entry.word.trim().toLocaleLowerCase();
		if (seenWords.has(wordKey)) return false;
		seenWords.add(wordKey);
		return true;
	});
});

const reviewScopeSignature = $derived(
	`${query}\u0000${statusFilter}\u0000${batchFilter}\u0000${pageFilter}`,
);

const reviewEntries = $derived(
	reviewEntryIds.flatMap((id): VocabularyEntry[] => {
		const entry = entries.find((candidate) => candidate.id === id);
		return entry ? [entry] : [];
	}),
);

const revealedCount = $derived(
	reviewEntries.filter((entry) => revealedMeanings[entry.id]).length,
);

$effect(() => {
	if (pageFilter !== "all" && !pageNumbers.includes(pageFilter)) {
		pageFilter = "all";
	}
});

$effect(() => {
	reviewScopeSignature;
	reviewEntryIds = [];
	revealedMeanings = {};
});

onMount(() => {
	try {
		const saved = window.localStorage.getItem(STORAGE_KEY);
		if (saved) {
			const parsed = JSON.parse(saved) as Record<string, unknown>;
			const restored: Record<string, LearningStatus> = {};
			for (const [savedId, savedStatus] of Object.entries(parsed)) {
				if (
					savedStatus !== "new" &&
					savedStatus !== "learning" &&
					savedStatus !== "mastered"
				) {
					continue;
				}
				const exactEntry = entries.find((entry) => entry.id === savedId);
				const legacyEntry = entries.find((entry) =>
					entry.id.endsWith(`:${savedId}`),
				);
				const targetEntry = exactEntry ?? legacyEntry;
				if (targetEntry) restored[targetEntry.id] = savedStatus;
			}
			progress = restored;
			window.localStorage.setItem(STORAGE_KEY, JSON.stringify(restored));
		}
	} catch (error) {
		console.warn("Failed to restore vocabulary progress", error);
	} finally {
		storageReady = true;
	}
});

function setStatus(id: string, status: LearningStatus) {
	progress = { ...progress, [id]: status };
	try {
		window.localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
	} catch (error) {
		console.warn("Failed to save vocabulary progress", error);
	}
}

function clearFilters() {
	query = "";
	statusFilter = "all";
	batchFilter = "all";
	pageFilter = "all";
}

function drawReviewWords() {
	const candidates = [...reviewCandidates];
	for (let index = candidates.length - 1; index > 0; index -= 1) {
		const randomIndex = Math.floor(Math.random() * (index + 1));
		[candidates[index], candidates[randomIndex]] = [
			candidates[randomIndex],
			candidates[index],
		];
	}
	const drawnEntryIds = candidates
		.slice(0, Math.min(reviewCount, candidates.length))
		.map((entry) => entry.id);
	reviewEntryIds = drawnEntryIds;
	revealedMeanings = {};
	recordVocabularyReview(drawnEntryIds.length);
}

function toggleMeaning(id: string) {
	revealedMeanings = {
		...revealedMeanings,
		[id]: !revealedMeanings[id],
	};
}

function setAllMeanings(revealed: boolean) {
	revealedMeanings = Object.fromEntries(
		reviewEntries.map((entry) => [entry.id, revealed]),
	);
}

function openEntryDetails(entry: VocabularyEntry) {
	selectedEntry = entry;
	detailDialog?.showModal();
}

function openRelatedWord(relation: VocabularyRelationLink) {
	if (!relation.inLibrary) return;
	const relatedEntry = relation.entryIds
		.map((entryId) => entries.find((entry) => entry.id === entryId))
		.find((entry): entry is VocabularyEntry => Boolean(entry));
	if (relatedEntry) selectedEntry = relatedEntry;
}

function closeEntryDetails() {
	detailDialog?.close();
}

function closeDetailsFromBackdrop(event: MouseEvent) {
	if (event.target === event.currentTarget) closeEntryDetails();
}

function closeDetailsFromKeyboard(event: KeyboardEvent) {
	if (event.key !== "Escape") return;
	event.preventDefault();
	closeEntryDetails();
}

function setSelectedEntryStatus(status: LearningStatus) {
	if (selectedEntry) setStatus(selectedEntry.id, status);
}

function getWordOccurrenceCount(word: string) {
	return wordOccurrences.get(word.trim().toLocaleLowerCase()) ?? 1;
}

function formatUploadTime(uploadedAt: string) {
	return new Intl.DateTimeFormat("zh-CN", {
		timeZone: "Asia/Shanghai",
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
		hour12: false,
	}).format(new Date(uploadedAt));
}
</script>

<section class="tracker" aria-label="单词学习进度">
	<div class="summary-grid">
		<div class="summary-card">
			<span class="summary-icon total"><Icon icon="material-symbols:dictionary-outline" /></span>
			<div>
				<strong>{entries.length}</strong>
				<span>词表总数</span>
			</div>
		</div>
		<div class="summary-card">
			<span class="summary-icon learning"><Icon icon="material-symbols:local-fire-department-outline" /></span>
			<div>
				<strong>{summary.learning}</strong>
				<span>正在学习</span>
			</div>
		</div>
		<div class="summary-card">
			<span class="summary-icon mastered"><Icon icon="material-symbols:verified-outline" /></span>
			<div>
				<strong>{summary.mastered}</strong>
				<span>已经掌握</span>
			</div>
		</div>
		<div class="summary-card progress-card">
			<div class="progress-heading">
				<span>掌握进度</span>
				<strong>{summary.completion}%</strong>
			</div>
			<div
				class="progress-track"
				role="progressbar"
				aria-label="单词掌握进度"
				aria-valuenow={summary.completion}
				aria-valuemin="0"
				aria-valuemax="100"
			>
				<span style={`width: ${summary.completion}%`}></span>
			</div>
		</div>
	</div>

	<div class="source-note">
		<Icon icon="material-symbols:info-outline-rounded" />
		<p>
			已导入 {meta.batchCount} 个词表批次，共 {meta.entryCount} 条记录；其中
			{meta.sourceTruncatedCount} 条释义在原 PDF 中以省略号结尾。
			{#if duplicateSummary.wordCount > 0}
				检测到 {duplicateSummary.wordCount} 个重复单词（额外 {duplicateSummary.extraEntryCount} 条记录）。
			{/if}
			学习状态仅保存在当前浏览器，不会上传。
		</p>
		<span class:ready={storageReady}>{storageReady ? "已读取本机进度" : "正在读取进度"}</span>
	</div>

	<div class="view-switcher" aria-label="学习模式">
		<button
			type="button"
			class:active={viewMode === "list"}
			aria-pressed={viewMode === "list"}
			onclick={() => (viewMode = "list")}
		>
			<Icon icon="material-symbols:format-list-bulleted-rounded" />
			单词清单
		</button>
		<button
			type="button"
			class:active={viewMode === "review"}
			aria-pressed={viewMode === "review"}
			onclick={() => (viewMode = "review")}
		>
			<Icon icon="material-symbols:style-outline-rounded" />
			抽词复习
		</button>
	</div>

	<div class="toolbar">
		<label class="search-box">
			<span class="sr-only">搜索单词或释义</span>
			<Icon icon="material-symbols:search-rounded" />
			<input bind:value={query} type="search" placeholder="搜索单词或中文释义" />
		</label>

		<label class="select-box batch-select">
			<span>上传批次</span>
			<select bind:value={batchFilter} aria-label="按上传时间筛选">
				<option value="all">全部批次</option>
				{#each batches as batch}
					<option value={batch.id}>{formatUploadTime(batch.uploadedAt)}</option>
				{/each}
			</select>
		</label>

		<label class="select-box">
			<span>状态</span>
			<select bind:value={statusFilter} aria-label="按学习状态筛选">
				<option value="all">全部状态</option>
				{#each statuses as status}
					<option value={status.value}>{status.label}</option>
				{/each}
			</select>
		</label>

		<div class="page-filter" aria-label="按 PDF 页码筛选">
			<button class:active={pageFilter === "all"} type="button" onclick={() => (pageFilter = "all")}>全部</button>
			{#each pageNumbers as page}
				<button class:active={pageFilter === page} type="button" onclick={() => (pageFilter = page)}>第 {page} 页</button>
			{/each}
		</div>
	</div>

	{#if viewMode === "list"}
		<div class="result-heading">
			<h2>单词清单</h2>
			<span>显示 {filteredEntries.length} / {entries.length} 条</span>
		</div>

		{#if filteredEntries.length}
			<div class="batch-list">
				{#each groupedEntries as group (group.batch.id)}
					<section class="batch-group" aria-labelledby={`batch-${group.batch.id}`}>
						<header class="batch-heading">
							<div class="batch-timeline" aria-hidden="true">
								<Icon icon="material-symbols:upload-file-outline-rounded" />
							</div>
							<div class="batch-title">
								<h3 id={`batch-${group.batch.id}`}>{formatUploadTime(group.batch.uploadedAt)}</h3>
								<p>{group.batch.sourceFile}</p>
							</div>
							<span class="batch-count">本批显示 {group.entries.length} / {group.batch.entryCount} 条</span>
						</header>

						<div class="word-list">
							{#each group.entries as entry (entry.id)}
								{@const currentStatus = progress[entry.id] ?? "new"}
								{@const occurrenceCount = getWordOccurrenceCount(entry.word)}
								<article class:mastered={currentStatus === "mastered"} class="word-item">
									<button
										type="button"
										class="word-open"
										aria-label={`查看 ${entry.word} 的详细释义`}
										onclick={() => openEntryDetails(entry)}
									>
										<div class="word-number" title={`PDF 第 ${entry.page} 页，第 ${entry.number} 号`}>
											<span>{entry.number}</span>
											<small>P{entry.page}</small>
										</div>
										<div class="word-main">
											<div class="word-title">
												<h4>{entry.word}</h4>
											{#if entry.sourceTruncated}
												<span class="source-badge" title="该释义在原 PDF 中已经被省略">原表已省略</span>
											{/if}
											{#if occurrenceCount > 1}
												<span class="duplicate-badge" title={`词库中共出现 ${occurrenceCount} 次`}>重复 ×{occurrenceCount}</span>
											{/if}
											</div>
											<p class="phonetic">英 /{entry.phonetic}/</p>
											<p class="meaning">{entry.meaning}</p>
										</div>
										<Icon icon="material-symbols:chevron-right-rounded" />
									</button>
									<div class="status-control" aria-label={`${entry.word} 的学习状态`}>
										{#each statuses as status}
											<button
												type="button"
												class:active={currentStatus === status.value}
												class={`status-${status.value}`}
												aria-pressed={currentStatus === status.value}
												title={status.label}
												onclick={() => setStatus(entry.id, status.value)}
											>
												{status.shortLabel}
											</button>
										{/each}
									</div>
								</article>
							{/each}
						</div>
					</section>
				{/each}
			</div>
		{:else}
			<div class="empty-state">
				<Icon icon="material-symbols:search-off-rounded" />
				<h3>没有找到匹配的单词</h3>
				<p>试试清空关键词或切换筛选条件。</p>
				<button type="button" onclick={clearFilters}>清空筛选</button>
			</div>
		{/if}
	{:else}
		<section class="review-panel" aria-labelledby="review-title">
			<header class="review-heading">
				<div>
					<span class="review-eyebrow">主动回忆</span>
					<h2 id="review-title">抽词复习</h2>
					<p>先根据英文回忆含义，再揭晓中文释义核对。</p>
				</div>
				<div class="review-draw-controls">
					<label>
						<span>抽取数量</span>
						<select bind:value={reviewCount}>
							<option value={5}>5 个</option>
							<option value={10}>10 个</option>
							<option value={20}>20 个</option>
							<option value={30}>30 个</option>
						</select>
					</label>
					<button
						type="button"
						class="primary-action"
						disabled={!reviewCandidates.length}
						onclick={drawReviewWords}
					>
						<Icon icon="material-symbols:shuffle-rounded" />
						{reviewEntries.length ? "重新抽取" : "开始抽取"}
					</button>
				</div>
			</header>

			<div class="review-scope">
				<Icon icon="material-symbols:filter-alt-outline-rounded" />
				当前筛选范围有 {reviewCandidates.length} 个不同单词；每轮不会重复抽到相同拼写。
			</div>

			{#if reviewEntries.length}
				<div class="round-toolbar">
					<span aria-live="polite">已揭晓 {revealedCount} / {reviewEntries.length}</span>
					<div>
						<button type="button" onclick={() => setAllMeanings(true)}>全部显示</button>
						<button type="button" onclick={() => setAllMeanings(false)}>全部隐藏</button>
					</div>
				</div>

				<div class="review-grid">
					{#each reviewEntries as entry, index (entry.id)}
						<article class:revealed={revealedMeanings[entry.id]} class="review-card">
							<div class="review-card-meta">
								<span>#{index + 1}</span>
								<small>P{entry.page} · No.{entry.number}</small>
							</div>
							<h3>{entry.word}</h3>
							<p class="phonetic">英 /{entry.phonetic}/</p>

							{#if revealedMeanings[entry.id]}
								<div class="review-meaning" aria-live="polite">
									<span>中文释义</span>
									<p>{entry.meaning}</p>
								</div>
							{:else}
								<div class="meaning-placeholder">
									<Icon icon="material-symbols:visibility-off-outline-rounded" />
									<span>先在脑中回忆，再揭晓答案</span>
								</div>
							{/if}

							<button
								type="button"
								class="reveal-action"
								aria-expanded={Boolean(revealedMeanings[entry.id])}
								onclick={() => toggleMeaning(entry.id)}
							>
								<Icon icon={revealedMeanings[entry.id] ? "material-symbols:visibility-off-outline-rounded" : "material-symbols:visibility-outline-rounded"} />
								{revealedMeanings[entry.id] ? "隐藏释义" : "显示释义"}
							</button>
						</article>
					{/each}
				</div>
			{:else if reviewCandidates.length}
				<div class="empty-state review-empty">
					<Icon icon="material-symbols:style-outline-rounded" />
					<h3>准备好开始本轮复习</h3>
					<p>从当前筛选范围随机抽词，释义会默认隐藏。</p>
					<button type="button" onclick={drawReviewWords}>开始抽取</button>
				</div>
			{:else}
				<div class="empty-state">
					<Icon icon="material-symbols:search-off-rounded" />
					<h3>当前范围没有可抽取的单词</h3>
					<p>清空筛选后再开始一轮复习。</p>
					<button type="button" onclick={clearFilters}>清空筛选</button>
				</div>
			{/if}
		</section>
	{/if}

	<dialog
		bind:this={detailDialog}
		class="word-detail-dialog"
		aria-labelledby="word-detail-title"
		onclick={closeDetailsFromBackdrop}
		onkeydown={closeDetailsFromKeyboard}
		onclose={() => (selectedEntry = null)}
	>
		{#if selectedEntry}
			{@const detailStatus = progress[selectedEntry.id] ?? "new"}
			{@const detailBatch = batches.find((batch) => batch.id === selectedEntry?.batchId)}
			<div class="detail-surface">
				<header class="detail-header">
					<div>
						<span class="detail-eyebrow">单词详情</span>
						<h2 id="word-detail-title">{selectedEntry.word}</h2>
						<p>英 /{selectedEntry.phonetic}/</p>
					</div>
					<button type="button" class="detail-close" aria-label="关闭单词详情" onclick={closeEntryDetails}>
						<Icon icon="material-symbols:close-rounded" />
					</button>
				</header>

				<div class="detail-meta">
					{#if detailBatch}
						<span><Icon icon="material-symbols:calendar-month-outline-rounded" /> {formatUploadTime(detailBatch.uploadedAt)}</span>
					{/if}
					<span><Icon icon="material-symbols:description-outline-rounded" /> PDF 第 {selectedEntry.page} 页 · 第 {selectedEntry.number} 号</span>
				</div>

				<section class="detail-meaning" aria-labelledby="detail-meaning-title">
					<h3 id="detail-meaning-title">词表释义</h3>
					<p>{selectedEntry.meaning}</p>
				</section>

				{#if selectedEntry.sourceTruncated}
					<div class="detail-warning">
						<Icon icon="material-symbols:warning-outline-rounded" />
						<p><strong>原词表释义不完整</strong><span>这条内容在 PDF 中已经以省略号结尾，详情页不会猜测缺失部分。</span></p>
					</div>
				{/if}

				<section class="relation-panel" aria-labelledby="relation-panel-title">
					<div class="relation-heading">
						<div>
							<span class="detail-eyebrow">词汇网络</span>
							<h3 id="relation-panel-title">从这个词继续联想</h3>
						</div>
						<span class="relation-source">OEWN · Wiktextract</span>
					</div>

					{#if selectedRelations}
						{#if selectedRelations.roots.length > 0 || selectedRelations.etymology}
							<details class="relation-group">
								<summary>
									<span><Icon icon="material-symbols:account-tree-outline-rounded" />词源线索</span>
									<span class="relation-count">{selectedRelations.roots.length || 1}</span>
								</summary>
								<div class="relation-content etymology-content">
									{#if selectedRelations.roots.length > 0}
										<div class="root-list" aria-label="词源根">
											{#each selectedRelations.roots as root}
												<code>{root}</code>
											{/each}
										</div>
									{/if}
									{#if selectedRelations.etymology}
										<p lang="en">{selectedRelations.etymology}</p>
									{/if}
								</div>
							</details>
						{/if}

						<details class="relation-group" open>
							<summary>
								<span><Icon icon="material-symbols:family-history-rounded" />词族与派生</span>
								<span class="relation-count">{selectedRelations.family.length}</span>
							</summary>
							<div class="relation-content">
								{#if selectedRelations.family.length > 0}
									<div class="relation-chips">
										{#each selectedRelations.family.slice(0, 16) as relation}
											{#if relation.inLibrary}
												<button
													type="button"
													class="relation-chip in-library"
													aria-label={`查看词库单词 ${relation.word} 的详情`}
													onclick={() => openRelatedWord(relation)}
												>
													<strong>{relation.word}</strong><span>{relation.relation} · 词库内</span>
												</button>
											{:else}
												<span class="relation-chip"><strong>{relation.word}</strong><span>{relation.relation}</span></span>
											{/if}
										{/each}
									</div>
								{:else}
									<p class="relation-empty">当前数据源暂未找到可靠的词族关系。</p>
								{/if}
							</div>
						</details>

						<details class="relation-group" open>
							<summary>
								<span><Icon icon="material-symbols:hub-outline-rounded" />同根词</span>
								<span class="relation-count">{selectedRelations.sameRoot.length}</span>
							</summary>
							<div class="relation-content">
								{#if selectedRelations.sameRoot.length > 0}
									<p class="relation-note">只展示当前词库中共享明确词源根的单词。</p>
									<div class="relation-chips">
										{#each selectedRelations.sameRoot as relation}
											<button
												type="button"
												class="relation-chip in-library"
												aria-label={`查看同根词 ${relation.word} 的详情`}
												onclick={() => openRelatedWord(relation)}
											>
												<strong>{relation.word}</strong><span>{relation.sharedRoots.join(" · ")}</span>
											</button>
										{/each}
									</div>
								{:else}
									<p class="relation-empty">当前词库里还没有可确认的同根词。</p>
								{/if}
							</div>
						</details>

						<details class="relation-group" open>
							<summary>
								<span><Icon icon="material-symbols:compare-arrows-rounded" />同义词与近义词</span>
								<span class="relation-count">{selectedRelations.synonymGroups.length}</span>
							</summary>
							<div class="relation-content synonym-list">
								{#if selectedRelations.synonymGroups.length > 0}
									{#each selectedRelations.synonymGroups.slice(0, 8) as group}
										<div class="synonym-sense">
											<div class="sense-heading"><span>{group.partOfSpeech}</span><p lang="en">{group.definition}</p></div>
											<div class="relation-chips compact">
												{#each group.words.slice(0, 8) as relation}
													{#if relation.inLibrary}
														<button
															type="button"
															class="relation-chip in-library"
															aria-label={`查看同义词 ${relation.word} 的详情`}
															onclick={() => openRelatedWord(relation)}
														>
															<strong>{relation.word}</strong><span>词库内</span>
														</button>
													{:else}
														<span class="relation-chip"><strong>{relation.word}</strong></span>
													{/if}
												{/each}
											</div>
										</div>
									{/each}
								{:else}
									<p class="relation-empty">Open English WordNet 暂未提供可用的同义词组。</p>
								{/if}
							</div>
						</details>
					{:else}
						<p class="relation-empty">这个单词尚未生成词汇关系数据。</p>
					{/if}
				</section>

				<footer class="detail-footer">
					<span>学习状态</span>
					<div class="status-control" aria-label={`${selectedEntry.word} 的详情学习状态`}>
						{#each statuses as status}
							<button
								type="button"
								class:active={detailStatus === status.value}
								class={`status-${status.value}`}
								aria-pressed={detailStatus === status.value}
								onclick={() => setSelectedEntryStatus(status.value)}
							>
								{status.label}
							</button>
						{/each}
					</div>
				</footer>
			</div>
		{/if}
	</dialog>
</section>

<style>
	.tracker {
		display: grid;
		gap: 1.5rem;
	}

	.summary-grid {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: 0.75rem;
	}

	.summary-card {
		min-height: 6.5rem;
		display: flex;
		align-items: center;
		gap: 0.85rem;
		padding: 1rem;
		border: 1px solid var(--line-divider);
		border-radius: 0.9rem;
		background: color-mix(in oklch, var(--card-bg) 82%, var(--primary) 18%);
	}

	.summary-icon {
		width: 2.75rem;
		height: 2.75rem;
		display: grid;
		place-items: center;
		flex: none;
		border-radius: 0.8rem;
		font-size: 1.5rem;
		color: var(--primary);
		background: color-mix(in oklch, var(--primary) 14%, transparent);
	}

	.summary-icon.learning {
		color: oklch(0.72 0.17 62);
		background: oklch(0.72 0.17 62 / 0.13);
	}

	.summary-icon.mastered {
		color: oklch(0.66 0.16 155);
		background: oklch(0.66 0.16 155 / 0.13);
	}

	.summary-card strong,
	.summary-card span {
		display: block;
	}

	.summary-card strong {
		font-size: 1.55rem;
		line-height: 1.1;
		color: color-mix(in oklch, currentColor 88%, transparent);
	}

	.summary-card div > span {
		margin-top: 0.3rem;
		font-size: 0.78rem;
		color: color-mix(in oklch, currentColor 52%, transparent);
	}

	.progress-card {
		display: block;
		padding-top: 1.25rem;
	}

	.progress-heading {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
	}

	.progress-heading strong {
		color: var(--primary);
	}

	.progress-track {
		height: 0.55rem;
		margin-top: 1rem;
		overflow: hidden;
		border-radius: 999px;
		background: color-mix(in oklch, currentColor 9%, transparent);
	}

	.progress-track span {
		height: 100%;
		min-width: 0;
		border-radius: inherit;
		background: linear-gradient(90deg, var(--primary), oklch(0.72 0.16 155));
		transition: width 240ms ease;
	}

	.source-note {
		display: grid;
		grid-template-columns: auto 1fr auto;
		align-items: center;
		gap: 0.65rem;
		padding: 0.85rem 1rem;
		border-radius: 0.8rem;
		color: color-mix(in oklch, currentColor 62%, transparent);
		background: var(--btn-regular-bg);
		font-size: 0.8rem;
	}

	.source-note > :global(svg) {
		font-size: 1.2rem;
		color: var(--primary);
	}

	.source-note p {
		margin: 0;
	}

	.source-note > span {
		white-space: nowrap;
	}

	.source-note > span::before {
		content: "";
		display: inline-block;
		width: 0.45rem;
		height: 0.45rem;
		margin-right: 0.35rem;
		border-radius: 50%;
		background: oklch(0.72 0.16 62);
	}

	.source-note > span.ready::before {
		background: oklch(0.66 0.16 155);
	}

	.view-switcher {
		display: inline-flex;
		width: fit-content;
		padding: 0.25rem;
		border-radius: 0.8rem;
		background: var(--btn-regular-bg);
	}

	.view-switcher button {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		padding: 0.62rem 0.9rem;
		border: 0;
		border-radius: 0.62rem;
		font: inherit;
		font-size: 0.82rem;
		color: color-mix(in oklch, currentColor 56%, transparent);
		background: transparent;
		cursor: pointer;
	}

	.view-switcher button.active {
		color: var(--btn-content);
		background: var(--card-bg);
		box-shadow: 0 1px 5px color-mix(in oklch, black 10%, transparent);
	}

	.view-switcher :global(svg) {
		font-size: 1.1rem;
	}

	.toolbar {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		flex-wrap: wrap;
	}

	.search-box {
		min-width: 15rem;
		min-height: 2.75rem;
		display: flex;
		align-items: center;
		gap: 0.6rem;
		flex: 1;
		padding: 0 0.85rem;
		border: 1px solid var(--line-divider);
		border-radius: 0.75rem;
		background: var(--card-bg);
		transition: border-color 150ms ease, box-shadow 150ms ease;
	}

	.search-box:focus-within {
		border-color: var(--primary);
		box-shadow: 0 0 0 3px color-mix(in oklch, var(--primary) 15%, transparent);
	}

	.search-box :global(svg) {
		font-size: 1.25rem;
		color: color-mix(in oklch, currentColor 42%, transparent);
	}

	.search-box input {
		width: 100%;
		padding: 0.65rem 0;
		border: 0;
		outline: 0;
		color: inherit;
		background: transparent;
	}

	.search-box input::placeholder {
		color: color-mix(in oklch, currentColor 38%, transparent);
	}

	.select-box {
		min-height: 2.75rem;
		display: flex;
		align-items: center;
		gap: 0.4rem;
		padding: 0 0.75rem;
		border: 1px solid var(--line-divider);
		border-radius: 0.75rem;
		font-size: 0.8rem;
		background: var(--card-bg);
	}

	.select-box > span {
		color: color-mix(in oklch, currentColor 45%, transparent);
	}

	.select-box select {
		padding: 0.55rem 0;
		border: 0;
		outline: 0;
		color: inherit;
		background: transparent;
	}

	.batch-select {
		min-width: 13.5rem;
	}

	.page-filter,
	.status-control {
		display: flex;
		padding: 0.2rem;
		border-radius: 0.7rem;
		background: var(--btn-regular-bg);
	}

	.page-filter button,
	.status-control button,
	.empty-state button {
		border: 0;
		font: inherit;
		color: color-mix(in oklch, currentColor 56%, transparent);
		background: transparent;
		cursor: pointer;
		transition: color 150ms ease, background 150ms ease, box-shadow 150ms ease;
	}

	.page-filter button {
		padding: 0.55rem 0.7rem;
		border-radius: 0.55rem;
		font-size: 0.75rem;
	}

	.page-filter button:hover,
	.page-filter button.active {
		color: var(--btn-content);
		background: var(--card-bg);
		box-shadow: 0 1px 4px color-mix(in oklch, black 10%, transparent);
	}

	.result-heading {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		margin-top: 0.25rem;
	}

	.result-heading h2 {
		margin: 0;
		font-size: 1.25rem;
	}

	.result-heading span {
		font-size: 0.78rem;
		color: color-mix(in oklch, currentColor 42%, transparent);
	}

	.batch-list,
	.batch-group,
	.word-list {
		display: grid;
		gap: 0.65rem;
	}

	.batch-list {
		gap: 1.4rem;
	}

	.batch-group {
		gap: 0.8rem;
	}

	.batch-heading {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr) auto;
		align-items: center;
		gap: 0.75rem;
		padding: 0 0.25rem;
	}

	.batch-timeline {
		width: 2.4rem;
		height: 2.4rem;
		display: grid;
		place-items: center;
		border-radius: 0.75rem;
		font-size: 1.25rem;
		color: var(--primary);
		background: color-mix(in oklch, var(--primary) 13%, transparent);
	}

	.batch-title h3,
	.batch-title p {
		margin: 0;
	}

	.batch-title h3 {
		font-size: 1rem;
		font-weight: 700;
	}

	.batch-title p,
	.batch-count {
		font-size: 0.72rem;
		color: color-mix(in oklch, currentColor 44%, transparent);
	}

	.batch-title p {
		margin-top: 0.12rem;
	}

	.batch-count {
		white-space: nowrap;
	}

	.word-item {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		align-items: center;
		gap: 0.5rem;
		padding: 0.45rem;
		border: 1px solid var(--line-divider);
		border-radius: 0.9rem;
		background: color-mix(in oklch, var(--card-bg) 94%, transparent);
		transition: border-color 160ms ease, transform 160ms ease, background 160ms ease;
	}

	.word-item:hover {
		border-color: color-mix(in oklch, var(--primary) 42%, var(--line-divider));
		transform: translateY(-1px);
	}

	.word-item.mastered {
		background: color-mix(in oklch, var(--card-bg) 91%, oklch(0.72 0.12 155) 9%);
	}

	.word-open {
		min-width: 0;
		display: grid;
		grid-template-columns: 3.25rem minmax(0, 1fr) auto;
		align-items: center;
		gap: 1rem;
		padding: 0.55rem;
		border: 0;
		border-radius: 0.7rem;
		font: inherit;
		text-align: left;
		color: inherit;
		background: transparent;
		cursor: pointer;
		transition: background 150ms ease, box-shadow 150ms ease;
	}

	.word-open:hover {
		background: color-mix(in oklch, var(--primary) 6%, transparent);
	}

	.word-open:focus-visible {
		outline: 2px solid var(--primary);
		outline-offset: 1px;
	}

	.word-open > :global(svg) {
		font-size: 1.35rem;
		color: color-mix(in oklch, currentColor 30%, transparent);
	}

	.word-number {
		width: 3.25rem;
		height: 3.25rem;
		display: grid;
		place-content: center;
		text-align: center;
		border-radius: 0.85rem;
		color: var(--btn-content);
		background: var(--btn-regular-bg);
	}

	.word-number span {
		font-size: 0.95rem;
		font-weight: 700;
		line-height: 1;
	}

	.word-number small {
		margin-top: 0.22rem;
		font-size: 0.58rem;
		opacity: 0.55;
	}

	.word-main {
		min-width: 0;
	}

	.word-title {
		display: flex;
		align-items: center;
		gap: 0.55rem;
		flex-wrap: wrap;
	}

	.word-title h4 {
		margin: 0;
		font-family: var(--font-jetbrains-mono), monospace;
		font-size: 1.1rem;
		letter-spacing: 0.01em;
	}

	.source-badge {
		padding: 0.18rem 0.42rem;
		border-radius: 999px;
		font-size: 0.62rem;
		color: oklch(0.62 0.15 62);
		background: oklch(0.72 0.15 62 / 0.12);
	}

	.duplicate-badge {
		padding: 0.18rem 0.42rem;
		border-radius: 999px;
		font-size: 0.62rem;
		color: color-mix(in oklch, var(--primary) 82%, currentColor);
		background: color-mix(in oklch, var(--primary) 12%, transparent);
	}

	.phonetic,
	.meaning {
		margin: 0;
	}

	.phonetic {
		margin-top: 0.18rem;
		font-family: var(--font-jetbrains-mono), monospace;
		font-size: 0.72rem;
		color: color-mix(in oklch, currentColor 42%, transparent);
	}

	.meaning {
		margin-top: 0.45rem;
		font-size: 0.86rem;
		line-height: 1.65;
		color: color-mix(in oklch, currentColor 72%, transparent);
	}

	.status-control {
		flex: none;
	}

	.status-control button {
		padding: 0.48rem 0.58rem;
		border-radius: 0.52rem;
		font-size: 0.7rem;
	}

	.status-control button:hover,
	.status-control button.active {
		background: var(--card-bg);
		box-shadow: 0 1px 4px color-mix(in oklch, black 9%, transparent);
	}

	.status-control .status-new.active {
		color: color-mix(in oklch, currentColor 62%, transparent);
	}

	.status-control .status-learning.active {
		color: oklch(0.66 0.16 62);
	}

	.status-control .status-mastered.active {
		color: oklch(0.6 0.15 155);
	}

	.word-detail-dialog {
		width: min(44rem, calc(100vw - 2rem));
		max-height: calc(100dvh - 2rem);
		position: fixed;
		inset: 50vh auto auto 50vw;
		margin: 0;
		transform: translate(-50%, -50%);
		padding: 0;
		overflow: hidden;
		border: 1px solid color-mix(in oklch, var(--primary) 24%, var(--line-divider));
		border-radius: 1rem;
		color: var(--btn-content);
		background: var(--card-bg);
		box-shadow: 0 1.5rem 4rem color-mix(in oklch, black 28%, transparent);
	}

	.word-detail-dialog::backdrop {
		background: color-mix(in oklch, black 54%, transparent);
		backdrop-filter: blur(4px);
	}

	.detail-surface {
		display: grid;
		gap: 1rem;
		padding: 1.25rem;
		overflow-y: auto;
		max-height: calc(100dvh - 2rem);
	}

	.detail-header {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 1rem;
	}

	.detail-header h2,
	.detail-header p {
		margin: 0;
	}

	.detail-header h2 {
		margin-top: 0.2rem;
		font-family: var(--font-jetbrains-mono), monospace;
		font-size: 1.65rem;
		line-height: 1.2;
	}

	.detail-header p {
		margin-top: 0.35rem;
		font-family: var(--font-jetbrains-mono), monospace;
		font-size: 0.76rem;
		color: color-mix(in oklch, currentColor 48%, transparent);
	}

	.detail-eyebrow {
		font-size: 0.68rem;
		font-weight: 700;
		letter-spacing: 0.12em;
		color: var(--primary);
	}

	.detail-close {
		width: 2.4rem;
		height: 2.4rem;
		display: grid;
		place-items: center;
		flex: none;
		border: 0;
		border-radius: 0.7rem;
		font-size: 1.25rem;
		color: color-mix(in oklch, currentColor 56%, transparent);
		background: var(--btn-regular-bg);
		cursor: pointer;
	}

	.detail-meta {
		display: flex;
		gap: 0.5rem;
		flex-wrap: wrap;
	}

	.detail-meta span {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		padding: 0.38rem 0.55rem;
		border-radius: 999px;
		font-size: 0.68rem;
		color: color-mix(in oklch, currentColor 58%, transparent);
		background: var(--btn-regular-bg);
	}

	.detail-meta :global(svg) {
		font-size: 0.9rem;
		color: var(--primary);
	}

	.detail-meaning {
		padding: 1rem;
		border-radius: 0.85rem;
		background: color-mix(in oklch, var(--primary) 9%, var(--card-bg));
	}

	.detail-meaning h3,
	.detail-meaning p {
		margin: 0;
	}

	.detail-meaning h3 {
		font-size: 0.72rem;
		color: var(--primary);
	}

	.detail-meaning p {
		margin-top: 0.5rem;
		font-size: 0.95rem;
		line-height: 1.8;
	}

	.detail-warning {
		display: grid;
		grid-template-columns: auto 1fr;
		align-items: start;
		gap: 0.55rem;
		padding: 0.8rem;
		border: 1px solid oklch(0.72 0.15 62 / 0.25);
		border-radius: 0.75rem;
		color: oklch(0.62 0.15 62);
		background: oklch(0.72 0.15 62 / 0.08);
	}

	.detail-warning > :global(svg) {
		margin-top: 0.1rem;
		font-size: 1.1rem;
	}

	.detail-warning p,
	.detail-warning strong,
	.detail-warning span {
		display: block;
		margin: 0;
	}

	.detail-warning strong {
		font-size: 0.76rem;
	}

	.detail-warning span {
		margin-top: 0.15rem;
		font-size: 0.7rem;
		line-height: 1.55;
		color: color-mix(in oklch, currentColor 76%, transparent);
	}

	.relation-panel {
		display: grid;
		gap: 0.65rem;
	}

	.relation-heading {
		display: flex;
		align-items: flex-end;
		justify-content: space-between;
		gap: 0.75rem;
		padding: 0.15rem 0.1rem;
	}

	.relation-heading h3 {
		margin: 0.2rem 0 0;
		font-size: 1rem;
	}

	.relation-source {
		font-size: 0.62rem;
		color: color-mix(in oklch, currentColor 42%, transparent);
	}

	.relation-group {
		border: 1px solid var(--line-divider);
		border-radius: 0.8rem;
		background: color-mix(in oklch, var(--card-bg) 94%, var(--primary) 6%);
		overflow: hidden;
	}

	.relation-group summary {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		padding: 0.75rem 0.85rem;
		font-size: 0.78rem;
		font-weight: 700;
		cursor: pointer;
		list-style: none;
	}

	.relation-group summary::-webkit-details-marker {
		display: none;
	}

	.relation-group summary > span:first-child {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
	}

	.relation-group summary :global(svg) {
		font-size: 1rem;
		color: var(--primary);
	}

	.relation-count {
		min-width: 1.4rem;
		padding: 0.12rem 0.38rem;
		border-radius: 999px;
		text-align: center;
		font-size: 0.62rem;
		font-weight: 600;
		color: color-mix(in oklch, currentColor 58%, transparent);
		background: var(--btn-regular-bg);
	}

	.relation-content {
		display: grid;
		gap: 0.65rem;
		padding: 0 0.85rem 0.85rem;
		border-top: 1px solid color-mix(in oklch, var(--line-divider) 72%, transparent);
	}

	.relation-content > :first-child {
		margin-top: 0.75rem;
	}

	.etymology-content p,
	.relation-empty,
	.relation-note {
		margin: 0;
		font-size: 0.7rem;
		line-height: 1.65;
		color: color-mix(in oklch, currentColor 58%, transparent);
	}

	.root-list,
	.relation-chips {
		display: flex;
		flex-wrap: wrap;
		gap: 0.45rem;
	}

	.root-list code {
		padding: 0.25rem 0.45rem;
		border-radius: 0.45rem;
		font-size: 0.68rem;
		color: var(--primary);
		background: color-mix(in oklch, var(--primary) 10%, transparent);
	}

	.relation-chip {
		display: inline-flex;
		align-items: baseline;
		gap: 0.35rem;
		max-width: 100%;
		padding: 0.38rem 0.55rem;
		border: 1px solid var(--line-divider);
		border-radius: 0.55rem;
		font-family: inherit;
		font-size: 0.68rem;
		line-height: 1.25;
		color: color-mix(in oklch, currentColor 72%, transparent);
		background: var(--card-bg);
	}

	.relation-chip strong {
		font-family: var(--font-jetbrains-mono), monospace;
		font-size: 0.72rem;
		color: var(--btn-content);
	}

	.relation-chip span {
		font-size: 0.58rem;
		color: color-mix(in oklch, currentColor 52%, transparent);
	}

	button.relation-chip.in-library {
		border-color: color-mix(in oklch, var(--primary) 32%, var(--line-divider));
		background: color-mix(in oklch, var(--primary) 8%, var(--card-bg));
		cursor: pointer;
		transition: border-color 0.18s ease, transform 0.18s ease;
	}

	button.relation-chip.in-library:hover {
		border-color: var(--primary);
		transform: translateY(-1px);
	}

	.synonym-list {
		gap: 0.75rem;
	}

	.synonym-sense {
		display: grid;
		gap: 0.5rem;
		padding-bottom: 0.7rem;
		border-bottom: 1px dashed var(--line-divider);
	}

	.synonym-sense:last-child {
		padding-bottom: 0;
		border-bottom: 0;
	}

	.sense-heading {
		display: grid;
		grid-template-columns: auto 1fr;
		align-items: start;
		gap: 0.5rem;
	}

	.sense-heading > span {
		padding: 0.16rem 0.35rem;
		border-radius: 0.35rem;
		font-size: 0.58rem;
		color: var(--primary);
		background: color-mix(in oklch, var(--primary) 10%, transparent);
	}

	.sense-heading p {
		margin: 0;
		font-size: 0.68rem;
		line-height: 1.55;
		color: color-mix(in oklch, currentColor 62%, transparent);
	}

	.detail-footer {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		padding-top: 0.9rem;
		border-top: 1px solid var(--line-divider);
	}

	.detail-footer > span {
		font-size: 0.72rem;
		color: color-mix(in oklch, currentColor 48%, transparent);
	}

	.review-panel {
		display: grid;
		gap: 1rem;
	}

	.review-heading {
		display: flex;
		align-items: flex-end;
		justify-content: space-between;
		gap: 1rem;
		padding: 1.25rem;
		border: 1px solid color-mix(in oklch, var(--primary) 28%, var(--line-divider));
		border-radius: 1rem;
		background: linear-gradient(
			135deg,
			color-mix(in oklch, var(--card-bg) 84%, var(--primary) 16%),
			var(--card-bg)
		);
	}

	.review-heading h2,
	.review-heading p {
		margin: 0;
	}

	.review-heading h2 {
		margin-top: 0.18rem;
		font-size: 1.35rem;
	}

	.review-heading p {
		margin-top: 0.35rem;
		font-size: 0.8rem;
		color: color-mix(in oklch, currentColor 52%, transparent);
	}

	.review-eyebrow {
		font-size: 0.68rem;
		font-weight: 700;
		letter-spacing: 0.12em;
		color: var(--primary);
	}

	.review-draw-controls,
	.review-draw-controls label,
	.primary-action,
	.round-toolbar,
	.round-toolbar > div,
	.reveal-action {
		display: flex;
		align-items: center;
	}

	.review-draw-controls {
		gap: 0.6rem;
		flex: none;
	}

	.review-draw-controls label {
		min-height: 2.65rem;
		gap: 0.45rem;
		padding: 0 0.65rem;
		border: 1px solid var(--line-divider);
		border-radius: 0.7rem;
		font-size: 0.75rem;
		background: var(--card-bg);
	}

	.review-draw-controls label > span {
		color: color-mix(in oklch, currentColor 48%, transparent);
	}

	.review-draw-controls select {
		padding: 0.5rem 0;
		border: 0;
		outline: 0;
		color: inherit;
		background: transparent;
	}

	.primary-action,
	.reveal-action,
	.round-toolbar button {
		border: 0;
		font: inherit;
		cursor: pointer;
	}

	.primary-action {
		min-height: 2.65rem;
		justify-content: center;
		gap: 0.4rem;
		padding: 0 0.9rem;
		border-radius: 0.7rem;
		font-size: 0.8rem;
		font-weight: 700;
		color: white;
		background: var(--primary);
	}

	.primary-action:disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}

	.review-scope {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		font-size: 0.75rem;
		color: color-mix(in oklch, currentColor 48%, transparent);
	}

	.review-scope :global(svg) {
		font-size: 1rem;
		color: var(--primary);
	}

	.round-toolbar {
		justify-content: space-between;
		gap: 0.75rem;
		padding: 0.65rem 0.8rem;
		border-radius: 0.75rem;
		font-size: 0.75rem;
		background: var(--btn-regular-bg);
	}

	.round-toolbar > span {
		font-weight: 700;
		color: var(--primary);
	}

	.round-toolbar > div {
		gap: 0.35rem;
	}

	.round-toolbar button {
		padding: 0.42rem 0.6rem;
		border-radius: 0.5rem;
		font-size: 0.7rem;
		color: color-mix(in oklch, currentColor 64%, transparent);
		background: var(--card-bg);
	}

	.review-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.8rem;
	}

	.review-card {
		display: grid;
		grid-template-rows: auto auto auto minmax(5.5rem, 1fr) auto;
		padding: 1rem;
		border: 1px solid var(--line-divider);
		border-radius: 0.95rem;
		background: color-mix(in oklch, var(--card-bg) 95%, transparent);
		transition: border-color 160ms ease, background 160ms ease;
	}

	.review-card.revealed {
		border-color: color-mix(in oklch, var(--primary) 38%, var(--line-divider));
		background: color-mix(in oklch, var(--card-bg) 91%, var(--primary) 9%);
	}

	.review-card-meta {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		color: color-mix(in oklch, currentColor 38%, transparent);
	}

	.review-card-meta span {
		font-family: var(--font-jetbrains-mono), monospace;
		font-size: 0.68rem;
		font-weight: 700;
		color: var(--primary);
	}

	.review-card-meta small {
		font-size: 0.62rem;
	}

	.review-card h3 {
		margin: 0.7rem 0 0;
		font-family: var(--font-jetbrains-mono), monospace;
		font-size: 1.35rem;
	}

	.review-card > .phonetic {
		margin-top: 0.25rem;
	}

	.review-meaning,
	.meaning-placeholder {
		align-self: stretch;
		margin-top: 0.9rem;
		border-radius: 0.75rem;
	}

	.review-meaning {
		padding: 0.75rem;
		background: color-mix(in oklch, var(--primary) 9%, transparent);
	}

	.review-meaning span {
		font-size: 0.65rem;
		font-weight: 700;
		color: var(--primary);
	}

	.review-meaning p {
		margin: 0.35rem 0 0;
		font-size: 0.85rem;
		line-height: 1.6;
		color: color-mix(in oklch, currentColor 72%, transparent);
	}

	.meaning-placeholder {
		display: grid;
		place-items: center;
		align-content: center;
		gap: 0.35rem;
		padding: 0.75rem;
		border: 1px dashed var(--line-divider);
		font-size: 0.72rem;
		color: color-mix(in oklch, currentColor 38%, transparent);
		background: var(--btn-regular-bg);
	}

	.meaning-placeholder :global(svg) {
		font-size: 1.25rem;
	}

	.reveal-action {
		justify-content: center;
		gap: 0.35rem;
		margin-top: 0.8rem;
		padding: 0.58rem 0.75rem;
		border-radius: 0.65rem;
		font-size: 0.75rem;
		font-weight: 700;
		color: var(--btn-content);
		background: var(--btn-regular-bg);
	}

	.review-card.revealed .reveal-action {
		color: var(--primary);
		background: color-mix(in oklch, var(--primary) 12%, var(--card-bg));
	}

	.review-empty {
		padding-block: 3rem;
	}

	.empty-state {
		display: grid;
		place-items: center;
		padding: 4rem 1rem;
		text-align: center;
		border: 1px dashed var(--line-divider);
		border-radius: 0.9rem;
	}

	.empty-state :global(svg) {
		font-size: 3rem;
		color: color-mix(in oklch, currentColor 20%, transparent);
	}

	.empty-state h3 {
		margin: 0.75rem 0 0;
	}

	.empty-state p {
		margin: 0.25rem 0 1rem;
		font-size: 0.85rem;
		color: color-mix(in oklch, currentColor 45%, transparent);
	}

	.empty-state button {
		padding: 0.55rem 0.85rem;
		border-radius: 0.6rem;
		color: var(--btn-content);
		background: var(--btn-regular-bg);
	}

	@media (max-width: 960px) {
		.summary-grid {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}

	@media (max-width: 680px) {
		.summary-grid {
			grid-template-columns: 1fr 1fr;
		}

		.summary-card {
			min-height: 5.5rem;
			padding: 0.8rem;
		}

		.summary-icon {
			width: 2.3rem;
			height: 2.3rem;
		}

		.source-note {
			grid-template-columns: auto 1fr;
		}

		.source-note > span {
			grid-column: 2;
		}

		.search-box,
		.select-box,
		.page-filter {
			width: 100%;
		}

		.view-switcher {
			width: 100%;
		}

		.view-switcher button {
			flex: 1;
			justify-content: center;
		}

		.select-box select {
			flex: 1;
		}

		.page-filter button {
			flex: 1;
		}

		.batch-heading {
			grid-template-columns: auto minmax(0, 1fr);
		}

		.batch-count {
			grid-column: 2;
		}

		.word-item {
			grid-template-columns: 1fr;
			align-items: stretch;
			gap: 0.4rem;
			padding: 0.4rem;
		}

		.word-open {
			grid-template-columns: 2.75rem minmax(0, 1fr) auto;
			align-items: start;
			gap: 0.75rem;
			padding: 0.45rem;
		}

		.word-number {
			width: 2.75rem;
			height: 2.75rem;
		}

		.status-control {
			width: 100%;
		}

		.status-control button {
			flex: 1;
		}

		.review-heading {
			align-items: stretch;
			flex-direction: column;
		}

		.review-draw-controls {
			width: 100%;
		}

		.review-draw-controls label,
		.review-draw-controls .primary-action {
			flex: 1;
		}

		.review-grid {
			grid-template-columns: 1fr;
		}

		.detail-surface {
			padding: 1rem;
		}

		.detail-footer {
			align-items: stretch;
			flex-direction: column;
		}
	}

	@media (max-width: 430px) {
		.summary-card {
			gap: 0.55rem;
		}

		.summary-card strong {
			font-size: 1.25rem;
		}

		.summary-card div > span {
			font-size: 0.7rem;
		}

		.summary-icon {
			display: none;
		}
	}
</style>
