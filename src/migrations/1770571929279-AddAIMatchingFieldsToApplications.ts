import { MigrationInterface, QueryRunner } from "typeorm";

export class AddAIMatchingFieldsToApplications1770571929279 implements MigrationInterface {
    name = 'AddAIMatchingFieldsToApplications1770571929279'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "applications" ADD "aiMatchingScore" numeric(5,2)`);
        await queryRunner.query(`COMMENT ON COLUMN "applications"."aiMatchingScore" IS 'AI-generated matching score (0-100)'`);
        await queryRunner.query(`ALTER TABLE "applications" ADD "aiMatchingAnalysis" jsonb`);
        await queryRunner.query(`COMMENT ON COLUMN "applications"."aiMatchingAnalysis" IS 'Detailed AI analysis'`);
        await queryRunner.query(`ALTER TABLE "applications" ADD "aiAnalyzedAt" TIMESTAMP`);
        await queryRunner.query(`COMMENT ON COLUMN "applications"."aiAnalyzedAt" IS 'Timestamp when AI analysis was performed'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`COMMENT ON COLUMN "applications"."aiAnalyzedAt" IS 'Timestamp when AI analysis was performed'`);
        await queryRunner.query(`ALTER TABLE "applications" DROP COLUMN "aiAnalyzedAt"`);
        await queryRunner.query(`COMMENT ON COLUMN "applications"."aiMatchingAnalysis" IS 'Detailed AI analysis'`);
        await queryRunner.query(`ALTER TABLE "applications" DROP COLUMN "aiMatchingAnalysis"`);
        await queryRunner.query(`COMMENT ON COLUMN "applications"."aiMatchingScore" IS 'AI-generated matching score (0-100)'`);
        await queryRunner.query(`ALTER TABLE "applications" DROP COLUMN "aiMatchingScore"`);
    }

}
