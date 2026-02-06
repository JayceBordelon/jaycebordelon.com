/* eslint-disable react-hooks/purity */
"use client";

import { motion } from "framer-motion";

function FloatingPaths({ position }: { position: number }) {
  const numPaths = 80;
  const spread = 700;

  // Base positions - diagonal flow
  const diagonalOffset = 350;
  const baseLeftX = -1200 * position;
  const baseLeftY = diagonalOffset;
  const baseMidX = 0;
  const baseMidY = -100;
  const baseRightX = 1200 * position;
  const baseRightY = -diagonalOffset;

  const paths = Array.from({ length: numPaths }, (_, i) => {
    // Evenly distributed from -1 to 1
    const t = (i / (numPaths - 1)) * 2 - 1;

    // How much this path spreads (outer paths spread more)
    const spreadAmount = t * spread;

    // Stagger all three points - each path has its own start, flip, and end position
    const staggerX = t * 150;
    const staggerY = t * 100;

    const pathLeftX = baseLeftX + staggerX;
    const pathLeftY = baseLeftY + staggerY;
    // New quarter-left convergence point
    const pathQuarterX = baseLeftX * 0.5 + staggerX * 0.7;
    const pathQuarterY = baseLeftY * 0.6 + baseMidY * 0.4 + staggerY * 0.8;
    const pathMidX = baseMidX + staggerX;
    const pathMidY = baseMidY + staggerY * 0.5;
    const pathRightX = baseRightX + staggerX;
    const pathRightY = baseRightY + staggerY * 1.5;

    // Spread control points - now 3 bends
    const spreadLeftX = (pathLeftX + pathQuarterX) / 2;
    const spreadLeftY = (pathLeftY + pathQuarterY) / 2 - spreadAmount * 0.6;
    const spread1X = (pathQuarterX + pathMidX) / 2;
    const spread1Y = (pathQuarterY + pathMidY) / 2 + spreadAmount;
    const spread2X = (pathMidX + pathRightX) / 2;
    const spread2Y = (pathMidY + pathRightY) / 2 - spreadAmount;

    // Wave pattern - each path independently positioned
    return {
      id: i,
      t,
      d: `M${pathLeftX} ${pathLeftY} Q${spreadLeftX} ${spreadLeftY} ${pathQuarterX} ${pathQuarterY} Q${spread1X} ${spread1Y} ${pathMidX} ${pathMidY} Q${spread2X} ${spread2Y} ${pathRightX} ${pathRightY}`,
      width: 0.5,
    };
  });

  return (
    <svg className="w-full h-full text-primary" viewBox="-1000 -900 2000 1800" fill="none" preserveAspectRatio="xMidYMid slice">
      <title>Background Paths</title>
      {paths.map((path) => {
        // Stagger from top to bottom: t goes -1 to 1, so (t + 1) / 2 goes 0 to 1
        const appearDelay = (path.t + 1) / 2;
        const drawDuration = 8;
        // All paths start flowing together after the last one finishes drawing
        const flowStartTime = 0;

        // Flow back and forth - right then back left
        const flowDir = [1, 0, 1];

        return (
          <motion.path
            key={path.id}
            d={path.d}
            stroke="currentColor"
            strokeWidth={path.width}
            strokeOpacity={0.08 + path.id * 0.012}
            initial={{ pathLength: 0 }}
            animate={{
              pathLength: 1,
              pathOffset: flowDir,
            }}
            transition={{
              pathLength: {
                duration: drawDuration,
                delay: appearDelay,
                ease: "easeOut",
              },
              pathOffset: {
                duration: 50,
                delay: flowStartTime,
                repeat: Number.POSITIVE_INFINITY,
                ease: "linear",
              },
            }}
          />
        );
      })}
    </svg>
  );
}

export function BackgroundPaths() {
  return (
    <div className="fixed inset-0 -z-10 pointer-events-none">
      <FloatingPaths position={1} />
      <FloatingPaths position={-1} />
    </div>
  );
}
