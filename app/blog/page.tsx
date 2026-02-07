import type { Metadata } from "next";
import PostsClient from "@/components/posts-csr";
import { getAllPosts } from "@/lib/get-posts";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://jaycebordelon.com";

export const metadata: Metadata = {
	title: "Blog",
	description:
		"Notes on software engineering, system design, and building things that work. Writing about distributed systems, full-stack development, and lessons learned.",
	openGraph: {
		title: "Blog | Jayce Bordelon",
		description:
			"Notes on software engineering, system design, and building things that work.",
		url: `${siteUrl}/blog`,
		type: "website",
	},
	twitter: {
		card: "summary_large_image",
		title: "Blog | Jayce Bordelon",
		description:
			"Notes on software engineering, system design, and building things that work.",
	},
	alternates: {
		canonical: `${siteUrl}/blog`,
	},
};

export default function PostsPage() {
	const posts = getAllPosts();

	return <PostsClient posts={posts} />;
}
