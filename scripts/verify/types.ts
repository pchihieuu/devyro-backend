import type { DataSource } from "typeorm";
import type { T } from "./harness";
import type { Fixtures } from "./fixtures";

export interface HttpResult {
  status: number;
  headers: Headers;
  /** JSON đã parse (hoặc chuỗi thô nếu không phải JSON). */
  body: any;
}

export interface Ctx {
  ds: DataSource;
  runId: string;
  fx: Fixtures;
  /** Launch (once) the actual API on a random port, and return the base URL. */
  baseUrl(): Promise<string>;
  http(path: string, init?: RequestInit): Promise<HttpResult>;
  /** TRUNCATE includes a check to ensure the database is *_test immediately before execution. */
  truncate(...tables: string[]): Promise<void>;
}

export type SuiteFn = (t: T, ctx: Ctx) => Promise<void>;
