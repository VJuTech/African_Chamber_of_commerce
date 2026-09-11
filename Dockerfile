FROM node:22-alpine AS dependencies
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile --prod

FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY --from=dependencies /app/node_modules ./node_modules
COPY . .
USER node
EXPOSE 5500
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:5500/healthz || exit 1
CMD ["node", "server.js"]
