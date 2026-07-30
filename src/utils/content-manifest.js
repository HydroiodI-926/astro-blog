import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
	existsSync,
	mkdirSync,
	readdirSync,
	readFileSync,
	realpathSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import path from "node:path";
import { slug as githubSlug } from "github-slugger";
import { parse } from "yaml";

export const CONTENT_MANIFEST_SCHEMA_VERSION = 1;
export const CONTENT_MANIFEST_LATEST_LIMIT = 50;

const ARTICLE_EXTENSIONS = new Set([".md", ".mdx"]);
const FRONTMATTER_PATTERN =
	/^\uFEFF?---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/;

function toPosixPath(filePath) {
	return filePath.replaceAll("\\", "/");
}

function isPathInside(parentPath, childPath) {
	const relative = path.relative(parentPath, childPath);
	return (
		relative === "" ||
		(!relative.startsWith("..") && !path.isAbsolute(relative))
	);
}

function sha256(value) {
	return createHash("sha256").update(value).digest("hex");
}

function readGitValue(repositoryRoot, args) {
	try {
		return execFileSync(
			"git",
			[
				"-c",
				`safe.directory=${toPosixPath(repositoryRoot)}`,
				"-C",
				repositoryRoot,
				...args,
			],
			{ encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
		).trim();
	} catch {
		return "";
	}
}

function normalizeRepository(remote) {
	const normalized = remote
		.trim()
		.replace(/\.git$/, "")
		.replace(/\/$/, "");
	const githubMatch = normalized.match(/github\.com[/:]([^/]+\/[^/]+)$/i);
	return githubMatch?.[1] || normalized || "unknown";
}

function resolveSourceRoot(projectRoot, postsDir) {
	const configuredContentDir = process.env.CONTENT_DIR
		? path.resolve(projectRoot, process.env.CONTENT_DIR)
		: path.join(projectRoot, "content");

	if (existsSync(configuredContentDir)) {
		try {
			const realPostsDir = realpathSync(postsDir);
			const realContentDir = realpathSync(configuredContentDir);
			if (isPathInside(realContentDir, realPostsDir)) {
				return configuredContentDir;
			}
		} catch {
			// Fall back to the project repository when a content checkout is incomplete.
		}
	}

	return projectRoot;
}

function discoverSource(projectRoot, postsDir, overrides = {}) {
	const sourceRoot =
		overrides.sourceRoot ?? resolveSourceRoot(projectRoot, postsDir);
	const isProjectRepository =
		path.resolve(sourceRoot) === path.resolve(projectRoot);
	const gitRemote = readGitValue(sourceRoot, [
		"config",
		"--get",
		"remote.origin.url",
	]);
	const gitBranch = readGitValue(sourceRoot, ["branch", "--show-current"]);
	const gitCommit = readGitValue(sourceRoot, ["rev-parse", "HEAD"]);
	const remote =
		overrides.repository ??
		process.env.CONTENT_MANIFEST_REPOSITORY ??
		(isProjectRepository
			? process.env.GITHUB_REPOSITORY
			: process.env.CONTENT_REPO_URL) ??
		gitRemote;
	const branch =
		overrides.branch ??
		process.env.CONTENT_MANIFEST_BRANCH ??
		(isProjectRepository
			? (process.env.GITHUB_HEAD_REF ?? process.env.GITHUB_REF_NAME)
			: undefined) ??
		gitBranch ??
		"";
	let commit =
		overrides.commit ??
		process.env.CONTENT_MANIFEST_COMMIT ??
		(isProjectRepository ? process.env.GITHUB_SHA : undefined) ??
		gitCommit;
	const postsPathspec = toPosixPath(path.relative(sourceRoot, postsDir)) || ".";
	const isDirty = Boolean(
		gitCommit &&
			readGitValue(sourceRoot, [
				"status",
				"--porcelain",
				"--untracked-files=all",
				"--",
				postsPathspec,
			]),
	);
	if (isDirty && !overrides.commit && !process.env.CONTENT_MANIFEST_COMMIT) {
		commit = `${commit}-dirty`;
	}

	return {
		sourceRoot,
		publicSource: {
			repository: normalizeRepository(remote),
			branch: branch || "unknown",
			commit: commit || "unknown",
		},
	};
}

function listArticleFiles(directory) {
	if (!existsSync(directory)) {
		throw new Error(`文章目录不存在：${directory}`);
	}

	const result = [];
	for (const entry of readdirSync(directory, { withFileTypes: true })) {
		const entryPath = path.join(directory, entry.name);
		if (entry.isDirectory()) {
			result.push(...listArticleFiles(entryPath));
		} else if (
			entry.isFile() &&
			ARTICLE_EXTENSIONS.has(path.extname(entry.name).toLowerCase())
		) {
			result.push(entryPath);
		}
	}

	return result.sort((left, right) =>
		toPosixPath(left).localeCompare(toPosixPath(right), "zh-CN"),
	);
}

function parseArticle(rawContent, filePath) {
	const match = rawContent.match(FRONTMATTER_PATTERN);
	if (!match) {
		throw new Error(`文章缺少 YAML frontmatter：${filePath}`);
	}

	let data;
	try {
		data = parse(match[1]) ?? {};
	} catch (error) {
		throw new Error(
			`文章 frontmatter 解析失败：${filePath}\n${error.message}`,
			{
				cause: error,
			},
		);
	}

	if (typeof data !== "object" || Array.isArray(data)) {
		throw new Error(`文章 frontmatter 必须是对象：${filePath}`);
	}

	return { data, body: rawContent.slice(match[0].length) };
}

function normalizeDate(value, fieldName, filePath) {
	if (value instanceof Date && !Number.isNaN(value.valueOf())) {
		return value.toISOString().slice(0, 10);
	}

	if (typeof value === "string" || typeof value === "number") {
		const text = String(value).trim();
		if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
			const parsed = new Date(`${text}T00:00:00Z`);
			if (
				!Number.isNaN(parsed.valueOf()) &&
				parsed.toISOString().slice(0, 10) === text
			) {
				return text;
			}
		}

		const parsed = new Date(text);
		if (!Number.isNaN(parsed.valueOf())) {
			return parsed.toISOString().slice(0, 10);
		}
	}

	throw new Error(`文章 ${fieldName} 不是有效日期：${filePath}`);
}

