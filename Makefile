SHELL := /bin/bash

.PHONY: install dev up down

install:
	pnpm install

dev:
	docker compose up --build

up:
	docker compose up -d --build

down:
	docker compose down
