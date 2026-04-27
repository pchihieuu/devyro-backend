import { MigrationInterface, QueryRunner } from "typeorm";

export class InitVideoCallEnity1777218573012 implements MigrationInterface {
    name = 'InitVideoCallEnity1777218573012'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."video_calls_status_enum" AS ENUM('pending', 'active', 'ended', 'declined', 'missed', 'cancelled')`);
        await queryRunner.query(`CREATE TYPE "public"."video_calls_type_enum" AS ENUM('video', 'audio')`);
        await queryRunner.query(`CREATE TABLE "video_calls" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "roomId" character varying(255) NOT NULL, "initiatorId" uuid NOT NULL, "status" "public"."video_calls_status_enum" NOT NULL DEFAULT 'pending', "type" "public"."video_calls_type_enum" NOT NULL DEFAULT 'video', "startedAt" TIMESTAMP, "endedAt" TIMESTAMP, "durationSeconds" integer, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_9eae1f3a3a26a14c6f9197c2abf" UNIQUE ("roomId"), CONSTRAINT "PK_a57b6d74bf1422edbcf00e61aa6" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."call_participants_status_enum" AS ENUM('invited', 'joined', 'left', 'declined', 'missed')`);
        await queryRunner.query(`CREATE TABLE "call_participants" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "callId" uuid NOT NULL, "userId" uuid NOT NULL, "status" "public"."call_participants_status_enum" NOT NULL DEFAULT 'invited', "joinedAt" TIMESTAMP, "leftAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_70fa47f8dcabf5603fee79564dc" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "video_calls" ADD CONSTRAINT "FK_71bafc45566760b39bdd5e62c4f" FOREIGN KEY ("initiatorId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "call_participants" ADD CONSTRAINT "FK_d9346eeef1d547e6d06221bfbf6" FOREIGN KEY ("callId") REFERENCES "video_calls"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "call_participants" ADD CONSTRAINT "FK_585dbc053038a753134270af8e1" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "call_participants" DROP CONSTRAINT "FK_585dbc053038a753134270af8e1"`);
        await queryRunner.query(`ALTER TABLE "call_participants" DROP CONSTRAINT "FK_d9346eeef1d547e6d06221bfbf6"`);
        await queryRunner.query(`ALTER TABLE "video_calls" DROP CONSTRAINT "FK_71bafc45566760b39bdd5e62c4f"`);
        await queryRunner.query(`DROP TABLE "call_participants"`);
        await queryRunner.query(`DROP TYPE "public"."call_participants_status_enum"`);
        await queryRunner.query(`DROP TABLE "video_calls"`);
        await queryRunner.query(`DROP TYPE "public"."video_calls_type_enum"`);
        await queryRunner.query(`DROP TYPE "public"."video_calls_status_enum"`);
    }

}
