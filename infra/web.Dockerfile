# Build context is the repo root (see docker-compose.yml).
FROM node:22.23.4-alpine AS build
WORKDIR /repo
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN pnpm install --frozen-lockfile --ignore-scripts
COPY packages/shared packages/shared
COPY apps/web apps/web
# SITE_BANNER=test turns on the "Test site. Sample data." strip on every screen. It is read when
# the app is built, so a test site and the real site are two different builds. Empty = off.
ARG SITE_BANNER=""
ARG TUMMY_BUILD_ID="local"
ENV SITE_BANNER=$SITE_BANNER TUMMY_BUILD_ID=$TUMMY_BUILD_ID
RUN pnpm --filter @tummy/shared build && pnpm --filter @tummy/web exec vite build

FROM nginx:1.31.2-alpine
# The nginx image fills ${API_PORT} in this template from the container's environment.
COPY infra/nginx.conf.template /etc/nginx/templates/default.conf.template
COPY infra/nginx-security-headers.conf /etc/nginx/snippets/tummy-security-headers.conf
COPY --from=build /repo/apps/web/dist /usr/share/nginx/html
