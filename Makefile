.PHONY: dev full monitoring down logs smoke load spike stress

PROFILES := --profile full --profile monitoring

dev:
	docker compose -f docker-compose.yml up -d
	npx cross-env RABBITMQ_URL=amqp://guest:guest@localhost:5672 npm run dev

full:
	docker compose -f docker-compose.yml --profile full up -d --remove-orphans

monitoring:
	docker compose -f docker-compose.yml $(PROFILES) up -d --remove-orphans

down:
	docker compose -f docker-compose.yml $(PROFILES) down

logs:
	docker compose -f docker-compose.yml logs -f rabbitmq

smoke:
	docker compose -f docker-compose.yml $(PROFILES) run --rm k6 run /scripts/smoke.test.js

load:
	docker compose -f docker-compose.yml $(PROFILES) run --rm k6 run /scripts/load.test.js

spike:
	docker compose -f docker-compose.yml $(PROFILES) run --rm k6 run /scripts/spike.test.js

stress:
	docker compose -f docker-compose.yml $(PROFILES) run --rm k6 run /scripts/stress.test.js