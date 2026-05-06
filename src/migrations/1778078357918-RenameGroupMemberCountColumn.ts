import { MigrationInterface, QueryRunner } from "typeorm";

export class RenameGroupMemberCountColumn1778078357918 implements MigrationInterface {
    name = 'RenameGroupMemberCountColumn1778078357918'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "groups" RENAME COLUMN "memberCount" TO "member_count"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "groups" RENAME COLUMN "member_count" TO "memberCount"`);
    }

}
