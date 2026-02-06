"use client";

import { IconBrandGithub, IconBrandLinkedin, IconWritingFilled } from "@tabler/icons-react";
import { FileText } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export default function Header() {
  const router = useRouter();
  const pathname = usePathname();
  const isBlogPage = pathname?.startsWith("/blog");

  return (
    <header className={isBlogPage ? "fixed top-0 z-50 w-full py-4 bg-background" : "fixed top-0 z-50 w-full py-4 bg-transparent"}>
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6">
        <button type="button" onClick={() => router.push("/")} className="flex items-center transition-opacity hover:opacity-80">
          <Image src="/images/logo.png" alt="Jayce Bordelon" width={48} height={48} className="cursor-pointer" />
        </button>

        <nav className="flex items-center gap-4">
          {isBlogPage ? (
            <>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button size="icon" asChild className="cursor-pointer">
                    <Link href="https://github.com/JayceBordelon" target="_blank" rel="noopener noreferrer">
                      <IconBrandGithub className="h-4 w-4" />
                    </Link>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>GitHub</p>
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button size="icon" asChild className="cursor-pointer">
                    <Link href="https://linkedin.com/in/JayceBordelon" target="_blank" rel="noopener noreferrer">
                      <IconBrandLinkedin className="h-4 w-4" />
                    </Link>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>LinkedIn</p>
                </TooltipContent>
              </Tooltip>
            </>
          ) : (
            <>
              <Button variant="outline" size="sm" asChild>
                <Link href="/blog">
                  Blog
                  <IconWritingFilled className="ml-1.5 h-3 w-3" />
                </Link>
              </Button>

              <Button size="sm" asChild>
                <Link href="/Resume.pdf" target="_blank" rel="noopener noreferrer">
                  <FileText className="mr-1.5 h-4 w-4" />
                  Resume
                </Link>
              </Button>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
