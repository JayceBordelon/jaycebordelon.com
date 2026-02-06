import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";

export interface PostMetaData {
  id: string;
  title: string;
  summary: string;
  label: string;
  author: string;
  authorDesc?: string;
  published: string;
  image: string;
  readTime?: string;
  tags?: string[];
}

const postsDirectory = path.join(process.cwd(), "content");

export function getAllPosts(): PostMetaData[] {
  const fileNames = fs.readdirSync(postsDirectory);
  const mdxFiles = fileNames.filter((fileName) => fileName.endsWith(".mdx"));

  const posts = mdxFiles.map((fileName) => {
    const id = fileName.replace(/\.mdx$/, "");

    const fullPath = path.join(postsDirectory, fileName);
    const fileContents = fs.readFileSync(fullPath, "utf8");

    const { data } = matter(fileContents);

    return {
      id,
      title: data.title,
      summary: data.summary,
      label: data.label,
      author: data.author,
      authorDesc: data.authorDesc,
      published: data.published,
      image: data.image,
      readTime: data.readTime,
      tags: data.tags,
    } as PostMetaData;
  });

  return posts.sort((a, b) => {
    if (a.published < b.published) {
      return 1;
    } else {
      return -1;
    }
  });
}

export function getPostById(id: string): PostMetaData | undefined {
  const posts = getAllPosts();
  return posts.find((post) => post.id === id);
}

export function getPostIds(): string[] {
  const fileNames = fs.readdirSync(postsDirectory);
  return fileNames.filter((fileName) => fileName.endsWith(".mdx")).map((fileName) => fileName.replace(/\.mdx$/, ""));
}
