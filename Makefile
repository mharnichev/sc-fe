SHELL := /bin/bash

.PHONY: install dev up down api-seed

install:
	pnpm install

dev:
	docker compose up --build

up:
	docker compose up -d --build

down:
	docker compose down

api-seed:
	cd apps/api && python -m app.db.seed
