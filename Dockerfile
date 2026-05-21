# Two-stage build: Node only to compile the static site, then a thin
# nginx image to serve dist/. No Node runtime in production; the final
# image is ~30MB and ships pure HTML + CSS + a handful of plain JS
# files. No JSX, no React, no Next.js — see scripts/build.mjs.

FROM node:22-alpine AS builder
WORKDIR /app

# Install only what's needed to build; gray-matter, marked, and the
# tailwind CLI. Two-step copy lets `npm ci` layer-cache when only the
# site content changes.
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY . .
RUN npm run build

# ------------------------------------------------------------------

FROM nginx:1.27-alpine AS runner

# Default nginx config doesn't know about HTML5 history fallback or
# the right cache headers for fingerprinted assets; this one does.
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 3000

# nginx:alpine ships a startup script that picks up /etc/nginx/conf.d/*
# and runs daemon off. No additional CMD needed.
