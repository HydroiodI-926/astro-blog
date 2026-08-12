import type { RSSFeedItem } from "@astrojs/rss";
import rss from "@astrojs/rss";
import type { APIContext } from "astro";

import { siteConfig } from "@/config";
import { getSortedPosts } from "@/utils/content-utils";
import { initPostIdMap } from "@/utils/permalink-utils";
import { getPostPublicDescription } from "@/utils/post-card-content";
import { getPostUrl } from "@/utils/url-utils";

const FEED_ITEM_LIMIT = 20;

export async function GET(context: APIContext) {
	if (!context.site) {
		throw Error("site not set");
	}

	const posts = (await getSortedPosts())
		.filter((post) => !post.data.encrypted && post.data.draft !== true)
		.slice(0, FEED_ITEM_LIMIT);

	initPostIdMap(posts);

	const items: RSSFeedItem[] = posts.map((post) => ({
		title: post.data.title,
		description: getPostPublicDescription(post.data),
		pubDate: post.data.published,
		link: getPostUrl(post),
	}));

	return rss({
		title: siteConfig.title,
		description: siteConfig.subtitle || "No description",
		site: context.site,
		items,
		customData: `<language>${siteConfig.lang}</language>`,
	});
}
