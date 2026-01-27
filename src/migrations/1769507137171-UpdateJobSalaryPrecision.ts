import { MigrationInterface, QueryRunner } from "typeorm";

export class UpdateJobSalaryPrecision1769507137171 implements MigrationInterface {
    name = 'UpdateJobSalaryPrecision1769507137171'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "jobs" ALTER COLUMN "salaryMin" TYPE numeric(14,2)`);
        await queryRunner.query(`ALTER TABLE "jobs" ALTER COLUMN "salaryMax" TYPE numeric(14,2)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "jobs" ALTER COLUMN "salaryMax" TYPE numeric(10,2)`);
        await queryRunner.query(`ALTER TABLE "jobs" ALTER COLUMN "salaryMin" TYPE numeric(10,2)`);
    }

}
