import type { SuiteFn } from "../types";
import { jobRepository } from "../../../src/repositories/job.repository";
import { UserRole } from "../../../src/entities/User.entity";
import { LowercaseJobSkills1790781374873 } from "../../../src/migrations/1790781374873-LowercaseJobSkills";

const page = {
  page: 1,
  limit: 50,
  sortBy: "createdAt",
  order: "DESC" as const,
};

export const run: SuiteFn = async (t, { ds, fx, runId }) => {
  const employer = await fx.user(UserRole.EMPLOYER);
  const company = await fx.company(employer);
  const tagA = `skilla${runId}`;
  const tagB = `skillb${runId}`;

  const jobA = await fx.job(company, {
    title: `A ${runId}`,
    skills: [tagA, "node"],
  });
  const jobB = await fx.job(company, { title: `B ${runId}`, skills: [tagB] });
  await fx.job(company, { title: `C ${runId}`, skills: ["other"] });

  // Lọc skills bằng && (OR, không phân biệt hoa thường ở phía input)
  const ids = async (skills: string[]) =>
    (await jobRepository.search({ skills }, page))[0].map((j) => j.id).sort();
  t.eq(
    await ids([tagA.toUpperCase()]),
    [jobA.id],
    "skills=<A> (capitalized) → refers to job A"
  );
  t.eq(
    await ids([tagA, tagB]),
    [jobA.id, jobB.id].sort(),
    "skills=<A>,<B> → semantics OR: job A and job B"
  );

  // Migration lowercase: dữ liệu cũ lẫn hoa/thường được chuẩn hoá
  const legacy = await fx.job(company, {
    title: `Legacy ${runId}`,
    skills: ["x"],
  });
  await ds.query(
    `UPDATE jobs SET skills = ARRAY['  React ', 'NODE', ''] WHERE id = $1`,
    [legacy.id]
  );
  const qr = ds.createQueryRunner();
  try {
    await new LowercaseJobSkills1790781374873().up(qr);
  } finally {
    await qr.release();
  }
  const [row] = await ds.query(`SELECT skills FROM jobs WHERE id = $1`, [
    legacy.id,
  ]);
  t.eq(
    row.skills,
    ["react", "node"],
    "migration LowercaseJobSkills: trim + lowercase + remove empty elements, preserve order"
  );
  t.eq(
    await ids(["REACT"]).then((x) => x.includes(legacy.id)),
    true,
    "Legacy data following migration can be retrieved using skills."
  );

  // GIN index dùng được cho toán tử &&
  const q2 = ds.createQueryRunner();
  try {
    await q2.startTransaction();
    await q2.query(`SET LOCAL enable_seqscan = off`); // bảng test nhỏ: ép planner chứng minh index dùng được
    const plan: Array<{ "QUERY PLAN": string }> = await q2.query(
      `EXPLAIN SELECT id FROM jobs job WHERE job.skills && $1::text[]`,
      [["react"]]
    );
    const text = plan.map((p) => p["QUERY PLAN"]).join("\n");
    t.ok(
      text.includes("IDX_jobs_skills_gin"),
      "The planner uses `IDX_jobs_skills_gin` for `skills` (whereas the older version, which relied on `unnest` + `LOWER`, could not utilize it).",
      text
    );
  } finally {
    await q2.rollbackTransaction().catch(() => undefined);
    await q2.release();
  }

  // Escape wildcard LIKE
  const pct = await fx.job(company, { title: `Sale 50% off ${runId}` });
  await fx.job(company, { title: `Plain ${runId}` });
  const kw = async (keyword: string) =>
    (await jobRepository.search({ keyword }, page))[0].map((j) => j.id);
  t.eq(
    await kw(`50% off ${runId}`),
    [pct.id],
    "A keyword containing '%' matches the '%' character literally."
  );
  const onlyPct = await kw("%");
  t.ok(
    onlyPct.length >= 1 && onlyPct.every((id) => id === pct.id),
    "The keyword '%' does NOT match all jobs (it has been escaped)",
    onlyPct
  );
  const underscore = await kw("_");
  t.eq(
    underscore.length,
    0,
    "keyword '_' does NOT match all characters (it has been escaped)"
  );
};
