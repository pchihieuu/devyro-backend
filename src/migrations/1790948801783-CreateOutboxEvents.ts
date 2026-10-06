import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateOutboxEvents1790948801783 implements MigrationInterface {
  name = "CreateOutboxEvents1790948801783";
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "outbox_events" (
        "id" BIGSERIAL NOT NULL,
        "topic" character varying(100) NOT NULL,
        "payload" jsonb NOT NULL,
        "attempts" integer NOT NULL DEFAULT 0,
        "next_attempt_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        "locked_until" TIMESTAMP WITH TIME ZONE,
        "published_at" TIMESTAMP WITH TIME ZONE,
        "dead_at" TIMESTAMP WITH TIME ZONE,
        "last_error" text,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        CONSTRAINT "PK_outbox_events_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_outbox_events_pending" ON "outbox_events" ("next_attempt_at") WHERE "published_at" IS NULL AND "dead_at" IS NULL`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_outbox_events_published_at" ON "outbox_events" ("published_at")`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_outbox_events_published_at"`);
    await queryRunner.query(`DROP INDEX "IDX_outbox_events_pending"`);
    await queryRunner.query(`DROP TABLE "outbox_events"`);
  }
}
