import { MigrationInterface, QueryRunner } from "typeorm";

export class AddUserProfileFields1771159873014 implements MigrationInterface {
    name = 'AddUserProfileFields1771159873014'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" ADD "username" character varying(50)`);
        await queryRunner.query(`ALTER TABLE "users" ADD CONSTRAINT "UQ_fe0bb3f6520ee0469504521e710" UNIQUE ("username")`);
        await queryRunner.query(`ALTER TABLE "users" ADD "title" character varying(100)`);
        await queryRunner.query(`ALTER TABLE "users" ADD "bio" text`);
        await queryRunner.query(`ALTER TABLE "users" ADD "location" character varying(255)`);
        await queryRunner.query(`CREATE TYPE "public"."users_workpreference_enum" AS ENUM('onsite', 'remote', 'hybrid')`);
        await queryRunner.query(`ALTER TABLE "users" ADD "workPreference" "public"."users_workpreference_enum"`);
        await queryRunner.query(`ALTER TABLE "users" ADD "hourlyRateMin" numeric(10,2)`);
        await queryRunner.query(`ALTER TABLE "users" ADD "hourlyRateMax" numeric(10,2)`);
        await queryRunner.query(`ALTER TABLE "users" ADD "completionRate" integer NOT NULL DEFAULT '0'`);
        await queryRunner.query(`ALTER TABLE "users" ADD "totalProjects" integer NOT NULL DEFAULT '0'`);
        await queryRunner.query(`ALTER TABLE "users" ADD "responseTimeHours" integer NOT NULL DEFAULT '2'`);
        await queryRunner.query(`CREATE TYPE "public"."users_availabilitystatus_enum" AS ENUM('available', 'busy', 'unavailable')`);
        await queryRunner.query(`ALTER TABLE "users" ADD "availabilityStatus" "public"."users_availabilitystatus_enum" NOT NULL DEFAULT 'available'`);
        await queryRunner.query(`ALTER TABLE "users" ADD "skills" text`);
        await queryRunner.query(`ALTER TABLE "users" ADD "experience" json`);
        await queryRunner.query(`ALTER TABLE "users" ADD "projects" json`);
        await queryRunner.query(`ALTER TABLE "users" ADD "rating" numeric(3,2) NOT NULL DEFAULT '0'`);
        await queryRunner.query(`ALTER TABLE "users" ADD "reviewCount" integer NOT NULL DEFAULT '0'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "reviewCount"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "rating"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "projects"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "experience"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "skills"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "availabilityStatus"`);
        await queryRunner.query(`DROP TYPE "public"."users_availabilitystatus_enum"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "responseTimeHours"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "totalProjects"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "completionRate"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "hourlyRateMax"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "hourlyRateMin"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "workPreference"`);
        await queryRunner.query(`DROP TYPE "public"."users_workpreference_enum"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "location"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "bio"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "title"`);
        await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT "UQ_fe0bb3f6520ee0469504521e710"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "username"`);
    }

}
