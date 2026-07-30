import path from "node:path";
import { fileURLToPath } from "node:url";
import {
	buildContentManifest,
	writeContentManifest,
} from "../src/utils/content-manifest.js";
import { loadEnv } from "./load-env.js";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, "..");

function readOutputArgument(arguments_) {
	const outputIndex = arguments_.findIndex(
		(argument) => argument === "--output" || argument === "-o",
	);
	if (outputIndex === -1) return path.join(projectRoot, ".tmp", "content-manifest");
	const output = arguments_[outputIndex + 1];
	if (!output) throw new Error("--output 需要提供目录路径");
	return path.resolve(projectRoot, output);
}

function assertSafeOutputPath(outputDir) {
	const relative = path.relative(projectRoot, outputDir);
	if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
		throw new Error("输出目录必须位于项目目录内，且不能是项目根目录");
	}
}

loadEnv();

const outputDir = readOutputArgument(process.argv.slice(2));
assertSafeOutputPath(outputDir);
const manifest = buildContentManifest({ projectRoot });
writeContentManifest(manifest, outputDir);

console.log(`内容清单已生成：${outputDir}`);
console.log(
	`公开文章 ${manifest.index.documentCount} 篇，排除草稿或加密文章 ${manifest.index.excludedCount} 篇`,
);
