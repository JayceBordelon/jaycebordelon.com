"use client";

import { IconBrandGithub, IconBrandLinkedin, IconCalendar, IconWriting } from "@tabler/icons-react";
import { motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import TypingText from "@/components/ui/shadcn-io/typing-text";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export default function HeroSection() {
  const socialLinks = [
    {
      icon: IconCalendar,
      label: "Meet With Me",
      href: "https://calendly.com/jayce-occupai/30min",
      external: true,
    },
    {
      icon: () => <Image width={20} height={20} src="/images/occy.png" alt="occy" />,
      label: "OccupAI",
      href: "https://occupai.us",
      external: true,
    },
    {
      icon: IconBrandGithub,
      label: "GitHub",
      href: "https://github.com/JayceBordelon",
      external: true,
    },
    {
      icon: IconBrandLinkedin,
      label: "LinkedIn",
      href: "https://linkedin.com/in/JayceBordelon",
      external: true,
    },
    { icon: IconWriting, label: "Blog", href: "/blog" },
  ];

  return (
    <section className="relative flex items-center justify-center px-4 h-screen overflow-hidden">
      <div className="relative max-w-4xl w-full flex flex-col md:flex-row items-center gap-8 md:gap-16">
        {/* Headshot with animated ring */}
        <motion.div className="shrink-0" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.6, ease: "easeOut" }}>
          <div className="relative group">
            {/* Outer glow pulse */}
            <motion.div
              className="absolute -inset-4 bg-gradient-to-r from-primary via-accent to-secondary rounded-3xl opacity-40 blur-2xl"
              animate={{
                opacity: [0.3, 0.5, 0.3],
                scale: [1, 1.02, 1],
              }}
              transition={{
                duration: 3,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            />

            {/* Gradient border with shimmer */}
            <div className="absolute -inset-[2px] rounded-2xl bg-gradient-to-br from-primary via-accent to-secondary opacity-80" />
            <motion.div
              className="absolute -inset-[2px] rounded-2xl bg-gradient-to-br from-transparent via-white/30 to-transparent"
              animate={{
                backgroundPosition: ["200% 0%", "-200% 0%"],
              }}
              transition={{
                duration: 3,
                repeat: Infinity,
                ease: "linear",
              }}
              style={{
                backgroundSize: "200% 100%",
              }}
            />

            {/* Inner background to create ring effect */}
            <div className="absolute inset-[3px] rounded-2xl bg-background" />

            <Image
              src="/images/dawg.jpg"
              alt="Jayce Bordelon"
              width={280}
              height={280}
              className="relative rounded-2xl w-44 sm:w-56 md:w-72 h-auto shadow-2xl transition-transform duration-300 group-hover:scale-[1.02]"
              priority
            />
          </div>
        </motion.div>

        {/* Content */}
        <div className="text-center md:text-left">
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.2 }}>
            <motion.span
              className="inline-block text-sm font-medium text-primary mb-2 tracking-wider uppercase"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
            >
              Software Engineer
            </motion.span>
            <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight">
              <span>Jayce</span> <span>Bordelon</span>
            </h1>
          </motion.div>

          {/* Typing Text Role */}
          <motion.div className="mt-4 h-10 sm:h-12" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}>
            <TypingText
              text={["Mastercard - SWE", "OccupAI - Co-Founder", "WashU - CS Alum"]}
              typingSpeed={60}
              pauseDuration={4000}
              deletingSpeed={40}
              showCursor={true}
              cursorClassName="h-8 w-0.5 bg-primary inline-block ml-1 animate-pulse"
              className="text-xl sm:text-2xl md:text-3xl text-muted-foreground font-light"
              variableSpeed={{ min: 50, max: 80 }}
              loop={true}
            />
          </motion.div>

          {/* Links */}
          <motion.div
            className="mt-10 flex flex-wrap items-center justify-center md:justify-start gap-3"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.5 }}
          >
            <TooltipProvider>
              {socialLinks.map((link, index) => (
                <motion.div
                  key={link.label}
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{
                    duration: 0.3,
                    delay: 0.6 + index * 0.1,
                    type: "spring",
                    stiffness: 200,
                  }}
                >
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="icon"
                        variant="outline"
                        asChild
                        className="cursor-pointer h-11 w-11 rounded-xl border-border/50 bg-background/50 backdrop-blur-sm hover:bg-primary hover:text-primary hover:border-primary hover:scale-110 transition-all duration-200 shadow-lg shadow-black/5"
                      >
                        <Link href={link.href ?? "#"} target={link.external ? "_blank" : undefined}>
                          <link.icon className="h-5 w-5" />
                        </Link>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="font-medium">
                      <p>{link.label}</p>
                    </TooltipContent>
                  </Tooltip>
                </motion.div>
              ))}
            </TooltipProvider>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
