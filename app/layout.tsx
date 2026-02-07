import type { Metadata } from "next";

import "./globals.css";
import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";
import Header from "@/components/header";
import { BackgroundPaths } from "@/components/ui/shadcn-io/background-paths";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://jaycebordelon.com";

export const metadata: Metadata = {
	metadataBase: new URL(siteUrl),
	title: {
		default: "Jayce Bordelon | Software Engineer",
		template: "%s | Jayce Bordelon",
	},
	description:
		"Software engineer with a focus on distributed systems and full-stack development. I build tools that solve real problems and write about what I learn along the way.",
	keywords: [
		"Jayce Bordelon",
		"Software Engineer",
		"Full Stack Developer",
		"Distributed Systems",
		"Backend Engineering",
		"React",
		"Next.js",
		"TypeScript",
		"Java",
		"Spring Boot",
		"Microservices",
		"Kubernetes",
		"Docker",
		"System Design",
		"Technical Writing",
		"St. Louis",
		"Washington University",
	],
	authors: [{ name: "Jayce Bordelon", url: siteUrl }],
	creator: "Jayce Bordelon",
	openGraph: {
		type: "website",
		locale: "en_US",
		url: siteUrl,
		title: "Jayce Bordelon | Software Engineer",
		description:
			"Software engineer building distributed systems and full-stack applications. Writing about engineering problems and the occasional solution.",
		siteName: "Jayce Bordelon",
		images: [
			{
				url: "/images/dawg.jpg",
				width: 1200,
				height: 630,
				alt: "Jayce Bordelon",
			},
		],
	},
	twitter: {
		card: "summary_large_image",
		title: "Jayce Bordelon | Software Engineer",
		description:
			"Software engineer focused on distributed systems and full-stack development.",
		images: ["/images/dawg.jpg"],
		creator: "@JayceBordelon",
	},
	robots: {
		index: true,
		follow: true,
		googleBot: {
			index: true,
			follow: true,
			"max-video-preview": -1,
			"max-image-preview": "large",
			"max-snippet": -1,
		},
	},
	alternates: {
		canonical: siteUrl,
	},
};

const jsonLd = {
	"@context": "https://schema.org",
	"@type": "Person",
	name: "Jayce Bordelon",
	url: siteUrl,
	jobTitle: "Software Engineer",
	alumniOf: {
		"@type": "CollegeOrUniversity",
		name: "Washington University in St. Louis",
	},
	knowsAbout: [
		"Distributed Systems",
		"Full Stack Development",
		"Microservices",
		"System Design",
	],
	sameAs: [
		"https://github.com/jaycebordelon",
		"https://linkedin.com/in/jaycebordelon",
	],
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="en" suppressHydrationWarning>
			<head>
				<script
					type="application/ld+json"
					// biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD structured data
					dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
				/>
			</head>
			<body>
				<ThemeProvider
					attribute="class"
					defaultTheme="system"
					enableSystem={true}
				>
					<Header />
					{children}
					<BackgroundPaths />
					<Toaster theme="system" richColors />
				</ThemeProvider>
			</body>
		</html>
	);
}
