import { MigrationInterface, QueryRunner } from "typeorm";

export class LowercaseJobSkills1790781374873 implements MigrationInterface {
  name = "LowercaseJobSkills1790781374873";
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "jobs"
      SET "skills" = ARRAY(
        SELECT lower(btrim(s))
        FROM unnest("skills") WITH ORDINALITY AS t(s, ord)
        WHERE btrim(s) <> ''
        ORDER BY ord
      )
      WHERE "skills" IS NOT NULL
        AND "skills" IS DISTINCT FROM ARRAY(
          SELECT lower(btrim(s))
          FROM unnest("skills") WITH ORDINALITY AS t(s, ord)
          WHERE btrim(s) <> ''
          ORDER BY ord
        )
    `);
  }

  public async down(): Promise<void> {
    // Không thể khôi phục hoa/thường ban đầu — cố ý no-op (thay đổi an toàn,
    // dữ liệu mới vốn đã luôn lowercase).
  }
}
