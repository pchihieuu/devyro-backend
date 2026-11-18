import { config } from "../config/env.config";
import { API_PREFIX } from "../constants/routes";
import { buildOpenApiDocument, BuildResult } from "./builder";

let cached: BuildResult | undefined;

/** Build 1 lần rồi cache (router + catalog không đổi trong vòng đời process). */
export const getOpenApiDocument = (): BuildResult => {
  cached ??= buildOpenApiDocument({
    serverUrl: config.docs.publicUrl
      ? `${config.docs.publicUrl.replace(/\/$/, "")}${API_PREFIX}`
      : API_PREFIX,
    version: process.env.npm_package_version,
  });
  return cached;
};

export { buildOpenApiDocument };
