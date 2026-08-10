import { MigrationInterface, QueryRunner } from "typeorm";

export class ConvertUserSkillsToArray1786097561877 implements MigrationInterface {
  name = "ConvertUserSkillsToArray1786097561877";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
      ALTER COLUMN "skills" TYPE text[]
      USING (
        CASE
          WHEN "skills" IS NULL OR "skills" = '' THEN NULL
          ELSE string_to_array("skills", ',')
        END
      )
    `);

    await queryRunner.query(`
      ALTER TABLE "users" ALTER COLUMN "skills" SET DEFAULT NULL
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_users_skills_gin" ON "users" USING GIN ("skills")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_users_skills_gin"`);

    await queryRunner.query(`
      ALTER TABLE "users"
      ALTER COLUMN "skills" TYPE text
      USING (
        CASE
          WHEN "skills" IS NULL THEN NULL
          ELSE array_to_string("skills", ',')
        END
      )
    `);
  }
}
