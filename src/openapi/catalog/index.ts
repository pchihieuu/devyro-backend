import { OpCatalog } from "../types";
import { authCatalog } from "./auth";
import { usersCatalog } from "./users";
import { jobsCatalog } from "./jobs";
import { applicationsCatalog } from "./applications";
import { analyticsCatalog, notificationsCatalog, savedJobsCatalog } from "./misc";
import { companiesCatalog } from "./companies";
import { chatCatalog } from "./chat";
import { blogsCatalog } from "./blogs";
import { groupsCatalog } from "./groups";

/** Gộp mô tả response của mọi module. Thiếu/thừa key so với router thật → generate fail. */
export const catalog: OpCatalog = {
  ...authCatalog,
  ...usersCatalog,
  ...jobsCatalog,
  ...applicationsCatalog,
  ...savedJobsCatalog,
  ...analyticsCatalog,
  ...notificationsCatalog,
  ...companiesCatalog,
  ...chatCatalog,
  ...blogsCatalog,
  ...groupsCatalog,
};
