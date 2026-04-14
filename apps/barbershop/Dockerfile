FROM node:20-alpine

WORKDIR /repo

RUN corepack enable

COPY package.json pnpm-workspace.yaml tsconfig.base.json ./
COPY packages ./packages
COPY apps/barbershop ./apps/barbershop

RUN pnpm install
RUN pnpm --filter @apps/barbershop build

EXPOSE 3000

CMD ["pnpm", "--filter", "@apps/barbershop", "start"]
