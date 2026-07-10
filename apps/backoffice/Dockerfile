FROM node:20-alpine

WORKDIR /repo

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages ./packages
COPY apps/backoffice ./apps/backoffice

RUN pnpm install --frozen-lockfile
RUN pnpm --filter @apps/backoffice build

EXPOSE 3000

CMD ["pnpm", "--filter", "@apps/backoffice", "start"]
