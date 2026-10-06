import { MigrationInterface, QueryRunner } from "typeorm";

export class AddGroupMembersUserStatusIndex1790781383752 implements MigrationInterface {
  name = "AddGroupMembersUserStatusIndex1790781383752";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE INDEX "IDX_group_members_user_status" ON "group_members" ("user_id", "status")`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_group_members_user_status"`);
  }
}
