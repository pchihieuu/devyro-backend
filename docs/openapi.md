# OpenAPI — hợp đồng API cho Frontend

- **Swagger UI:** `GET /docs` (dev mặc định bật; production phải đặt `DOCS_ENABLED=true`, nên kèm `DOCS_BASIC_AUTH=user:pass`)
- **Spec JSON (runtime):** `GET /docs/openapi.json`
- **Spec JSON (commit trong repo):** `docs/openapi/openapi.json` ← FE dùng file này trong CI

## Dùng ở FE (sinh type TypeScript)

```bash
npx openapi-typescript https://<api>/docs/openapi.json -o src/api/schema.d.ts
# hoặc từ file trong repo backend:
npx openapi-typescript ../backend/docs/openapi/openapi.json -o src/api/schema.d.ts
```

```ts
import createClient from "openapi-fetch";
import type { paths } from "./schema";
const api = createClient<paths>({ baseUrl: "/api/v1" });
const { data } = await api.GET("/jobs", { params: { query: { page: 1, limit: 12 } } });
```

Envelope: `{ success, message?, data?, pagination?, meta? }`; lỗi: `{ success:false, message, errors:[{field,message}], code?, requestId? }`.

## Backend: tài liệu được sinh thế nào (không bao giờ lệch code)

| Phần | Nguồn | Lệch được không? |
|---|---|---|
| method, path | đọc `router.stack` của Express (`src/openapi/introspect.ts`) | Không |
| params / query / body | chính validator Zod đang dùng ở `validate(schema)` | Không |
| auth (`protect`/`optionalAuth`/`adminOnly`), rate limit, idempotency, multipart | nhận diện middleware trong stack | Không |
| **response** `data` | khai báo tay ở `src/openapi/catalog/*.ts` (+ DTO ở `src/openapi/schemas/`) | **Có** — nhưng router ↔ catalog bị khoá bằng `openapi:check` |

### Thêm / sửa endpoint (theo `backend-module-pattern`)

1. Làm như thường lệ: validator → repository → service → controller → route (nhớ `validate(schema)`).
2. Thêm 1 entry vào catalog của module: `"POST /jobs/:id/xxx": { summary, status?, data?, paginated?, roles?, … }`. Key = `METHOD /path` tương đối prefix `/api/v1`, kiểu Express.
3. Nếu response có DTO mới: thêm Zod schema vào `src/openapi/schemas/*` kèm `.meta({ id: "TênDTO" })` để nó thành `components.schemas.TênDTO`.
4. `npm run openapi:generate` rồi commit `docs/openapi/openapi.json`.
5. Module router mới: thêm 1 dòng vào `src/routes/index.ts` (`apiRouters`) — app.ts và OpenAPI cùng đọc danh sách này.

`npm run openapi:check` (chạy trong CI) fail khi: có route chưa có mô tả, có mô tả cho route không tồn tại, spec sai chuẩn OpenAPI 3.0, hoặc file commit đã cũ.

## Lưu ý hợp đồng FE cần biết

- Cột `decimal` (`salaryMin/Max`, `hourlyRateMin/Max`, `rating`) trả về **chuỗi** (`"1500.00"`) → `Number()` trước khi tính toán.
- `GET /groups/:id/messages` trả cả `data.{total,hasMore}` (cũ) lẫn `pagination` (chuẩn) — hãy chuyển sang `pagination`.
- `GET /analytics/overview` trả `counts` 2 lần (`data.counts` và top-level `counts`) — dùng `data.counts`.
- POST tạo tài nguyên hỗ trợ header `Idempotency-Key` (UUID sinh 1 lần mỗi lần submit).
- Response schema của vài endpoint tổng hợp (`users/search`, `applications/*`, `groups` create/update, upload media) được mô tả **một phần** (`catchall`/partial) vì service trả shape theo relation — xem mục "Cần xác minh" trong báo cáo.
