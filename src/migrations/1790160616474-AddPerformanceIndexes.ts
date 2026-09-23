import { MigrationInterface, QueryRunner } from "typeorm";

export class AddPerformanceIndexes1790160616474 implements MigrationInterface {
  name = "AddPerformanceIndexes1790160616474";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE INDEX "IDX_group_messages_group_created" ON "group_messages" ("group_id", "createdAt")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_group_messages_senderId" ON "group_messages" ("sender_id")`
    );

    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_group_members_group_user" ON "group_members" ("group_id", "user_id")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_group_members_group_status" ON "group_members" ("group_id", "status")`
    );

    await queryRunner.query(
      `CREATE INDEX "IDX_messages_sender_receiver" ON "messages" ("senderId", "receiverId")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_messages_receiver_sender" ON "messages" ("receiverId", "senderId")`
    );

    await queryRunner.query(
      `CREATE INDEX "IDX_notifications_user_created" ON "notifications" ("userId", "createdAt")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_notifications_user_isRead" ON "notifications" ("userId", "isRead")`
    );

    // Partial unique index — only enforces uniqueness among active (non
    // soft-deleted) saved-job rows so the restore-after-unsave flow keeps working.
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_saved_jobs_job_jobseeker_active" ON "saved_jobs" ("jobId", "jobseekerId") WHERE "deletedAt" IS NULL`
    );

    await queryRunner.query(
      `CREATE INDEX "IDX_blog_post_views_post_viewed" ON "blog_post_views" ("postId", "viewedAt")`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_blog_post_views_post_viewed"`);
    await queryRunner.query(`DROP INDEX "IDX_saved_jobs_job_jobseeker_active"`);
    await queryRunner.query(`DROP INDEX "IDX_notifications_user_isRead"`);
    await queryRunner.query(`DROP INDEX "IDX_notifications_user_created"`);
    await queryRunner.query(`DROP INDEX "IDX_messages_receiver_sender"`);
    await queryRunner.query(`DROP INDEX "IDX_messages_sender_receiver"`);
    await queryRunner.query(`DROP INDEX "IDX_group_members_group_status"`);
    await queryRunner.query(`DROP INDEX "IDX_group_members_group_user"`);
    await queryRunner.query(`DROP INDEX "IDX_group_messages_senderId"`);
    await queryRunner.query(`DROP INDEX "IDX_group_messages_group_created"`);
  }
}
