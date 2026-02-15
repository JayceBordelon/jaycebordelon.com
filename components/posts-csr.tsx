"use client";

import { ArrowRight, Calendar, Clock } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import type { PostMetaData } from "@/lib/get-posts";

interface PostsClientProps {
  posts: PostMetaData[];
}

export default function PostsClient({ posts }: PostsClientProps) {
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  const allTags = useMemo(() => {
    const tags = new Set(posts.flatMap((post) => post.tags ?? []));
    return Array.from(tags);
  }, [posts]);

  const filteredPosts = useMemo(() => {
    return posts.filter((post) => {
      const matchesTag = !selectedTag || post.tags?.includes(selectedTag);
      return matchesTag;
    });
  }, [posts, selectedTag]);

  return (
    <section className="py-32">
      <div className="container mx-auto flex flex-col items-center gap-16 px-4 lg:px-16">
        <div className="text-center max-w-3xl">
          <h1 className="mb-4 text-4xl font-bold tracking-tight md:text-5xl lg:text-6xl">Blog Posts</h1>
          <p className="text-muted-foreground text-lg md:text-xl mb-8">
            My takes on stuff. These posts are filled with opinions ranging from technical architecture and programming to career advice and general, personal musings.
          </p>
        </div>

        {allTags.length > 0 && (
          <div className="flex flex-wrap justify-center gap-2">
            <Badge variant={selectedTag === null ? "default" : "outline"} className="cursor-pointer" onClick={() => setSelectedTag(null)}>
              All Posts
            </Badge>
            {allTags.map((tag) => (
              <Badge key={tag} variant={selectedTag === tag ? "default" : "outline"} className="cursor-pointer" onClick={() => setSelectedTag(tag)}>
                {tag}
              </Badge>
            ))}
          </div>
        )}

        <div className="w-full grid gap-6 sm:grid-cols-2 lg:grid-cols-3 lg:gap-8">
          {filteredPosts.length === 0 ? (
            <div className="col-span-full text-center py-12">
              <p className="text-muted-foreground text-lg">No posts found matching your criteria.</p>
            </div>
          ) : (
            filteredPosts.map((post) => (
              <Link key={post.id} href={`/blog/posts/${post.id}`} className="group">
                <Card className="flex flex-col overflow-hidden transition-all hover:shadow-lg h-full cursor-pointer">
                  {/* Featured Image */}
                  <div className="relative aspect-video w-full overflow-hidden">
                    <Image
                      src={post.image}
                      alt={post.title}
                      fill
                      className="object-cover transition-transform duration-300 group-hover:scale-105"
                      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                    />
                    <div className="absolute top-4 left-4">
                      <Badge variant="secondary" className="backdrop-blur-sm bg-background/80">
                        {post.label}
                      </Badge>
                    </div>
                  </div>

                  <CardHeader className="space-y-3">
                    {/* Title */}
                    <h3 className="text-xl font-semibold tracking-tight line-clamp-2 group-hover:text-primary transition-colors">{post.title}</h3>

                    {/* Metadata */}
                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                      <HoverCard openDelay={200}>
                        <HoverCardTrigger asChild>
                          <button type="button" className="flex items-center gap-2 hover:text-foreground transition-colors" onClick={(e) => e.preventDefault()}>
                            <Avatar className="h-6 w-6">
                              <AvatarFallback className="text-xs">
                                {post.author
                                  .split(" ")
                                  .map((n) => n[0])
                                  .join("")}
                              </AvatarFallback>
                            </Avatar>
                            <span className="font-medium">{post.author}</span>
                          </button>
                        </HoverCardTrigger>
                        <HoverCardContent className="w-80">
                          <div className="flex gap-4">
                            <Avatar className="h-12 w-12">
                              <AvatarFallback>
                                {post.author
                                  .split(" ")
                                  .map((n) => n[0])
                                  .join("")}
                              </AvatarFallback>
                            </Avatar>
                            <div className="space-y-1">
                              <h4 className="text-sm font-semibold">{post.author}</h4>
                              <p className="text-sm text-muted-foreground">{post.authorDesc || "Software Engineer and Blogger."}</p>
                            </div>
                          </div>
                        </HoverCardContent>
                      </HoverCard>

                      <span>•</span>

                      <div className="flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5" />
                        <time dateTime={post.published}>
                          {new Date(`${post.published}T12:00:00`).toLocaleDateString("en-US", {
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                          })}
                        </time>
                      </div>

                      {post.readTime && (
                        <>
                          <span>•</span>
                          <div className="flex items-center gap-1">
                            <Clock className="h-3.5 w-3.5" />
                            <span>{post.readTime}</span>
                          </div>
                        </>
                      )}
                    </div>

                    {/* Tags */}
                    {post.tags && post.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {post.tags.map((tag) => (
                          <Badge
                            key={tag}
                            variant="outline"
                            className="text-xs cursor-pointer hover:bg-accent"
                            onClick={(e) => {
                              e.preventDefault();
                              setSelectedTag(tag);
                            }}
                          >
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </CardHeader>

                  <CardContent className="flex-1">
                    <p className="text-muted-foreground line-clamp-3">{post.summary}</p>
                  </CardContent>

                  <CardFooter>
                    <span className="inline-flex items-center text-sm font-medium text-primary group-hover:underline underline-offset-4">
                      Read article
                      <ArrowRight className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-1" />
                    </span>
                  </CardFooter>
                </Card>
              </Link>
            ))
          )}
        </div>
      </div>
    </section>
  );
}
