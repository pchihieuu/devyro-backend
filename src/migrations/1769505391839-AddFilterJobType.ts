import { MigrationInterface, QueryRunner } from "typeorm";

export class AddFilterJobType1769505391839 implements MigrationInterface {
    name = 'AddFilterJobType1769505391839'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."jobs_level_enum" AS ENUM('Intern', 'Fresher', 'Junior', 'Middle', 'Senior', 'Lead')`);
        await queryRunner.query(`ALTER TABLE "jobs" ADD "level" "public"."jobs_level_enum"`);
        await queryRunner.query(`CREATE INDEX "IDX_00f1309a74e7cc6d028d3f63e8" ON "jobs" ("title") `);
        await queryRunner.query(`CREATE INDEX "IDX_f803a854cd07320ee634d8887f" ON "jobs" ("location") `);
        await queryRunner.query(`CREATE INDEX "IDX_2b6d4fc98010e4fb9c4c4b8e6a" ON "jobs" ("category") `);
        await queryRunner.query(`CREATE INDEX "IDX_b3dc188bb49c6597addebf9a18" ON "jobs" ("type") `);
        await queryRunner.query(`CREATE INDEX "IDX_6a1a9932fbe3fdd22eb283f7b6" ON "jobs" ("level") `);
        await queryRunner.query(`CREATE INDEX "IDX_74ab147e615680b4b60d82d49c" ON "jobs" ("salaryMin") `);
        await queryRunner.query(`CREATE INDEX "IDX_7c0aa754fb2b0154cde1c7f15a" ON "jobs" ("salaryMax") `);
        await queryRunner.query(`CREATE INDEX "IDX_5461bb69d0f840fcb76930ea0f" ON "jobs" ("isClosed") `);
        await queryRunner.query(`CREATE INDEX "IDX_656cf816796738c59563a79787" ON "jobs" ("createdAt") `);
        await queryRunner.query(`CREATE INDEX "IDX_6ce4483dc65ed9d2e171269d80" ON "jobs" ("companyId") `);
        await queryRunner.query(`CREATE INDEX "IDX_93608bc7a3e8ea5c822c002869" ON "jobs" ("title", "location", "category") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_93608bc7a3e8ea5c822c002869"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_6ce4483dc65ed9d2e171269d80"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_656cf816796738c59563a79787"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_5461bb69d0f840fcb76930ea0f"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_7c0aa754fb2b0154cde1c7f15a"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_74ab147e615680b4b60d82d49c"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_6a1a9932fbe3fdd22eb283f7b6"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_b3dc188bb49c6597addebf9a18"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_2b6d4fc98010e4fb9c4c4b8e6a"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_f803a854cd07320ee634d8887f"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_00f1309a74e7cc6d028d3f63e8"`);
        await queryRunner.query(`ALTER TABLE "jobs" DROP COLUMN "level"`);
        await queryRunner.query(`DROP TYPE "public"."jobs_level_enum"`);
    }

}
