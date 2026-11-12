# syntax=docker/dockerfile:1
# One Dockerfile for every app. Select with `--target api|agent|llm|worker|web`.
FROM node:24-slim AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH
RUN corepack enable
WORKDIR /repo

FROM base AS deps
COPY . .
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

# Node services run TypeScript sources directly through tsx (workspace packages export src/).
FROM deps AS service
ENV NODE_ENV=production
USER node

FROM service AS api
ENV PORT=4100
EXPOSE 4100
CMD ["node_modules/.bin/tsx", "apps/api/src/index.ts"]

FROM service AS agent
ENV PORT=4101
EXPOSE 4101
CMD ["node_modules/.bin/tsx", "apps/agent/src/index.ts"]

FROM service AS llm
ENV PORT=4102
EXPOSE 4102
CMD ["node_modules/.bin/tsx", "apps/llm/src/index.ts"]

FROM service AS worker
CMD ["node_modules/.bin/tsx", "apps/worker/src/index.ts"]

FROM deps AS web-build
RUN pnpm --filter @agents-platform/web build

FROM nginx:1.27-alpine AS web
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=web-build /repo/apps/web/dist /usr/share/nginx/html
EXPOSE 80
