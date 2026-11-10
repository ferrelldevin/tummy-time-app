# Build context is the repo root (see docker-compose.yml).
FROM node:22.23.4-alpine AS build
WORKDIR /repo
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
# --ignore-scripts: skips the git-hook installer, which has no .git folder to write to here.
RUN pnpm install --frozen-lockfile --ignore-scripts
COPY packages/shared packages/shared
COPY apps/api apps/api
RUN pnpm --filter @tummy/shared build && pnpm --filter @tummy/api build
RUN pnpm --filter @tummy/api deploy --prod --legacy /out

FROM node:22.23.4-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /out ./
USER node
CMD ["node", "dist/server.js"]
