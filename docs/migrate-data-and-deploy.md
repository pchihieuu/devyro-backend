# Migration Plan: Job Portal → Singapore Region

Chuyển production từ (Render Virginia + Vercel + Supabase Sydney + CloudAMQP/Redis Singapore)
sang toàn bộ region **Singapore**, kèm migrate database sang project Supabase mới.

## Stack hiện tại → Stack mới

| Thành phần | Hiện tại | Mới |
|---|---|---|
| Backend | Render free (Virginia) | Render free (Singapore) |
| Frontend | Vercel | Vercel (giữ nguyên, chỉ đổi env) |
| Database | Supabase PostgreSQL (Sydney) | Supabase PostgreSQL (Singapore) — project mới |
| RabbitMQ | CloudAMQP free (Singapore) | CloudAMQP free — **instance mới** (Singapore) |
| Redis | Redis Cloud free (Singapore) | Giữ nguyên |

<!-- **Vì sao đổi sang Starter thay vì free:** worker RabbitMQ chạy chung process với API, nên
service free bị "ngủ" sau ~15 phút sẽ làm ngừng consume message. Từ 26/9/2025, Render free
còn chặn outbound SMTP (port 25/465/587) nên email cũng sẽ lỗi trên free plan. -->

---

## Giai đoạn 1 — Tạo hạ tầng Singapore

### 1.1 Supabase (database)

1. New project → Region **Southeast Asia (Singapore)**.
2. **Connect → Session pooler** (port 5432, user dạng `postgres.<project-ref>`) — dùng cho cả
   app lẫn migrate. Không dùng Transaction pooler (port 6543) cho TypeORM.
3. Đặt password **chỉ gồm chữ và số** (tránh `@ / : ? # %` — các ký tự này phá URL kết nối
   nếu không encode đúng).
4. Bật extension mà DB cũ đang dùng: chạy trên DB cũ
   `SELECT extname FROM pg_extension;`, bật tương ứng ở **Database → Extensions** trên DB mới.
5. Vì chỉ dùng Supabase làm database thuần (không Auth/Storage): tắt Data API nếu có tùy chọn,
   hoặc bật RLS cho các bảng sau khi restore — dữ liệu restore vào `public` có thể bị expose
   qua API mặc định.

### 1.2 CloudAMQP (RabbitMQ)

- Tạo **instance free mới** ở Singapore. Lấy `RABBITMQ_URL` mới.
- Không cần migrate message — queue của app chỉ chứa dữ liệu tạm (TTL 24h), sẽ tự được tạo lại
  khi worker khởi động (`assertExchange`/`assertQueue`).

### 1.3 Redis Cloud

- **Giữ nguyên** — đã ở Singapore. Refresh session dùng Redis TTL, không cần đổi.

---

## Giai đoạn 2 — Migrate dữ liệu

### Kiểm tra version Postgres (chạy trước khi chọn image Docker)

```powershell
docker run --rm `
  -e PGHOST=<old-host> -e PGPORT=5432 -e PGUSER=postgres.<old-ref> `
  -e PGPASSWORD='<OLD_PASSWORD>' -e PGDATABASE=postgres `
  postgres:17 psql -c "select version();"

docker run --rm `
  -e PGHOST=<new-host> -e PGPORT=5432 -e PGUSER=postgres.<new-ref> `
  -e PGPASSWORD='<NEW_PASSWORD>' -e PGDATABASE=postgres `
  postgres:17 psql -c "select version();"
```

| Giá trị | Lấy từ | Mới |
|---|---|---|
| `<old-host> / <new-host>` |giá trị `host`= (ví dụ `aws-0-ap-southeast-1.pooler.supabase.com`) | 
| `<old-ref> / <new-ref>` | phần sau `postgres`. trong `user`= `xxxxxxxxxxxxx` — chỉ lấy phần ref, còn `PGUSER=postgres.<ref>` giữ nguyên tiền tố `postgres` | 
| `<OLD_PASSWORD>` / `<NEW_PASSWORD>` | password bạn đặt lúc tạo project (không hiện trong khối này, xem lại lúc tạo hoặc reset ở **Database → Reset database password**) |

