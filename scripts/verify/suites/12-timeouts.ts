import type { SuiteFn } from "../types";
import {
  ExternalTimeoutError,
  withTimeout,
} from "../../../src/utils/timeout.util";
import { sleep } from "../harness";

export const run: SuiteFn = async (t) => {
  t.eq(
    await withTimeout(Promise.resolve("ok"), 100, "x"),
    "ok",
    "promise completion → deliver results"
  );

  const started = Date.now();
  await t.rejects(
    () => withTimeout(new Promise(() => undefined), 60, "Cloudinary upload"),
    (e) =>
      e instanceof ExternalTimeoutError &&
      e.statusCode === 502 &&
      /Cloudinary upload timed out after 60ms/.test(e.message),
    "promise hanging indefinitely → throw ExternalTimeoutError (502) with correct label"
  );
  t.ok(
    Date.now() - started < 1000,
    "…and cancel waiting correctly (not wait indefinitely)"
  );

  await t.rejects(
    () => withTimeout(Promise.reject(new Error("smtp refused")), 100, "SMTP"),
    (e) => e.message === "smtp refused",
    "The original error from the promise is preserved (it is not masked by the timeout)."
  );

  // Không rò timer: process.getActiveResourcesInfo không có ở mọi bản Node → kiểm tra gián tiếp
  const before =
    (process as any)
      .getActiveResourcesInfo?.()
      .filter((r: string) => r === "Timeout").length ?? 0;
  for (let i = 0; i < 20; i++)
    await withTimeout(Promise.resolve(i), 10_000, "x");
  await sleep(5);
  const after =
    (process as any)
      .getActiveResourcesInfo?.()
      .filter((r: string) => r === "Timeout").length ?? 0;
  t.ok(
    after <= before + 1,
    `20 successful calls with no hanging timers left (before ${before}, after ${after})`
  );
};
