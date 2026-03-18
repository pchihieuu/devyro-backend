import { MigrationInterface, QueryRunner } from "typeorm";

export class UpdateSkillsForJob1773830699734 implements MigrationInterface {
    name = 'UpdateSkillsForJob1773830699734'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "jobs" ADD "skills" text`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "jobs" DROP COLUMN "skills"`);
    }

}
