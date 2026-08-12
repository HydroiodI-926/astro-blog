import type { APIContext } from "astro";

import { profileConfig, siteConfig } from "@/config";
import { getSortedPosts } from "@/utils/content-utils";
import { initPostIdMap } from "@/utils/permalink-utils";
import { getPostPublicDescription } from "@/utils/post-card-content";
import { getPostUrl } from "@/utils/url-utils";

const FEED_ITEM_LIMIT = 20;

function escapeXml(value: string): string {
	return value.replace(/[&<>"']/g, (character) => {
		const entities: Record<string, string> = {
			"&": "&amp;",
			"<": "&lt;",
			">": "&gt;",
			'"': "&quot;",
			"'": "&apos;",
		};
		return entities[character];
	});
}

export async function GET(context: APIContext) {
	if (!context.site) {
		throw Error("site not set");
	}

	const posts = (await getSortedPosts())
		.filter((post) => !post.data.encrypted && post.data.draft !== true)
		.slice(0, FEED_ITEM_LIMIT);

	initPostIdMap(posts);

	const entries = posts
		.map((post) => {
			const postUrl = new URL(getPostUrl(post), context.site).href;
			const category = post.data.category
				? `\n    <category term="${escapeXml(post.data.category)}"></category>`
				: "";

			return `
  <entry>
    <title>${escapeXml(post.data.title)}</title>
    <link href="${escapeXml(postUrl)}" rel="alternate" type="text/html"/>
    <id>${escapeXml(postUrl)}</id>
    <published>${post.data.published.toISOString()}</published>
    <updated>${(post.data.updated ?? post.data.published).toISOString()}</updated>
    <summary type="text">${escapeXml(getPostPublicDescription(post.data))}</summary>
    <author>
      <name>${escapeXml(profileConfig.name)}</name>
    </author>${category}
  </entry>`;
		})
		.join("");

	const atomFeed = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>${escapeXml(siteConfig.title)}</title>
  <subtitle>${escapeXml(siteConfig.subtitle || "No description")}</subtitle>
  <link href="${escapeXml(context.site.href)}" rel="alternate" type="text/html"/>
  <link href="${escapeXml(new URL("atom.xml", context.site).href)}" rel="self" type="application/atom+xml"/>
  <id>${escapeXml(context.site.href)}</id>
  <updated>${new Date().toISOString()}</updated>
  <language>${escapeXml(siteConfig.lang)}</language>${entries}
</feed>`;

	return new Response(atomFeed, {
		headers: {
			"Content-Type": "application/atom+xml; charset=utf-8",
		},
	});
}