Dùng image `postgres:<version lớn nhất trong 2 server>` cho các bước dưới (thay `17` nếu khác).
`pg_dump` phải có version ≥ version server, nên không dùng bản cài local (16) nếu server là 17.

**Dùng biến môi trường `PG*` thay vì URL trong chuỗi kết nối** — tránh lỗi parse URL khi
password có ký tự đặc biệt.

### Dump từ DB cũ (Sydney)

```powershell
docker run --rm -v "${PWD}:/dump" `
  -e PGHOST=<old-host> -e PGPORT=5432 -e PGUSER=postgres.<old-ref> `
  -e PGPASSWORD='<OLD_PASSWORD>' -e PGDATABASE=postgres `
  postgres:17 pg_dump --schema=public --no-owner --no-privileges -Fc -f /dump/jobportal.dump
```

### Restore vào DB mới (Singapore)

```powershell
docker run --rm -v "${PWD}:/dump" `
  -e PGHOST=<new-host> -e PGPORT=5432 -e PGUSER=postgres.<new-ref> `
  -e PGPASSWORD='<NEW_PASSWORD>' -e PGDATABASE=postgres `
  postgres:17 pg_restore --schema=public --no-owner --no-privileges -d postgres /dump/jobportal.dump
```

Vài cảnh báo kiểu `schema "public" already exists` là bình thường; kiểm tra kỹ nếu có lỗi khác.

### Kiểm tra kết quả

```sql
-- So số dòng các bảng chính giữa 2 DB
SELECT relname, n_live_tup FROM pg_stat_user_tables ORDER BY relname;
```

```powershell
npm run build
npx cross-env NODE_ENV=production DATABASE_URL="<NEW_SESSION_POOLER_URL>" `
  JWT_SECRET=x JWT_REFRESH_SECRET=x GEMINI_API_KEY=x REDIS_URL=redis://x RABBITMQ_URL=amqp://x `
  typeorm-ts-node-commonjs migration:show -d dist/config/database.config.js
