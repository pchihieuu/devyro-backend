# Migrate PostgreSQL Native → Docker (job-portal-v1)

Tài liệu ghi lại quy trình chuyển PostgreSQL đang chạy native trên Windows sang container Docker, kèm các lỗi thực tế đã gặp và cách xử lý. Dùng như checklist khi cần lặp lại thao tác này (máy mới, đồng đội mới, hoặc restore lại sau sự cố).

## Bối cảnh

- Native Postgres 16 trên Windows, chiếm port `5432`.
- Cần chuyển sang Postgres 16 chạy trong Docker (`docker-compose.yml`), giữ nguyên toàn bộ data đang có.
- Sau khi chuyển, `db`, `rabbitmq`, `api` đều chạy trong Docker qua `make dev` (profile `full`).

## Nguyên tắc quan trọng nhất — đọc trước khi làm

> **Tên database phải khớp tuyệt đối ở mọi nơi**: DB thật trên native Postgres, `POSTGRES_DB` trong `docker-compose.yml` (service `db`), `DB_DATABASE` trong `docker-compose.yml` (service `api`), và `DB_DATABASE` trong `.env`.

Gần như toàn bộ lỗi trong quá trình migrate thực tế đều bắt nguồn từ việc 4 chỗ này bị lệch nhau (gõ nhầm `job-portal-version1` / `job-portal_v1` / `job_portal_v1`), dẫn tới: migration chạy vào nhầm DB rỗng, restore data vào nhầm DB, frontend không thấy data dù API "chạy ổn".

**Khuyến nghị dài hạn**: dùng biến `.env` cho cả `docker-compose.yml`, không hardcode:

```yaml
services:
  db:
    environment:
      POSTGRES_DB: ${DB_DATABASE}
      POSTGRES_USER: ${DB_USERNAME}
      POSTGRES_PASSWORD: ${DB_PASSWORD}

  api:
    environment:
      DB_HOST: db
      DB_PORT: ${DB_PORT}
      DB_USERNAME: ${DB_USERNAME}
      DB_PASSWORD: ${DB_PASSWORD}
      DB_DATABASE: ${DB_DATABASE}
```

Compose tự đọc `.env` cùng thư mục để nội suy `${...}` — sửa một chỗ duy nhất.

---

## Bước 1 — Xác nhận Postgres native đang chạy

```powershell
Get-Service | Where-Object {$_.Name -like "*postgres*"}
```

Ghi lại tên service (dạng `postgresql-x64-16`) — cần dùng ở Bước 4.

Kiểm tra ai đang chiếm port `5432`:

```powershell
netstat -ano | findstr :5432
```

Đối chiếu PID với Task Manager → tab Details để confirm là `postgres.exe`.

## Bước 2 — Xác nhận tên database thật

**Đừng đoán tên DB.** Liệt kê toàn bộ database trên native Postgres trước khi dump:

```powershell
cd "C:\Program Files\PostgreSQL\16\bin"
.\psql.exe -U postgres -h localhost -c "\l"
```

Chọn đúng DB chứa data thật (dung lượng lớn, không phải DB mặc định `postgres`/`template`).

Nếu không nhớ đường dẫn cài Postgres:

```powershell
Get-ChildItem -Path "C:\Program Files\PostgreSQL" -Recurse -Filter "pg_dump.exe"
```

## Bước 3 — Dump data từ Postgres native

```powershell
.\pg_dump.exe --username=postgres --host=localhost --port=5432 --file=D:\backup.sql <ten_database_that>
```

Sẽ hỏi mật khẩu Postgres native (không phải mật khẩu Docker `123456`).

**Verify file backup có data trước khi đi tiếp:**

```powershell
Get-Content "D:\backup.sql" -TotalCount 20
```

Cần thấy header `PostgreSQL database dump`, `SET client_encoding = 'UTF8'`, `CREATE EXTENSION`.

Kiểm tra sâu hơn — có `COPY ... FROM stdin` (tức có data, không chỉ schema rỗng):

```powershell
Select-String -Path "D:\backup.sql" -Pattern "^COPY " | Select-Object -First 5
```

## Bước 4 — Tắt Postgres native

Mở PowerShell **Run as Administrator**:

```powershell
Stop-Service -Name "postgresql-x64-16" -Force
Set-Service -Name "postgresql-x64-16" -StartupType Disabled
```

`Set-Service ... Disabled` để tránh nó tự bật lại chiếm port `5432` sau khi restart Windows.

Kiểm tra port đã trống:

```powershell
netstat -ano | findstr :5432
```

## Bước 5 — Start Postgres trong Docker

```powershell
cd D:\path\to\project
docker compose -f docker-compose.yml up -d db
docker ps
```

Đợi `jobportal-postgres` chuyển sang `healthy`.

## Bước 6 — Tạo database đích và restore

Tạo DB rỗng đúng tên (khớp với Bước 2 và với `docker-compose.yml`/`.env`):

