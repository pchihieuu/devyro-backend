import { MigrationInterface, QueryRunner } from "typeorm";

export class AddEnumApplications1773232520043 implements MigrationInterface {
    name = 'AddEnumApplications1773232520043'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TYPE "public"."applications_status_enum" RENAME TO "applications_status_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."applications_status_enum" AS ENUM('Applied', 'In Review', 'Rejected', 'Accepted', 'Withdrawn', 'Interview')`);
        await queryRunner.query(`ALTER TABLE "applications" ALTER COLUMN "status" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "applications" ALTER COLUMN "status" TYPE "public"."applications_status_enum" USING "status"::"text"::"public"."applications_status_enum"`);
        await queryRunner.query(`ALTER TABLE "applications" ALTER COLUMN "status" SET DEFAULT 'Applied'`);
        await queryRunner.query(`DROP TYPE "public"."applications_status_enum_old"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."applications_status_enum_old" AS ENUM('Applied', 'In Review', 'Rejected', 'Accepted')`);
        await queryRunner.query(`ALTER TABLE "applications" ALTER COLUMN "status" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "applications" ALTER COLUMN "status" TYPE "public"."applications_status_enum_old" USING "status"::"text"::"public"."applications_status_enum_old"`);
        await queryRunner.query(`ALTER TABLE "applications" ALTER COLUMN "status" SET DEFAULT 'Applied'`);
        await queryRunner.query(`DROP TYPE "public"."applications_status_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."applications_status_enum_old" RENAME TO "applications_status_enum"`);
    }

}