function normalizeStringArray(value) {
	if (!Array.isArray(value)) return [];
	return value
		.filter((item) => typeof item === "string")
		.map((item) => item.trim())
		.filter(Boolean);
}

function stripFencedCodeBlocks(markdown) {
	const keptLines = [];
	let fence = null;

	for (const line of markdown.split(/\r?\n/)) {
		const marker = line.match(/^ {0,3}(`{3,}|~{3,})/);
		if (marker) {
			if (!fence) {
				fence = marker[1][0];
			} else if (marker[1][0] === fence) {
				fence = null;
			}
			continue;
		}
		if (!fence) keptLines.push(line);
	}

	return keptLines.join("\n");
}

function extractImageReferences(markdown) {
	const content = stripFencedCodeBlocks(markdown);
	const references = [];
	const definitions = new Map();
	const definitionPattern = /^ {0,3}\[([^\]]+)\]:\s*(?:<([^>]+)>|([^\s]+))/gim;
	for (const match of content.matchAll(definitionPattern)) {
		definitions.set(match[1].trim().toLowerCase(), match[2] ?? match[3]);
	}

	const inlinePattern = /!\[[^\]]*\]\(\s*(?:<([^>]+)>|([^\s)]+))/g;
	for (const match of content.matchAll(inlinePattern)) {
		references.push(match[1] ?? match[2]);
	}

	const referencePattern = /!\[([^\]]*)\]\[([^\]]*)\]/g;
	for (const match of content.matchAll(referencePattern)) {
		const label = (match[2] || match[1]).trim().toLowerCase();
		const target = definitions.get(label);
		if (target) references.push(target);
	}

	const htmlPattern =
		/<img\b[^>]*\bsrc\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+))[^>]*>/gi;
	for (const match of content.matchAll(htmlPattern)) {
		references.push(match[1] ?? match[2] ?? match[3]);
	}

	return references.filter(Boolean);
}

function encodeRepositoryPath(repositoryPath) {
	return toPosixPath(repositoryPath)
		.split("/")
		.map((segment) => encodeURIComponent(segment))
		.join("/");
}

function buildRawUrl(source, repositoryPath) {
	if (
		!/^[^/]+\/[^/]+$/.test(source.repository) ||
		!/^[a-f\d]{7,40}$/i.test(source.commit)
	) {
		return null;
	}
	return `https://raw.githubusercontent.com/${source.repository}/${encodeURIComponent(source.commit)}/${encodeRepositoryPath(repositoryPath)}`;
}

function removeQueryAndHash(reference) {
	return reference.split(/[?#]/, 1)[0];
}

function isExternalReference(reference) {
	return /^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(reference);
}

function repositoryPathForFile(filePath, sourceRoot, projectRoot) {
	const resolvedFile = path.resolve(filePath);
	if (isPathInside(sourceRoot, resolvedFile)) {
		return toPosixPath(path.relative(sourceRoot, resolvedFile));
	}
	if (isPathInside(projectRoot, resolvedFile)) {
		return toPosixPath(path.relative(projectRoot, resolvedFile));
	}
	return null;
}

function resolveAsset(reference, type, context) {
	const source = reference.trim().replace(/^<|>$/g, "");
	if (!source) return null;

	if (isExternalReference(source)) {
		return {
			type,
			source,
			sourcePath: null,
			target: source,
			url: source,
			external: true,
			exists: null,
		};
	}

	const cleanReference = removeQueryAndHash(source);
	let resolvedFile;
	let publicUrl = null;
	if (cleanReference.startsWith("/")) {
		resolvedFile = path.join(
			context.projectRoot,
			"public",
			cleanReference.replace(/^\/+/, ""),
		);
		publicUrl = source;
	} else {
		resolvedFile = path.resolve(
			path.dirname(context.articlePath),
			cleanReference,
		);
	}

	const sourcePath = repositoryPathForFile(
		resolvedFile,
		context.sourceRoot,
		context.projectRoot,
	);
	const rawUrl = sourcePath ? buildRawUrl(context.source, sourcePath) : null;
	const url = publicUrl ?? rawUrl;

	return {
		type,
		source,
		sourcePath,
		target: url ?? sourcePath,
		url,
		external: false,
		exists: existsSync(resolvedFile),
	};
}

function collectAssets(data, body, context) {
	const candidates = [];
	if (typeof data.image === "string" && data.image.trim()) {
		candidates.push({ type: "cover", source: data.image });
	}
	for (const source of extractImageReferences(body)) {
		candidates.push({ type: "image", source });
	}

	const assets = new Map();
	for (const candidate of candidates) {
		const asset = resolveAsset(candidate.source, candidate.type, context);
		if (!asset) continue;
		const key = asset.source;
		const previous = assets.get(key);
		if (!previous || asset.type === "cover") assets.set(key, asset);
	}

	return [...assets.values()];
}

function buildDocumentUrl(data, articleRelativePath) {
	if (typeof data.permalink === "string" && data.permalink.trim()) {
		const slug = data.permalink.trim().replace(/^\/+|\/+$/g, "");
		return { slug, url: `/${slug}/` };
	}
	if (typeof data.alias === "string" && data.alias.trim()) {
		const slug = data.alias
			.trim()
			.replace(/^\/+|\/+$/g, "")
			.replace(/^posts\//, "");
		return { slug, url: `/posts/${slug}/` };
	}
	const slug = articleRelativePath
		.replace(/\.(?:md|mdx)$/i, "")
		.split("/")
		.map((segment) => githubSlug(segment))
		.join("/")
		.replace(/\/index$/, "");
	return { slug, url: `/posts/${slug}/` };
}

function buildDocument(articlePath, context) {
	const rawBuffer = readFileSync(articlePath);
	const rawContent = rawBuffer.toString("utf8");
	const { data, body } = parseArticle(rawContent, articlePath);

	if (typeof data.title !== "string" || !data.title.trim()) {
		throw new Error(`文章 title 不能为空：${articlePath}`);
	}

	const date = normalizeDate(data.published, "published", articlePath);
	const lastmod = data.updated
		? normalizeDate(data.updated, "updated", articlePath)
		: date;
	const articleRelativePath = toPosixPath(
		path.relative(context.postsDir, articlePath),
	);
	const sourcePath = repositoryPathForFile(
		articlePath,
		context.sourceRoot,
		context.projectRoot,
	);
	if (!sourcePath) {
		throw new Error(`文章不在项目或内容仓库中：${articlePath}`);
	}

	const { slug, url } = buildDocumentUrl(data, articleRelativePath);
	const id = `sha256:${sha256(`${context.source.repository}\0${sourcePath}`)}`;
	return {
		excluded: data.draft === true || data.encrypted === true,
		document: {
			id,
			sourcePath,
			sourceUrl: buildRawUrl(context.source, sourcePath),
			contentHash: `sha256:${sha256(rawBuffer)}`,
			title: data.title.trim(),
			slug,
			url,
			date,
			lastmod,
			tags: normalizeStringArray(data.tags),
			category: typeof data.category === "string" ? data.category : "",
			lang: typeof data.lang === "string" ? data.lang : "",
			draft: data.draft === true,
			summary: typeof data.description === "string" ? data.description : "",
			assets: collectAssets(data, body, {
				...context,
				articlePath,
			}),
			publish: data.draft !== true && data.encrypted !== true,
		},
	};
}

function sortByPublished(left, right) {
	return (
		right.date.localeCompare(left.date) ||
		right.lastmod.localeCompare(left.lastmod) ||
		left.sourcePath.localeCompare(right.sourcePath, "zh-CN")
	);
}

function sortByLastModified(left, right) {
	return (
		right.lastmod.localeCompare(left.lastmod) ||
		right.date.localeCompare(left.date) ||
		left.sourcePath.localeCompare(right.sourcePath, "zh-CN")
	);
}

export function buildContentManifest(options = {}) {
	const projectRoot = path.resolve(options.projectRoot ?? process.cwd());
	const postsDir = path.resolve(
		options.postsDir ?? path.join(projectRoot, "src", "content", "posts"),
	);
	const { sourceRoot, publicSource } = discoverSource(
		projectRoot,
		postsDir,
		options.source,
	);
	const generatedAt = new Date(options.now ?? Date.now()).toISOString();
	const documents = [];
	let excludedCount = 0;

	for (const articlePath of listArticleFiles(postsDir)) {
		const result = buildDocument(articlePath, {
			projectRoot,
			postsDir,
			sourceRoot,
			source: publicSource,
		});
		if (result.excluded) {
			excludedCount += 1;
		} else {
			documents.push(result.document);
		}
	}

	documents.sort(sortByPublished);
	const documentsByYear = new Map();
	for (const document of documents) {
		const year = document.date.slice(0, 4);
		const yearlyDocuments = documentsByYear.get(year) ?? [];
		yearlyDocuments.push(document);
		documentsByYear.set(year, yearlyDocuments);
	}

	const years = [...documentsByYear.keys()].sort((left, right) =>
		right.localeCompare(left),
	);
	const baseMetadata = {
		schemaVersion: CONTENT_MANIFEST_SCHEMA_VERSION,
		source: publicSource,
		generatedAt,
	};
	const index = {
		...baseMetadata,
		documentCount: documents.length,
		excludedCount,
		latest: {
			url: "/content-manifest/latest.json",
			limit: CONTENT_MANIFEST_LATEST_LIMIT,
		},
		years: years.map((year) => ({
			year: Number(year),
			count: documentsByYear.get(year).length,
			url: `/content-manifest/years/${year}.json`,
		})),
	};
	const latestDocuments = [...documents]
		.sort(sortByLastModified)
		.slice(0, CONTENT_MANIFEST_LATEST_LIMIT);
	const latest = {
		...baseMetadata,
		limit: CONTENT_MANIFEST_LATEST_LIMIT,
		count: latestDocuments.length,
		documents: latestDocuments,
	};
	const yearly = Object.fromEntries(
		years.map((year) => [
			year,
			{
				...baseMetadata,
				year: Number(year),
				count: documentsByYear.get(year).length,
				documents: documentsByYear.get(year),
			},
		]),
	);

	return { index, latest, yearly };
}

function writeJson(filePath, value) {
	mkdirSync(path.dirname(filePath), { recursive: true });
	writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export function writeContentManifest(manifest, outputDir) {
	const resolvedOutputDir = path.resolve(outputDir);
	rmSync(resolvedOutputDir, { recursive: true, force: true });
	mkdirSync(path.join(resolvedOutputDir, "years"), { recursive: true });
	writeJson(path.join(resolvedOutputDir, "index.json"), manifest.index);
	writeJson(path.join(resolvedOutputDir, "latest.json"), manifest.latest);
	for (const [year, yearlyManifest] of Object.entries(manifest.yearly)) {
		writeJson(
			path.join(resolvedOutputDir, "years", `${year}.json`),
			yearlyManifest,
		);
	}
}
