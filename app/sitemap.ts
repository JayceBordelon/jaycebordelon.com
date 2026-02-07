import type { MetadataRoute } from "next";
import { getAllPosts } from "@/lib/get-posts";

export default function sitemap(): MetadataRoute.Sitemap {
	const siteUrl =
		process.env.NEXT_PUBLIC_SITE_URL || "https://jaycebordelon.com";
	const posts = getAllPosts();

	const blogPosts = posts.map((post) => ({
		url: `${siteUrl}/blog/posts/${post.id}`,
		lastModified: new Date(post.published),
		changeFrequency: "monthly" as const,
		priority: 0.7,
	}));

	return [
		{
			url: siteUrl,
			lastModified: new Date(),
			changeFrequency: "monthly",
			priority: 1,
		},
		{
			url: `${siteUrl}/blog`,
			lastModified: new Date(),
			changeFrequency: "weekly",
			priority: 0.8,
		},
		...blogPosts,
	];
}
