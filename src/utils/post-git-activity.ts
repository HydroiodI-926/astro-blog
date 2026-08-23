import { execFileSync } from "node:child_process";

/**
 * 文章更新热度的 Git 统计基线。
 *
 * 基线前已存在的文章从下一次提交开始记录更新；基线后新增文章的
 * 首次提交只算发布，后续提交才算更新。
 */
export const ARTICLE_ACTIVITY_BASELINE_COMMIT =
	"3225d432405ed72dee2a1b1531d369d564be92c4";

interface SelectPostUpdatedAtOptions {
	publishedAt: string;
	explicitUpdatedAt?: string;
	existedAtBaseline: boolean;
	commitDatesAfterBaseline: string[];
}

interface GetPostUpdatedAtOptions {
	filePath?: string;
	publishedAt: Date;
	explicitUpdatedAt?: Date;
}

function getLatestValidDate(dates: Array<string | undefined>) {
	return dates
		.filter((date): date is string => Boolean(date))
		.filter((date) => Number.isFinite(Date.parse(date)))
		.sort((left, right) => Date.parse(right) - Date.parse(left))[0];
}

export function selectPostUpdatedAt({
	publishedAt,
	explicitUpdatedAt,
	existedAtBaseline,
	commitDatesAfterBaseline,
}: SelectPostUpdatedAtOptions) {
	const gitUpdatedAt = existedAtBaseline
		? commitDatesAfterBaseline.at(-1)
		: commitDatesAfterBaseline.length > 1
			? commitDatesAfterBaseline.at(-1)
			: undefined;
	const updatedAt = getLatestValidDate([explicitUpdatedAt, gitUpdatedAt]);

	if (!updatedAt || Date.parse(updatedAt) <= Date.parse(publishedAt)) {
		return undefined;
	}
	return updatedAt;
}

function runGit(args: string[]) {
	return execFileSync("git", args, {
		cwd: process.cwd(),
		encoding: "utf8",
		stdio: ["ignore", "pipe", "ignore"],
	}).trim();
}

export function getPostUpdatedAt({
	filePath,
	publishedAt,
	explicitUpdatedAt,
}: GetPostUpdatedAtOptions) {
	if (!filePath) {
		return selectPostUpdatedAt({
			publishedAt: publishedAt.toISOString(),
			explicitUpdatedAt: explicitUpdatedAt?.toISOString(),
			existedAtBaseline: false,
			commitDatesAfterBaseline: [],
		});
	}

	const repositoryPath = filePath.replaceAll("\\", "/");
	let existedAtBaseline = false;
	let commitDatesAfterBaseline: string[] = [];

	try {
		runGit([
			"cat-file",
			"-e",
			`${ARTICLE_ACTIVITY_BASELINE_COMMIT}:${repositoryPath}`,
		]);
		existedAtBaseline = true;
	} catch {
		// 基线后新增的文章在基线提交中不存在。
	}

	try {
		const output = runGit([
			"log",
			"--format=%cI",
			"--reverse",
			`${ARTICLE_ACTIVITY_BASELINE_COMMIT}..HEAD`,
			"--",
			repositoryPath,
		]);
		commitDatesAfterBaseline = output ? output.split(/\r?\n/) : [];
	} catch {
		// Git 不可用或历史不完整时，安全回退到显式 updated 元数据。
	}

	return selectPostUpdatedAt({
		publishedAt: publishedAt.toISOString(),
		explicitUpdatedAt: explicitUpdatedAt?.toISOString(),
		existedAtBaseline,
		commitDatesAfterBaseline,
	});
}
