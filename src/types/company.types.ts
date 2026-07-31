import { Company } from "../entities/Company.entity";

export type CompanySummary = Company & {
  employer: Pick<Company["employer"], "id" | "name" | "email">;
};

export type CompanyDetail = Company & {
  employer: Pick<Company["employer"], "id" | "name" | "email" | "avatar">;
};
