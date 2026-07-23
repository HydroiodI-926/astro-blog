import sitemap from "@astrojs/sitemap";
import mdx from '@astrojs/mdx';
import { unified } from '@astrojs/markdown-remark';
import svelte, { vitePreprocess } from "@astrojs/svelte";
import { pluginCollapsibleSections } from "@expressive-code/plugin-collapsible-sections";
import { pluginLineNumbers } from "@expressive-code/plugin-line-numbers";
import swup from "@swup/astro";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, fontProviders } from "astro/config";
import expressiveCode from "astro-expressive-code";
import icon from "astro-icon";
import { oddmisc } from "oddmisc";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import rehypeComponents from "rehype-components";
import rehypeExternalLinks from "rehype-external-links";
import rehypeKatex from "rehype-katex";
import rehypeSlug from "rehype-slug";
import remarkDirective from "remark-directive";
import remarkMath from "remark-math";
import remarkSectionize from "remark-sectionize";

import { buildIconInclude } from "./src/plugins/astro-icon-include.mjs";
import { siteConfig } from "./src/config/index.ts";
import { pluginCustomCopyButton } from "./src/plugins/expressive-code/custom-copy-button.js";
import { pluginLanguageBadge } from "./src/plugins/expressive-code/language-badge.ts";
import { AdmonitionComponent } from "./src/plugins/rehype-component-admonition.mjs";
import { GithubCardComponent } from "./src/plugins/rehype-component-github-card.mjs";
import { ImageGridComponent } from "./src/plugins/rehype-component-image-grid.mjs";
import { rehypeImageWidth } from "./src/plugins/rehype-image-width.mjs";
import { rehypeMermaid } from "./src/plugins/rehype-mermaid.mjs";
import { rehypeWrapTable } from "./src/plugins/rehype-wrap-table.mjs";
import { remarkContent } from "./src/plugins/remark-content.mjs";
import { parseDirectiveNode } from "./src/plugins/remark-directive-rehype.js";
import { remarkEscapeNumericColons } from "./src/plugins/remark-escape-numeric-colons.mjs";
import { remarkFixGithubAdmonitions } from "./src/plugins/remark-fix-github-admonitions.js";
import { remarkMermaid } from "./src/plugins/remark-mermaid.js";

