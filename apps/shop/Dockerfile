FROM node:20-alpine

WORKDIR /repo

RUN corepack enable

COPY package.json pnpm-workspace.yaml tsconfig.base.json ./
COPY packages ./packages
COPY apps/shop ./apps/shop

RUN pnpm install
RUN pnpm --filter @apps/shop build

EXPOSE 3000

CMD ["pnpm", "--filter", "@apps/shop", "start"]
