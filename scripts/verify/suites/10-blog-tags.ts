import type { SuiteFn } from "../types";
import { BlogService } from "../../../src/services/blog.service";
import { requestStore } from "../../../src/observability/request-context";

const counting = async <R = any>(fn: () => Promise<R>) => {
  const store = {
    requestId: "bt",
    traceId: undefined,
    queryCount: 0,
    fingerprints: new Map<string, number>(),
  };
  const result = await requestStore.run(store, fn);
  return { result, queries: store.queryCount };
};

export const run: SuiteFn = async (t, { ds, runId }) => {
  const svc: any = new BlogService(); // findOrCreateTags là private: test trực tiếp
  const tag = (s: string) => `${s}${runId}`;

  const first = await counting<any[]>(() =>
    svc.findOrCreateTags([
      tag("TypeScript"),
      tag("typescript"),
      tag("Node JS"),
      "   ",
    ])
  );
  t.eq(
    first.result.length,
    2,
    "Duplicate slugs ('TypeScript'/'typescript') and empty names are merged/removed → 2 tags"
  );
  t.ok(
    first.queries <= 3,
    `Create 2 new tags: ≤ 3 queries (actual: ${first.queries}; previous version: 2 queries/tag)`
  );

  const again = await counting<any[]>(() =>
    svc.findOrCreateTags([tag("TypeScript"), tag("Node JS")])
  );
  t.ok(
    again.result.length === 2 && again.queries === 1,
    `Existing tag: exactly 1 query (actual: ${again.queries})`
  );
  t.eq(
    again.result.map((x: any) => x.id).sort(),
    first.result.map((x: any) => x.id).sort(),
    "Returns the correct existing tags (no duplicates created)"
  );

  // Tạo đồng thời cùng 1 tag mới: không được lỗi unique-violation
  const fresh = tag("Concurrent Tag");
  const rs = await Promise.allSettled([
    svc.findOrCreateTags([fresh]),
    svc.findOrCreateTags([fresh]),
    svc.findOrCreateTags([fresh]),
  ]);
  t.ok(
    rs.every((r) => r.status === "fulfilled"),
    "3 simultaneous requests creating the same new tag: no unique-violation error",
    rs.filter((r) => r.status === "rejected")
  );
  const [{ n }] = await ds.query(
    `SELECT COUNT(*)::int AS n FROM blog_tags WHERE name = $1`,
    [fresh]
  );
  t.eq(n, 1, "…and the DB has only 1 tag");
};