// https://astro.build/config
export default defineConfig({
	fonts: [
		{
			name: "JetBrains Mono",
			cssVariable: "--font-jetbrains-mono",
			provider: fontProviders.fontsource(),
			styles: ["normal", "italic"],
		},
		{
			name: "ZenMaruGothic-Medium",
			cssVariable: "--font-body",
			provider: fontProviders.local(),
			options: {
				variants: [
					{
						src: ["./src/assets/fonts/ZenMaruGothic-Medium.ttf"],
						weight: "500",
						style: "normal",
					},
				],
			},
			// These variables are composed into --font-sans below. Keep their
			// fallback lists empty; otherwise a system fallback after this Latin
			// font prevents the following CJK font from ever being considered.
			fallbacks: [],
			optimizedFallbacks: false,
		},
		{
			name: "Loli",
			cssVariable: "--font-cjk",
			provider: fontProviders.local(),
			options: {
				variants: [
					{
						src: ["./src/assets/fonts/loli.ttf"],
						weight: "400",
						style: "normal",
					},
				],
			},
			// The final system fallback belongs to --font-sans, not this partial
			// CJK font stack.
			fallbacks: [],
			optimizedFallbacks: false,
		},
	],

	site: siteConfig.siteURL,
	base: "/",
	trailingSlash: "always",
	compressHTML: true,

	output: "static",

	image: {
		layout: "constrained",
	},

	server: {
		port: 3000,
	},

	integrations: [
		oddmisc({
			umami: {
				shareUrl: false,
			},
		}),
		swup({
			theme: false,
			animationClass: "transition-swup-",
			containers: ["main"],
			smoothScrolling: false, // 绂佺敤骞虫粦婊氬姩浠ユ彁鍗囨€ц兘锛岄伩鍏嶄笌閿氱偣瀵艰埅鍐茬獊
			cache: true,
			preload: false, // 绂佺敤棰勫姞杞戒互鎻愬崌鎬ц兘
			accessibility: true,
			updateHead: process.env.NODE_ENV === "production",
			updateBodyClass: false,
			globalInstance: true,
			// 婊氬姩鐩稿叧閰嶇疆浼樺寲
			resolveUrl: (url) => url,
			animateHistoryBrowsing: false,
			skipPopStateHandling: (event) => {
				// 璺宠繃閿氱偣閾炬帴鐨勫鐞嗭紝璁╂祻瑙堝櫒鍘熺敓澶勭悊
				return (
					event.state &&
					event.state.url &&
					event.state.url.includes("#")
				);
			},
		}),
		icon({
			include: buildIconInclude(),
		}),
		expressiveCode({
			themes: ["github-light", "github-dark"],
			plugins: [
				pluginCollapsibleSections(),
				pluginLineNumbers(),
				pluginLanguageBadge(),
				pluginCustomCopyButton(),
			],
			defaultProps: {
				wrap: true,
				overridesByLang: {
					shellsession: { showLineNumbers: false },
					bash: { frame: "code" },
					shell: { frame: "code" },
					sh: { frame: "code" },
					zsh: { frame: "code" },
				},
			},
			styleOverrides: {
				codeBackground: "var(--codeblock-bg)",
				borderRadius: "0.75rem",
				borderColor: "none",
				codeFontSize: "0.875rem",
				codeFontFamily:
					"var(--font-jetbrains-mono), SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
				codeLineHeight: "1.5rem",
				frames: {
					editorBackground: "var(--codeblock-bg)",
					terminalBackground: "var(--codeblock-bg)",
					terminalTitlebarBackground: "var(--codeblock-bg)",
					editorTabBarBackground: "var(--codeblock-bg)",
					editorActiveTabBackground: "none",
					editorActiveTabIndicatorBottomColor: "var(--primary)",
					editorActiveTabIndicatorTopColor: "none",
					editorTabBarBorderBottomColor: "var(--codeblock-bg)",
					terminalTitlebarBorderBottomColor: "none",
				},
				textMarkers: {
					delHue: 0,
					insHue: 180,
					markHue: 250,
				},
			},
			frames: {
				showCopyToClipboardButton: false,
			},
		}),
		svelte({
			preprocess: vitePreprocess(),
		}),
		sitemap(),
		mdx(),
	],
	markdown: {
		processor: unified({
			remarkPlugins: [
				remarkMath,
				remarkContent,
				remarkFixGithubAdmonitions,
				remarkDirective,
				remarkEscapeNumericColons,
				remarkSectionize,
				parseDirectiveNode,
				remarkMermaid,
			],
			rehypePlugins: [
				rehypeKatex,
				[
					rehypeExternalLinks,
					{
						target: "_blank",
						rel: ["nofollow", "noopener", "noreferrer"],
					},
				],
				rehypeSlug,
				rehypeWrapTable,
				rehypeMermaid,
				[
					rehypeComponents,
					{
						components: {
							github: GithubCardComponent,
							grid: ImageGridComponent,
							note: (x, y) => AdmonitionComponent(x, y, "note"),
							tip: (x, y) => AdmonitionComponent(x, y, "tip"),
							important: (x, y) =>
								AdmonitionComponent(x, y, "important"),
							caution: (x, y) => AdmonitionComponent(x, y, "caution"),
							warning: (x, y) => AdmonitionComponent(x, y, "warning"),
						},
					},
				],
				[
					rehypeAutolinkHeadings,
					{
						behavior: "append",
						properties: {
							className: ["anchor"],
						},
						content: {
							type: "element",
							tagName: "span",
							properties: {
								className: ["anchor-icon"],
								"data-pagefind-ignore": true,
							},
							children: [{ type: "text", value: "#" }],
						},
					},
				],
				rehypeImageWidth,
			],
		}),
	},
	vite: {
		plugins: [tailwindcss()],
		// 寮€鍙戠幆澧冮鎵撳寘浼樺寲锛氬皢甯哥敤渚濊禆鎻愬墠缂栬瘧锛岄伩鍏嶉娆￠〉闈㈠姞杞芥椂 on-demand 缂栬瘧瀵艰嚧 8s+ 鐨勭瓑寰?		optimizeDeps: {
			include: [
				"@iconify/svelte",
				"svelte",
				"svelte/transition",
				"svelte/easing",
				"overlayscrollbars",
				"@fancyapps/ui",
				"marked",
				"sanitize-html",
				"qrcode",
			],
		},
		// 棰勭儹甯哥敤鍏ュ彛鏂囦欢锛岃 Vite 鍦ㄦ湇鍔″櫒鍚姩鍚庣珛鍗冲紑濮嬭浆鎹紝鑰屼笉鏄瓑鍒版祻瑙堝櫒璇锋眰
		server: {
			warmup: {
				clientFiles: [
					"src/layouts/Layout.astro",
					"src/pages/index.astro",
					"src/components/widgets/music-player/MusicPlayer.svelte",
					"src/components/organisms/navigation/Search.svelte",
					"src/components/control/ThemeSwitch.svelte",
					"src/components/features/settings/DisplaySettings.svelte",
					"src/scripts/swup-manager.ts",
				],
			},
		},
		build: {
			// 闈欐€佽祫婧愬鐞嗕紭鍖栵紝闃叉灏忓浘鐗囪浆 base64 瀵艰嚧 HTML 浣撶Н杩囧ぇ
			assetsInlineLimit: 4096,
			// CSS 浠ｇ爜鍒嗗壊
			cssCodeSplit: true,
			cssMinify: "esbuild",
			// 鍐呰仈灏忓瀷 CSS 鏂囦欢浠ュ噺灏戠綉缁滆姹?			inlineStylesheets: "auto",
			// 鐢熶骇鐜绉婚櫎 console 鍜?debugger
			minify: "esbuild",
			rollupOptions: {
				onwarn(warning, warn) {
					if (
						warning.message.includes(
							"is dynamically imported by",
						) &&
						warning.message.includes(
							"but also statically imported by",
						)
					) {
						return;
					}
					warn(warning);
				},
			},
		},
		// 鐢熶骇鐜绉婚櫎 console.log 鍜?debugger
		esbuildOptions: {
			drop:
				process.env.NODE_ENV === "production"
					? ["console", "debugger"]
					: [],
		},
	},
});