```powershell
docker exec -it jobportal-postgres psql -U postgres -c "CREATE DATABASE ten_database;"
```

> Identifier có ký tự đặc biệt (dấu gạch ngang `-`) bắt buộc phải quote: `"CREATE DATABASE \"ten-co-gach-ngang\";"`. Identifier chỉ chữ thường + gạch dưới (`_`) thì **không cần** quote — nên ưu tiên đặt tên DB kiểu `snake_case` để tránh rắc rối escape quote giữa PowerShell và psql.

### ⚠️ Restore đúng cách — KHÔNG dùng pipe PowerShell

```powershell
# SAI — PowerShell re-encode qua pipe, phá vỡ UTF-8, tiếng Việt có dấu bị hỏng thành "???"
Get-Content "D:\backup.sql" | docker exec -i jobportal-postgres psql -U postgres -d ten_database
```

`Get-Content` đọc file thành chuỗi .NET rồi pipe ra `docker exec` qua stdin, PowerShell re-encode theo code page hệ thống (không phải UTF-8) → toàn bộ ký tự tiếng Việt có dấu bị mojibake (`C??c L???p tr??nh vi??n...`).

**Cách đúng — copy file thẳng vào container, chạy `psql -f` bên trong (không qua stdin của PowerShell):**

```powershell
docker cp D:\backup.sql jobportal-postgres:/tmp/backup.sql
docker exec -it jobportal-postgres psql -U postgres -d ten_database -f /tmp/backup.sql
```

**Trước khi restore, đảm bảo DB đích hoàn toàn rỗng** — nếu chạy lại lệnh restore trên DB đã có schema/data (kể cả data lỗi từ lần trước), sẽ ra hàng loạt lỗi `already exists` / `duplicate key value violates unique constraint`, và **data cũ/lỗi vẫn không bị ghi đè** (script dừng ở lỗi từng dòng, không rollback được các phần đã chạy trước đó). Nếu gặp tình huống này, phải xoá sạch và restore lại từ đầu:

```powershell
# Dừng mọi service đang giữ connection tới DB (api, DBeaver...)
docker stop jobportal-api

# Ngắt các session còn sót (nếu có)
docker exec -it jobportal-postgres psql -U postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'ten_database' AND pid <> pg_backend_pid();"

# Xoá và tạo lại sạch
docker exec -it jobportal-postgres psql -U postgres -c "DROP DATABASE ten_database;"
docker exec -it jobportal-postgres psql -U postgres -c "CREATE DATABASE ten_database;"

# Restore lại
docker cp D:\backup.sql jobportal-postgres:/tmp/backup.sql
docker exec -it jobportal-postgres psql -U postgres -d ten_database -f /tmp/backup.sql

# Bật lại api
docker start jobportal-api
```

## Bước 7 — Verify data

Danh sách bảng:

```powershell
docker exec -it jobportal-postgres psql -U postgres -d ten_database -c "\dt"
```

Đếm data một bảng biết chắc có record:

```powershell
docker exec -it jobportal-postgres psql -U postgres -d ten_database -c "SELECT COUNT(*) FROM applications;"
```

**Verify riêng phần encoding tiếng Việt** — đây là bước hay bị bỏ qua, nên kiểm tra rõ ràng thay vì chỉ nhìn số dòng:

```powershell
docker exec -it jobportal-postgres psql -U postgres -d ten_database -c "SELECT description FROM jobs LIMIT 1;"
```

Nếu thấy `???` hoặc ký tự lạ thay vì dấu tiếng Việt → quay lại Bước 6, restore lại bằng `docker cp` + `psql -f`, **không** dùng pipe PowerShell.

## Bước 8 — Đồng bộ cấu hình

Sửa đúng tên DB ở **cả 3 chỗ**, không được lệch:

1. `docker-compose.yml` → service `db` → `POSTGRES_DB`
2. `docker-compose.yml` → service `api` → `environment.DB_DATABASE`
3. `.env` → `DB_DATABASE`

> Lưu ý: `POSTGRES_DB` trong service `db` **chỉ có tác dụng khi Postgres init lần đầu trên volume rỗng**. Nếu volume đã tồn tại (đã từng chạy `up` trước đó), đổi `POSTGRES_DB` trong compose **không tự đổi tên DB** — phải `CREATE DATABASE` / `ALTER DATABASE ... RENAME TO` thủ công như Bước 6.

## Bước 9 — Kết nối DBeaver để double-check

- Host: `localhost`
- Port: `5432`
- Database: `ten_database`
- Username: `postgres`
- Password: `123456`

## Bước 10 — Chạy lại toàn bộ stack

```powershell
make dev
```

Kiểm tra container đang connect đúng DB:

```powershell
docker exec -it jobportal-api env | Select-String "DB_"
docker logs jobportal-api --tail 100 | Select-String "DB_DATABASE"
```

So sánh với `.env`:

```powershell
Get-Content .env | Select-String "DB_DATABASE"
```

Hai giá trị phải khớp nhau tuyệt đối.

---

