import { EventEmitter } from "events";

const tty = process.stdout.isTTY;
const c = (code: number, s: string) => (tty ? `\x1b[${code}m${s}\x1b[0m` : s);
export const green = (s: string) => c(32, s);
export const red = (s: string) => c(31, s);
export const yellow = (s: string) => c(33, s);
export const dim = (s: string) => c(2, s);
export const bold = (s: string) => c(1, s);

/** Bộ kiểm tra tối giản: mỗi assertion in ngay 1 dòng PASS/FAIL. */
export class T {
  passed = 0;
  failed = 0;
  readonly failures: string[] = [];

  ok(cond: unknown, message: string, detail?: unknown): void {
    if (cond) {
      this.passed++;
      console.log(`  ${green("PASS")} ${message}`);
    } else {
      this.failed++;
      this.failures.push(message);
      console.log(`  ${red("FAIL")} ${message}`);
      if (detail !== undefined) {
        const text =
          typeof detail === "string" ? detail : JSON.stringify(detail, null, 2);
        console.log(
          dim(
            text
              .split("\n")
              .map((l) => `       ${l}`)
              .join("\n")
          )
        );
      }
    }
  }

  eq<V>(actual: V, expected: V, message: string): void {
    this.ok(
      JSON.stringify(actual) === JSON.stringify(expected),
      message,
      `expected: ${JSON.stringify(expected)}\n actual: ${JSON.stringify(actual)}`
    );
  }

  /** Mong đợi `fn` ném lỗi thoả `predicate`. */
  async rejects(
    fn: () => Promise<unknown>,
    predicate: (e: any) => boolean,
    message: string
  ): Promise<void> {
    try {
      await fn();
      this.ok(false, message, "Expected function to throw, but it did not.");
    } catch (e) {
      this.ok(
        predicate(e),
        message,
        e instanceof Error ? `${e.name}: ${e.message}` : String(e)
      );
    }
  }

  note(message: string): void {
    console.log(`  ${dim("·")} ${dim(message)}`);
  }
}

/** res giả dùng để gọi trực tiếp middleware (không cần HTTP). */
export const fakeRes = () => {
  const res = new EventEmitter() as EventEmitter & {
    statusCode?: number;
    body?: any;
    headers: Record<string, string>;
    status(n: number): typeof res;
    json(b: unknown): typeof res;
    setHeader(k: string, v: string): typeof res;
  };
  res.headers = {};
  res.status = (n) => ((res.statusCode = n), res);
  res.json = (b) => ((res.body = b), res);
  res.setHeader = (k, v) => ((res.headers[k.toLowerCase()] = v), res);
  return res;
};

export const sleep = (ms: number) =>
  new Promise<void>((r) => setTimeout(r, ms));
