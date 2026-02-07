import { ArrowLeft, Calendar, Clock } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { getPostById, getPostIds } from "@/lib/get-posts";

export async function generateStaticParams() {
	const ids = getPostIds();
	return ids.map((id) => ({
		id,
	}));
}

export async function generateMetadata({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
	const { id } = await params;
	const post = getPostById(id);

	if (!post) return {};

	const baseUrl =
		process.env.NEXT_PUBLIC_SITE_URL || "https://jaycebordelon.com";
	const postUrl = `${baseUrl}/blog/${id}`;
	const imageUrl = post.image
		? `${baseUrl}${post.image}`
		: `${baseUrl}/images/og-default.png`;

	return {
		title: post.title,
		description: post.summary,
		authors: [{ name: post.author }],
		keywords: post.tags || [],

		openGraph: {
			title: post.title,
			description: post.summary,
			type: "article",
			url: postUrl,
			publishedTime: post.published
				? new Date(post.published).toISOString()
				: undefined,
			authors: [post.author],
			tags: post.tags || [],
			images: [
				{
					url: imageUrl,
					width: 1200,
					height: 630,
					alt: post.title,
				},
			],
		},

		// Twitter Card metadata
		twitter: {
			card: "summary_large_image",
			title: post.title,
			description: post.summary,
			images: [imageUrl],
			creator: "@JayceBordelon",
		},

		// Canonical URL
		alternates: {
			canonical: postUrl,
		},

		other: {
			"article:published_time": post.published
				? new Date(post.published).toISOString()
				: undefined,
			"article:author": post.author,
			"article:section": post.label || "Blog",
			"article:tag": post.tags?.join(", ") || undefined,
		},
	};
}

export default async function PostPage({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
	const { id } = await params;
	const post = getPostById(id);

	if (!post) {
		notFound();
	}

	const PostContent = (await import(`@/content/${id}.mdx`)).default;
	const baseUrl =
		process.env.NEXT_PUBLIC_SITE_URL || "https://jaycebordelon.com";

	const jsonLd = {
		"@context": "https://schema.org",
		"@type": "Article",
		headline: post.title,
		description: post.summary,
		author: {
			"@type": "Person",
			name: post.author,
			url: baseUrl,
		},
		datePublished: post.published,
		image: post.image ? `${baseUrl}${post.image}` : undefined,
		url: `${baseUrl}/blog/posts/${id}`,
		publisher: {
			"@type": "Person",
			name: "Jayce Bordelon",
			url: baseUrl,
		},
	};

	return (
		<div className="min-h-screen">
			<script
				type="application/ld+json"
				// biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD structured data
				dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
			/>
			{/* Back button */}
			<div className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
				<div className="container mx-auto px-4 lg:px-16 py-4">
					<Link
						href="/blog"
						className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
					>
						<ArrowLeft className="h-4 w-4" />
						Back to posts
					</Link>
				</div>
			</div>

			<article className="container mx-auto px-4 lg:px-16 py-16 max-w-4xl">
				{/* Header */}
				<header className="mb-12 space-y-6">
					{/* Label */}
					<div>
						<Badge variant="secondary" className="text-sm">
							{post.label}
						</Badge>
					</div>

					{/* Title */}
					<h1 className="font-serif text-5xl md:text-6xl font-bold tracking-tight text-foreground leading-tight">
						{post.title}
					</h1>

					{/* Summary */}
					<p className="text-xl text-muted-foreground leading-relaxed">
						{post.summary}
					</p>

					{/* Author and metadata */}
					<div className="flex flex-wrap items-center gap-4 pt-4 border-t border-border">
						<div className="flex items-center gap-3">
							<Avatar className="h-10 w-10">
								<AvatarFallback className="bg-primary text-primary-foreground">
									{post.author
										.split(" ")
										.map((n) => n[0])
										.join("")}
								</AvatarFallback>
							</Avatar>
							<div className="flex flex-col">
								<span className="font-semibold text-foreground text-sm">
									{post.author}
								</span>
								{post.authorDesc && (
									<span className="text-xs text-muted-foreground">
										{post.authorDesc}
									</span>
								)}
							</div>
						</div>

						<span className="text-muted-foreground">•</span>

						<div className="flex items-center gap-1.5 text-sm text-muted-foreground">
							<Calendar className="h-4 w-4" />
							<time dateTime={post.published}>
								{new Date(`${post.published}T12:00:00`).toLocaleDateString(
									"en-US",
									{
										year: "numeric",
										month: "long",
										day: "numeric",
									},
								)}
							</time>
						</div>

						{post.readTime && (
							<>
								<span className="text-muted-foreground">•</span>
								<div className="flex items-center gap-1.5 text-sm text-muted-foreground">
									<Clock className="h-4 w-4" />
									<span>{post.readTime}</span>
								</div>
							</>
						)}
					</div>

					{/* Tags */}
					{post.tags && post.tags.length > 0 && (
						<div className="flex flex-wrap gap-2 pt-2">
							{post.tags.map((tag) => (
								<Badge key={tag} variant="outline" className="text-xs">
									{tag}
								</Badge>
							))}
						</div>
					)}
				</header>

				{/* MDX Content */}
				<div className="prose prose-lg max-w-none">
					<PostContent />
				</div>

				{/* Footer */}
				<footer className="mt-16 pt-8 border-t border-border">
					<Link
						href="/blog"
						className="inline-flex items-center gap-2 text-primary hover:underline underline-offset-4 font-medium"
					>
						<ArrowLeft className="h-4 w-4" />
						Back to all posts
					</Link>
				</footer>
			</article>
		</div>
	);
}