## Checklist debug nhanh khi frontend không hiển thị data

Triệu chứng: `make dev` (api chạy trong Docker) → healthy, không lỗi, nhưng frontend không thấy data. Trong khi `npm run dev` (api chạy native, đọc `.env` trực tiếp) → có data bình thường.

→ **Gần như chắc chắn là sai tên DB giữa `docker-compose.yml` và `.env`** (2 nguồn cấu hình khác nhau cho 2 cách chạy). Kiểm tra theo Bước 10 ở trên trước khi nghi ngờ CORS hay logic backend.

Nếu tên DB đã khớp mà vẫn không có data, kiểm tra tiếp qua DevTools → tab Network:

- Request tới `VITE_API_BASE_URL` (`http://localhost:5000`) trả về status gì — `200` với body rỗng `[]`, `401/403`, hay bị chặn CORS hoàn toàn.
- Nếu bị CORS chặn: kiểm tra biến cấu hình CORS origin có được set trong `environment:` của service `api` hay không (nếu chỉ có trong `.env` mà `docker-compose.yml` không map, container sẽ không có).

## Lỗi `Cannot find module '<package>'` khi chạy `npm run dev` trong container

Nguyên nhân: package mới được thêm vào `package.json` nhưng **image Docker chưa được rebuild**. Dockerfile chỉ chạy `npm install` lúc build image; `docker compose up` không tự rebuild nếu image đã tồn tại.

Fix:

```powershell
docker compose -f docker-compose.yml build api
docker compose -f docker-compose.yml --profile full up -d --remove-orphans
```

Phòng ngừa: thêm cờ `--build` vào lệnh `up` trong Makefile để image luôn được kiểm tra rebuild mỗi lần `make dev` (Docker cache layer nên không tốn thời gian nếu `package.json` không đổi):

```makefile
dev:
	$(COMPOSE) --profile full up -d --build --remove-orphans
```

## Kiểm tra hot reload khi code chạy trong container (Windows bind mount)

`ts-node-dev --respawn` cần detect file thay đổi qua inotify. Trên Windows, Docker Desktop dùng bind mount qua WSL2/virtiofs đôi khi không fire event đúng, khiến sửa code mà container không tự restart.

**Cách kiểm tra:**

1. Mở log stream: `make logs-api` (hoặc `docker compose logs -f api`).
2. Sửa một dòng bất kỳ trong source (ví dụ thêm `console.log` trong `src/server.ts`), lưu file.
3. Quan sát log trong vài giây — nếu thấy `ts-node-dev` in dòng restart/reload, hot reload hoạt động bình thường.
4. Nếu **không** thấy gì sau ~5-10 giây dù đã lưu file, đây là dấu hiệu event không được container nhận — cần bật polling.

**Fix nếu bước 4 xảy ra** — thêm `CHOKIDAR_USEPOLLING=true` vào script `dev` trong `package.json`:

```json
"dev": "cross-env NODE_ENV=development CHOKIDAR_USEPOLLING=true ts-node-dev --respawn --transpile-only src/server.ts"
```

Polling kiểm tra file theo chu kỳ thay vì chờ event hệ thống, hoạt động ổn định qua bind mount nhưng tốn CPU hơn một chút — chấp nhận được cho môi trường dev.

---

## Tóm tắt lỗi thực tế đã gặp (case study)

| Lỗi | Nguyên nhân | Fix |
|---|---|---|
| Migration chạy 23 migration mới toanh vào DB tưởng đã có data | `DB_DATABASE` trong `docker-compose.yml` lệch tên với DB đã restore data | Đồng bộ tên DB ở cả 3 nơi (Bước 8) |
| `CREATE DATABASE "job_portal_v1"` báo `unterminated quoted identifier` | PowerShell escape `\"` sai cú pháp; identifier toàn chữ thường + `_` không cần quote | Bỏ quote: `CREATE DATABASE job_portal_v1;` |
| Data tiếng Việt thành `???` sau restore | Restore qua `Get-Content \| docker exec -i psql` — PowerShell re-encode qua pipe | Dùng `docker cp` + `psql -f` bên trong container |
| `database "xxx" is being accessed by other users` khi `DROP DATABASE` | Container `api` đang giữ connection pool tới DB | `docker stop jobportal-api` trước, hoặc `pg_terminate_backend` |
| `Cannot find module 'he'` | Image chưa rebuild sau khi thêm dependency mới | `docker compose build api` hoặc thêm `--build` vào Makefile |
| Tất cả container `Exited (0)` đồng loạt không rõ lý do | Docker Desktop/WSL2 backend tự restart (sleep máy, Resource Saver, update) | `make dev` để bật lại đúng thứ tự qua compose, không dùng `docker start` lẻ từng container |
| API chạy Docker không lỗi nhưng frontend không có data | `DB_DATABASE` trong `docker-compose.yml` khác với `.env` (2 đường chạy dùng 2 nguồn cấu hình khác nhau) | Đồng bộ theo Bước 10 |