import { MigrationInterface, QueryRunner } from "typeorm";

export class ConvertJobSkillsToArray1785316537640 implements MigrationInterface {
    name = "ConvertJobSkillsToArray1785316537640"
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "jobs" ADD COLUMN "skills_new" text[]`
    );

    await queryRunner.query(`
      UPDATE "jobs"
      SET "skills_new" = (
        SELECT array_agg(trim(s))
        FROM unnest(string_to_array("skills", ',')) AS s
      )
      WHERE "skills" IS NOT NULL AND "skills" <> ''
    `);

    await queryRunner.query(`ALTER TABLE "jobs" DROP COLUMN "skills"`);
    await queryRunner.query(
      `ALTER TABLE "jobs" RENAME COLUMN "skills_new" TO "skills"`
    );

    await queryRunner.query(`
      CREATE INDEX "IDX_jobs_skills_gin" ON "jobs" USING GIN ("skills")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_jobs_skills_gin"`);

    await queryRunner.query(`ALTER TABLE "jobs" ADD COLUMN "skills_old" text`);
    await queryRunner.query(`
      UPDATE "jobs"
      SET "skills_old" = array_to_string("skills", ',')
      WHERE "skills" IS NOT NULL
    `);
    await queryRunner.query(`ALTER TABLE "jobs" DROP COLUMN "skills"`);
    await queryRunner.query(
      `ALTER TABLE "jobs" RENAME COLUMN "skills_old" TO "skills"`
    );
  }
}
