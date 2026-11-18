.PHONY: openapi alerts-test dev monitoring down down-monitoring restart restart-api ps logs logs-api smoke load spike stress clean

COMPOSE := docker compose -f docker-compose.dev.yml
PROFILE_FULL := --profile full
PROFILE_MONITORING := --profile full --profile monitoring

# Dev: dùng khi thêm/đổi dependency, đổi Dockerfile, hoặc không chắc cần gì
# Luôn an toàn để chạy: cache hit thì nhanh, cache miss thì tự rebuild đúng phần cần.
dev:
	$(COMPOSE) $(PROFILE_FULL) build api
	$(COMPOSE) $(PROFILE_FULL) up -d --remove-orphans --renew-anon-volumes

# Restart nhanh: dùng khi chỉ sửa script/env trong package.json, không đổi dependency
# Không rebuild image, chỉ restart process trong container để entrypoint.sh đọc lại package.json.
restart-api:
	$(COMPOSE) restart api

# Bật OpenTelemetry (API → collector → Tempo) chỉ khi chạy stack monitoring.
monitoring: export OTEL_EXPORTER_OTLP_ENDPOINT=http://otel-collector:4318
monitoring:
	$(COMPOSE) $(PROFILE_MONITORING) build api
	$(COMPOSE) $(PROFILE_MONITORING) up -d --remove-orphans --renew-anon-volumes

# Sinh lại docs/openapi/openapi.json (commit file này; FE dùng để sinh type).
openapi:
	npm run openapi:generate

# Validate + unit-test rule/alert bằng promtool trong container (không cần cài local).
alerts-test:
	docker run --rm --entrypoint promtool -v $(CURDIR)/prometheus:/p:ro prom/prometheus:v2.51.2 check rules /p/rules/alerts.rules.yml /p/rules/recording.rules.yml
	docker run --rm --entrypoint promtool -v $(CURDIR)/prometheus:/p:ro prom/prometheus:v2.51.2 test rules /p/tests/alerts.test.yml

down:
	$(COMPOSE) $(PROFILE_FULL) down

down-monitoring:
	$(COMPOSE) $(PROFILE_MONITORING) down

restart: down dev

ps:
	$(COMPOSE) ps

logs:
	$(COMPOSE) logs -f rabbitmq

logs-api:
	$(COMPOSE) logs -f api

smoke:
	$(COMPOSE) $(PROFILE_MONITORING) run --rm k6 run /scripts/smoke.test.js

load:
	$(COMPOSE) $(PROFILE_MONITORING) run --rm k6 run /scripts/load.test.js

spike:
	$(COMPOSE) $(PROFILE_MONITORING) run --rm k6 run /scripts/spike.test.js

stress:
	$(COMPOSE) $(PROFILE_MONITORING) run --rm k6 run /scripts/stress.test.js

clean:
	$(COMPOSE) $(PROFILE_MONITORING) down -v