```

Kỳ vọng: **toàn bộ migration đều `[X]`**. Nếu còn `[ ]`, bảng `migrations` restore chưa đủ —
kiểm tra lại trước khi chạy `migration:run`.

---

## Giai đoạn 3 — Deploy Render mới + test

### Cấu hình service

| Mục | Giá trị |
|---|---|
| Region | **Singapore** |
| Plan | **Free** |
| Instances | **1** (worker + WebSocket chạy in-process, không scale ngang) |
| Build command | `npm ci --include=dev && npm run build` |
| Start command | `npm start` |
| Health check path | `/health` |

`--include=dev` cần thiết vì `tsc`/`rimraf` nằm ở devDependencies, và Render đặt
`NODE_ENV=production` khiến `npm ci` mặc định bỏ qua chúng.

### Env vars

```
NODE_VERSION=20
NODE_ENV=production
DATABASE_URL=<Session pooler mới>
RABBITMQ_URL=<CloudAMQP instance mới>
REDIS_URL=<giữ nguyên>
REDIS_TLS=true
JWT_SECRET=...
JWT_REFRESH_SECRET=...
GEMINI_API_KEY=...
CORS_ORIGIN=https://devyro.vercel.app
CLIENT_URL=https://devyro.vercel.app
FRONTEND_URL=https://devyro.vercel.app
COOKIE_DOMAIN=... (nếu có dùng)
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
EMAIL_HOST=...
EMAIL_PORT=...
EMAIL_SECURE=...
EMAIL_USER=...
EMAIL_PASSWORD=...
EMAIL_FROM=...
EMAIL_FROM_NAME=...
```

### Test trước khi cutover (dùng tài khoản test)

- [ ] `GET /health`
- [ ] Đăng ký / đăng nhập / refresh token
- [ ] List jobs / apply job
- [ ] Chat nhóm (kiểm tra cả worker lẫn WebSocket cùng hoạt động)
- [ ] Gửi email (reset password / welcome)
- [ ] Upload Cloudinary
- [ ] AI resume analysis (Gemini)

Kiểm tra log khởi động phải có đủ:
`Database initialized` → `RabbitMQ connected` → `WebSocket initialized` →
`All chat workers started` → `Server is running on port ...`

---

## Giai đoạn 4 — Cutover

Chọn giờ ít người dùng. Toàn bộ mất khoảng 10–15 phút.

1. Kiểm tra queue trên CloudAMQP cũ đã trống (message TTL ngắn nên thường đã trống).
2. **Suspend service Render cũ** — worker cũ ngừng consume trước khi service mới nhận traffic
   thật (worker + WebSocket phải chạy trên đúng 1 nơi tại một thời điểm).
3. Dump + restore lần cuối để lấy dữ liệu mới nhất, thêm `--clean --if-exists`:

   ```powershell
   docker run --rm -v "${PWD}:/dump" `
     -e PGHOST=<old-host> -e PGPORT=5432 -e PGUSER=postgres.<old-ref> `
     -e PGPASSWORD='<OLD_PASSWORD>' -e PGDATABASE=postgres `
     postgres:17 pg_dump --schema=public --no-owner --no-privileges -Fc -f /dump/final.dump

   docker run --rm -v "${PWD}:/dump" `
     -e PGHOST=<new-host> -e PGPORT=5432 -e PGUSER=postgres.<new-ref> `
     -e PGPASSWORD='<NEW_PASSWORD>' -e PGDATABASE=postgres `
     postgres:17 pg_restore --schema=public --no-owner --no-privileges --clean --if-exists `
       -d postgres /dump/final.dump
   ```

4. Chạy lại `migration:show` (mọi dòng phải `[X]`), rồi **Restart service Render mới** để pool
   kết nối không giữ cache sau khi bảng bị drop/tạo lại.
5. Vercel → đổi env `VITE_*` (API URL, WebSocket URL) sang backend mới → **Redeploy**
   (biến build-time, bắt buộc build lại).
6. Smoke test toàn bộ luồng trên domain production thật.

**Lưu ý:** domain backend mới khác domain cũ → cookie refresh token cũ không được gửi kèm,
người dùng phải đăng nhập lại một lần. Muốn tránh việc này về lâu dài, gắn custom domain cho
backend Render.

---

## Giai đoạn 5 — Sau cutover

- [ ] Theo dõi 24h: log Render, số consumer & queue depth trên CloudAMQP mới, độ trễ API.
- [ ] Giữ Render cũ (Suspended), Supabase Sydney, CloudAMQP cũ **3–7 ngày** để rollback.
- [ ] **Rollback nếu cần**: Resume Render cũ → đổi Vercel env về URL cũ → Redeploy. Dữ liệu ghi
      vào DB mới sau cutover sẽ không có ở DB cũ — nếu rollback muộn, cần dump ngược trước.
- [ ] Sau khi ổn định: xóa Render cũ, Supabase Sydney, CloudAMQP cũ.
- [ ] Đổi mọi password/secret đã từng dán ra ngoài (chat, note, terminal history).

---

## Checklist tổng hợp

- [ ] Code: `validateEnv`, CORS, `/health`, `trust proxy`, `.gitignore`
- [ ] Supabase Singapore: extension bật, RLS/Data API kiểm tra, password chỉ chữ+số
- [ ] CloudAMQP instance mới; Redis giữ nguyên
- [ ] Dump/restore xong, số dòng khớp, `migration:show` toàn `[X]`
- [ ] Render Singapore Starter, 1 instance, test đầy đủ bằng tài khoản test
- [ ] Cutover: Suspend cũ → restore lần cuối → restart mới → Vercel redeploy
- [ ] Theo dõi 24h, giữ hệ thống cũ vài ngày trước khi xóa