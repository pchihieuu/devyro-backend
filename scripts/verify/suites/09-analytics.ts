import type { SuiteFn } from "../types";
import { AnalyticsService } from "../../../src/services/analytics.service";
import { UserRole } from "../../../src/entities/User.entity";
import { ApplicationStatus } from "../../../src/entities/Application.entity";
import { Job } from "../../../src/entities/Job.entity";
import { requestStore } from "../../../src/observability/request-context";

const DAY = 86_400_000;
const ago = (days: number) => new Date(Date.now() - days * DAY);

export const run: SuiteFn = async (t, { ds, fx }) => {
  const svc = new AnalyticsService();
  const employer = await fx.user(UserRole.EMPLOYER);
  const seeker = await fx.user();
  const company = await fx.company(employer);

  const j1 = await fx.job(company, { title: "j1", createdAt: ago(1) });
  const j2 = await fx.job(company, { title: "j2", createdAt: ago(10) });
  await fx.job(company, {
    title: "j3-closed",
    isClosed: true,
    createdAt: ago(20),
  });

  await fx.application(j1, seeker, ApplicationStatus.ACCEPTED, ago(1));
  await fx.application(j1, seeker, ApplicationStatus.APPLIED, ago(2));
  await fx.application(j2, seeker, ApplicationStatus.ACCEPTED, ago(9));
  await fx.application(j2, seeker, ApplicationStatus.APPLIED, ago(30));

  const a = await svc.getEmployerAnalytics(employer.id, "employer");
  t.ok(
    a.counts.totalActiveJobs === 2 &&
      a.counts.totalApplications === 4 &&
      a.counts.totalHired === 2,
    "Total: 2 open jobs, 4 applications, 2 hires",
    a.counts
  );
  t.eq(
    a.counts.trends,
    { activeJobs: 0, applications: 100, totalHired: 0 },
    "trend: 1-to-1 jobs (0%), applications (2 vs. 1 previously… +100%), 1-to-1 hiring (0%)"
  );
  t.ok(
    a.data.recentJobs.length === 3 && a.data.recentApplications.length === 4,
    "recent list: 3 jobs, 4 applications"
  );

  const applicant: any = a.data.recentApplications[0].applicant;
  t.ok(
    applicant &&
      !("password" in applicant) &&
      Object.keys(applicant).sort().join() === "avatar,email,id,name",
    "applicant only has id/name/email/avatar (no password hash)",
    applicant
  );

  await t.rejects(
    () => svc.getEmployerAnalytics(seeker.id, "jobseeker"),
    (e) => e.statusCode === 403,
    "non-employer user → 403"
  );
  const lonely = await fx.user(UserRole.EMPLOYER);
  await t.rejects(
    () => svc.getEmployerAnalytics(lonely.id, "employer"),
    (e) => e.statusCode === 404,
    "The employer does not yet have a company. → 404"
  );

  // Mốc đúng 7 ngày không được tính vào cả 2 cửa sổ (nửa khoảng [from, to))
  await ds.getRepository(Job).softDelete(j1.id);
  const b = await svc.getEmployerAnalytics(employer.id, "employer");
  t.ok(
    b.counts.totalActiveJobs === 1 && b.counts.totalApplications === 2,
    "Soft-deleted jobs (and their associated records) are excluded from the metrics.",
    b.counts
  );

  // Số query: 4 truy vấn song song (+1 tìm company) thay vì 11
  const store = {
    requestId: "an",
    traceId: undefined,
    queryCount: 0,
    fingerprints: new Map<string, number>(),
  };
  await requestStore.run(store, () =>
    svc.getEmployerAnalytics(employer.id, "employer")
  );
  t.ok(
    store.queryCount <= 5,
    `analytics runs ≤ 5 queries (actual: ${store.queryCount}; previous version: 11)`
  );
};
