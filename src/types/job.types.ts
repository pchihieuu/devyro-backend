import { Job } from "../entities/Job.entity";

export type JobWithExtras = Job & {
  isSaved: boolean;
  applicationStatus: string | null;
};
