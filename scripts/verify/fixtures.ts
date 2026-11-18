import type { DataSource, DeepPartial } from "typeorm";
import { User, UserRole } from "../../src/entities/User.entity";
import { Company } from "../../src/entities/Company.entity";
import { Job } from "../../src/entities/Job.entity";
import {
  Application,
  ApplicationStatus,
} from "../../src/entities/Application.entity";
import { generateAccessToken } from "../../src/utils/token.utils";

/** Tạo dữ liệu mẫu tối thiểu, email/tên duy nhất theo mỗi lần chạy. */
export class Fixtures {
  private seq = 0;
  constructor(
    private readonly ds: DataSource,
    readonly runId: string
  ) {}

  private next(): number {
    return ++this.seq;
  }

  async user(role: UserRole = UserRole.JOBSEEKER, name?: string): Promise<User> {
    const n = this.next();
    const repo = this.ds.getRepository(User);
    return repo.save(
      repo.create({
        name: name ?? `verify-user-${n}`,
        email: `verify-${this.runId}-${n}@example.test`,
        password: "not-a-real-hash",
        role,
      } as DeepPartial<User>)
    );
  }

  async company(employer: User): Promise<Company> {
    const repo = this.ds.getRepository(Company);
    return repo.save(
      repo.create({
        name: `Verify Co ${this.next()}`,
        description: "d",
        location: "x",
        industry: "i",
        size: "s",
        employerId: employer.id,
      } as DeepPartial<Company>)
    );
  }

  async job(
    company: Company,
    o: Partial<{
      title: string;
      skills: string[];
      isClosed: boolean;
      createdAt: Date;
    }> = {}
  ): Promise<Job> {
    const repo = this.ds.getRepository(Job);
    return repo.save(
      repo.create({
        title: o.title ?? `Verify Job ${this.next()}`,
        description: "d",
        requirement: "r",
        category: "IT",
        location: "l",
        type: "Full-time",
        companyId: company.id,
        isClosed: o.isClosed ?? false,
        skills: o.skills ?? ["react"],
        ...(o.createdAt && { createdAt: o.createdAt }),
      } as DeepPartial<Job>)
    );
  }

  async application(
    job: Job,
    applicant: User,
    status: ApplicationStatus,
    createdAt: Date
  ): Promise<Application> {
    const repo = this.ds.getRepository(Application);
    return repo.save(
      repo.create({
        jobId: job.id,
        applicantId: applicant.id,
        status,
        createdAt,
      } as DeepPartial<Application>)
    );
  }

  tokenFor(user: User): string {
    return generateAccessToken({
      id: user.id,
      email: user.email,
      role: user.role,
    } as never);
  }
}
