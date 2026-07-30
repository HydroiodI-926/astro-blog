# 内容清单接口

项目会为公开文章生成版本化 JSON 内容清单，供其他 Astro、Hugo、Hexo 或任意静态博客在构建阶段拉取。

## 更新时机

- `pnpm build` 构建 Astro 时，清单路由会随网站一起重新生成。
- GitHub Pages 上的清单对应最近一次成功部署的内容。
- `pnpm manifest` 可单独生成一份本地检查结果，默认写入 `.tmp/content-manifest/`。
- `pnpm manifest -- --output <目录>` 可以指定项目内的其他输出目录。

清单不需要提交到 Git。开发服务器会直接读取当前 Markdown 文件，因此刷新接口即可看到本地更新。

## 接口

| 路径 | 内容 |
| --- | --- |
| `/content-manifest/index.json` | 来源版本、文章总数和年份索引 |
| `/content-manifest/latest.json` | 按 `lastmod` 排序的最近 50 篇文章 |
| `/content-manifest/years/<年份>.json` | 按 `published` 年份拆分的文章清单 |

文章以 `published` 所在年份归档。修改旧文章只会更新 `lastmod`，不会把它移动到修改年份。

## 发布规则

公开清单只包含同时满足以下条件的文章：

```text
draft !== true && encrypted !== true
```

`index.json` 的 `excludedCount` 会记录被排除的草稿和加密文章数量，但不会泄露它们的标题、标签或资源路径。

## 文档字段

```json
{
  "id": "sha256:...",
  "sourcePath": "src/content/posts/guide/index.md",
  "sourceUrl": "https://raw.githubusercontent.com/.../index.md",
  "contentHash": "sha256:...",
  "title": "文章标题",
  "slug": "guide",
  "url": "/posts/guide/",
  "date": "2026-07-28",
  "lastmod": "2026-07-30",
  "tags": ["Astro"],
  "category": "开发",
  "lang": "zh-CN",
  "draft": false,
  "summary": "文章摘要",
  "assets": [],
  "publish": true
}
```

- `id` 根据来源仓库和规范化文件路径生成；正文变化不改变 ID，文件改名会产生新 ID。
- `contentHash` 是 Markdown 原始字节的 SHA-256，可用于增量同步。
- `slug` 和 `url` 遵循 `permalink > alias > 文件路径` 的优先级。
- `lastmod` 优先使用 frontmatter 的 `updated`，没有时回退到 `published`。
- `summary` 对应 frontmatter 的 `description`，不会擅自截取正文。
- `sourceUrl` 只有在来源提交是干净、可定位的 Git commit 时才生成。本地文章存在未提交修改时为 `null`，避免链接到与清单哈希不一致的旧正文。

## 资源字段

生成器会统计 frontmatter 的 `image`、Markdown 图片、引用式 Markdown 图片和 HTML `<img>`。围栏代码块里的示例不会被统计。

```json
{
  "type": "cover",
  "source": "./cover.webp",
  "sourcePath": "src/content/posts/guide/cover.webp",
  "target": "https://raw.githubusercontent.com/.../cover.webp",
  "url": "https://raw.githubusercontent.com/.../cover.webp",
  "external": false,
  "exists": true
}
```

- `source` 是文章中的原始引用。
- `sourcePath` 是资源在来源仓库中的路径。
- `url` 是可拉取地址；`public` 绝对路径保留为站内路径，相对资源优先生成 GitHub Raw 地址。
- `target` 是消费方应拉取的目标；无法生成 URL 时回退为 `sourcePath`。
- `exists` 用于发现失效的本地资源。远程资源不会在构建时联网探测，因此值为 `null`。

## 来源覆盖

生成器通常自动读取当前内容所在 Git 仓库。必要时可使用以下环境变量覆盖：

```bash
CONTENT_MANIFEST_REPOSITORY=owner/notes
CONTENT_MANIFEST_BRANCH=main
CONTENT_MANIFEST_COMMIT=完整Git提交哈希
```

托管平台支持 `_headers` 文件时，项目会为清单添加跨域 GET 响应头。其他静态博客更推荐在构建阶段拉取，此方式不受浏览器 CORS 限制。
