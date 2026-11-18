import type { SuiteFn } from "../types";

const REQUIRED_INDEXES = [
  "IDX_jobs_skills_gin",
  "IDX_group_members_user_status",
  "IDX_group_messages_group_created",
  "IDX_outbox_events_pending",
];

export const run: SuiteFn = async (t, { ds }) => {
  t.ok(!(await ds.showMigrations()), "no pending migrations");

  // Tương đương `npm run migration:generate`: nếu entity khác DB sẽ có câu lệnh cần chạy.
  const diff = await ds.driver.createSchemaBuilder().log();
  t.ok(
    diff.upQueries.length === 0,
    "entity matches the DB perfectly (no drift)",
    diff.upQueries.map((q) => q.query)
  );

  const rows: Array<{ indexname: string; indexdef: string }> = await ds.query(
    `SELECT indexname, indexdef FROM pg_indexes WHERE schemaname = 'public'`
  );
  const defs = new Map(rows.map((r) => [r.indexname, r.indexdef]));
  for (const name of REQUIRED_INDEXES) {
    t.ok(defs.has(name), `index ${name} exists`);
  }
  t.ok(
    /USING gin/i.test(defs.get("IDX_jobs_skills_gin") ?? ""),
    "IDX_jobs_skills_gin is a GIN index"
  );
  t.ok(
    /WHERE/i.test(defs.get("IDX_outbox_events_pending") ?? ""),
    "IDX_outbox_events_pending is a partial index (only pending events)"
  );
};
