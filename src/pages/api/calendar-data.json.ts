import { getSortedPosts } from "../../utils/content-utils";
import { getPostUpdatedAt } from "../../utils/post-git-activity";

export async function GET() {
	const posts = await getSortedPosts();

	const formatDate = (date: Date) =>
		new Intl.DateTimeFormat("en-CA", {
			timeZone: "Asia/Shanghai",
			year: "numeric",
			month: "2-digit",
			day: "2-digit",
		}).format(date);

	const allPostsData = posts.map((post) => {
		const updatedAt = getPostUpdatedAt({
			filePath: post.filePath,
			publishedAt: post.data.published,
			explicitUpdatedAt: post.data.updated,
		});

		return {
			id: post.id,
			title: post.data.title,
			date: formatDate(new Date(post.data.published)),
			updated: updatedAt ? formatDate(new Date(updatedAt)) : undefined,
		};
	});

	return new Response(JSON.stringify(allPostsData), {
		headers: {
			"Content-Type": "application/json",
			"X-Robots-Tag": "noindex, nofollow",
		},
	});
}
