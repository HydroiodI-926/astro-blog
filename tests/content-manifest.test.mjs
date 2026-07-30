import assert from "node:assert/strict";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import {
	buildContentManifest,
	writeContentManifest,
} from "../src/utils/content-manifest.js";

const fixtureRoot = path.join(tmpdir(), `mizuki-manifest-${process.pid}`);
const postsDir = path.join(fixtureRoot, "src", "content", "posts");
const source = {
	repository: "owner/notes",
	branch: "main",
	commit: "6c81f96c81f96c81f96c81f96c81f96c81f96c8",
	sourceRoot: fixtureRoot,
};

function writeFixture(relativePath, content) {
	const filePath = path.join(fixtureRoot, relativePath);
	mkdirSync(path.dirname(filePath), { recursive: true });
	writeFileSync(filePath, content, "utf8");
}

before(() => {
	rmSync(fixtureRoot, { recursive: true, force: true });
	writeFixture(
		"src/content/posts/algorithm/dp.md",
		`---
title: 动态规划笔记
published: 2026-07-28
updated: 2026-07-30
description: 动态规划基本模型
image: ./cover.webp
tags: [算法, 动态规划]
category: 算法
alias: algorithm/dynamic-programming
---
![状态图](./images/state.png)
![参考图][diagram]
<img src="https://cdn.example.com/remote.png" alt="远程图片">

[diagram]: /images/shared.png

\`\`\`md
![代码示例不应统计](./fake.png)
\`\`\`
`,
	);
	writeFixture("src/content/posts/algorithm/cover.webp", "cover");
	writeFixture("src/content/posts/algorithm/images/state.png", "state");
	writeFixture("public/images/shared.png", "shared");
	writeFixture(
		"src/content/posts/legacy.md",
		`---
title: 旧文章
published: 2025-12-31
updated: 2026-07-31
permalink: knowledge/legacy
---
正文
`,
	);
	writeFixture(
		"src/content/posts/2024 Guide/index.md",
		`---
title: 路由规范化示例
published: 2024-04-01
---
正文
`,
	);
	writeFixture(
		"src/content/posts/draft.md",
		`---
title: 草稿
published: 2026-01-01
draft: true
---
`,
	);
	writeFixture(
		"src/content/posts/secret.md",
		`---
title: 加密文章
published: 2026-01-02
encrypted: true
---
`,
	);
});

after(() => {
	rmSync(fixtureRoot, { recursive: true, force: true });
});

describe("buildContentManifest", () => {
	it("按年份拆分公开文章，并排除草稿和加密文章", () => {
		const manifest = buildContentManifest({
			projectRoot: fixtureRoot,
			postsDir,
			source,
			now: "2026-07-30T10:00:00Z",
		});

		assert.equal(manifest.index.documentCount, 3);
		assert.equal(manifest.index.excludedCount, 2);
		assert.deepEqual(
			manifest.index.years.map(({ year, count }) => ({ year, count })),
			[
				{ year: 2026, count: 1 },
				{ year: 2025, count: 1 },
				{ year: 2024, count: 1 },
			],
		);
		assert.equal(manifest.yearly["2026"].documents[0].title, "动态规划笔记");
		assert.equal(manifest.yearly["2024"].documents[0].slug, "2024-guide");
		assert.equal(
			manifest.yearly["2024"].documents[0].url,
			"/posts/2024-guide/",
		);
		assert.equal(manifest.latest.documents[0].title, "旧文章");
	});

	it("生成稳定 ID、正文哈希、路由和可拉取的资源地址", () => {
		const first = buildContentManifest({
			projectRoot: fixtureRoot,
			postsDir,
			source,
		});
		const document = first.yearly["2026"].documents[0];

		assert.match(document.id, /^sha256:[a-f\d]{64}$/);
		assert.match(document.contentHash, /^sha256:[a-f\d]{64}$/);
		assert.equal(document.slug, "algorithm/dynamic-programming");
		assert.equal(document.url, "/posts/algorithm/dynamic-programming/");
		assert.equal(document.sourcePath, "src/content/posts/algorithm/dp.md");
		assert.match(
			document.sourceUrl,
			/^https:\/\/raw\.githubusercontent\.com\//,
		);
		assert.deepEqual(
			document.assets.map(({ type, source, exists }) => ({
				type,
				source,
				exists,
			})),
			[
				{ type: "cover", source: "./cover.webp", exists: true },
				{ type: "image", source: "./images/state.png", exists: true },
				{ type: "image", source: "/images/shared.png", exists: true },
				{
					type: "image",
					source: "https://cdn.example.com/remote.png",
					exists: null,
				},
			],
		);

		writeFixture(
			"src/content/posts/algorithm/dp.md",
			readFileSync(path.join(postsDir, "algorithm", "dp.md"), "utf8") +
				"\n新增正文\n",
		);
		const second = buildContentManifest({
			projectRoot: fixtureRoot,
			postsDir,
			source,
		});
		const changedDocument = second.yearly["2026"].documents[0];
		assert.equal(changedDocument.id, document.id);
		assert.notEqual(changedDocument.contentHash, document.contentHash);
	});

	it("可写出索引、最新文章和年份分片", () => {
		const manifest = buildContentManifest({
			projectRoot: fixtureRoot,
			postsDir,
			source,
		});
		const outputDir = path.join(fixtureRoot, "output");
		writeContentManifest(manifest, outputDir);

		assert.equal(
			JSON.parse(readFileSync(path.join(outputDir, "index.json"), "utf8"))
				.documentCount,
			3,
		);
		assert.equal(
			JSON.parse(readFileSync(path.join(outputDir, "latest.json"), "utf8"))
				.count,
			3,
		);
		assert.equal(
			JSON.parse(
				readFileSync(path.join(outputDir, "years", "2026.json"), "utf8"),
			).year,
			2026,
		);
	});
});
