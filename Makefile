.PHONY: dev down logs up down-all

up:
	docker compose -f docker-compose.yml up -d

dev:
	docker compose -f docker-compose.dev.yml up -d
	npx cross-env RABBITMQ_URL=amqp://guest:guest@localhost:5672 npm run dev

down:
	docker compose -f docker-compose.dev.yml down

down-all:
	docker compose -f docker-compose.yml down

logs:
	docker compose -f docker-compose.dev.yml logs -f rabbitmq