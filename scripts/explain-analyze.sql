-- Chạy trên DB Postgres thật (data volume thực tế), SAU KHI `npm run migration:run`:
--   psql "$DATABASE_URL" -f scripts/explain-analyze.sql
--
-- Kỳ vọng sau migration:
--   Q1  -> Bitmap Index Scan trên IDX_jobs_skills_gin (không còn Seq Scan + unnest)
--   Q2/Q3 -> Index Scan trên IDX_group_messages_group_created, KHÔNG có bước Sort riêng
--   Q4  -> Index Scan trên IDX_group_members_user_status (hoặc index user/status tương đương)
-- Nếu bảng còn nhỏ, planner có thể vẫn chọn Seq Scan vì rẻ hơn — đó là bình thường;
-- để kiểm tra index có dùng được hay không, thử: SET enable_seqscan = off;
--
-- LƯU Ý: EXPLAIN ANALYZE THỰC SỰ CHẠY câu lệnh. Toàn bộ là SELECT nên an toàn,
-- nhưng đừng thêm INSERT/UPDATE vào file này.
-- Thay các giá trị :'...' bằng dữ liệu thật của bạn (hoặc dùng psql -v).

\set skills '{react,node}'
\set group_id '00000000-0000-0000-0000-000000000000'
\set user_id  '00000000-0000-0000-0000-000000000000'

\echo '=== Q1: job search theo skills (overlap &&, dùng GIN) ==='
EXPLAIN (ANALYZE, BUFFERS)
SELECT j.id, j.title
FROM jobs j
WHERE j."deletedAt" IS NULL
  AND j."isClosed" = false
  AND j.skills && :'skills'::text[]
ORDER BY j."createdAt" DESC
LIMIT 10;

\echo '=== Q2: getGroupMessages (không search) ==='
EXPLAIN (ANALYZE, BUFFERS)
SELECT m.id
FROM group_messages m
WHERE m.group_id = :'group_id' AND m.is_deleted = false
ORDER BY m."createdAt" DESC, m.id DESC
LIMIT 50 OFFSET 0;

\echo '=== Q3: getGroupMessages với search nội dung (ILIKE) ==='
EXPLAIN (ANALYZE, BUFFERS)
SELECT m.id
FROM group_messages m
WHERE m.group_id = :'group_id' AND m.is_deleted = false
  AND m.content ILIKE '%hello%'
ORDER BY m."createdAt" DESC, m.id DESC
LIMIT 50 OFFSET 0;
-- Q3 lọc ILIKE trong phạm vi 1 group (đã thu hẹp bằng index group_id) nên chấp nhận được.
-- Nếu 1 group có hàng triệu tin và search chậm: thêm pg_trgm + GIN index trên content.

\echo '=== Q4: danh sách group ACTIVE của user ==='
EXPLAIN (ANALYZE, BUFFERS)
SELECT m.id, g.name
FROM group_members m
JOIN groups g ON g.id = m.group_id
WHERE m.user_id = :'user_id' AND m.status = 'active'
ORDER BY g.last_message_at DESC NULLS LAST, g."createdAt" DESC;
