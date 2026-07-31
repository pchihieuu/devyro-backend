import { MigrationInterface, QueryRunner } from "typeorm";

export class RenameConversationUserIndexToExplicit1785514203689 implements MigrationInterface {
  name = "RenameConversationUserIndexToExplicit1785514203689";

  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasHashIndex = await queryRunner.query(`
      SELECT 1 FROM pg_indexes
      WHERE schemaname = 'public' AND indexname = 'IDX_0a0db99cefe97147bef6bd89a0'
    `);
    if (hasHashIndex.length > 0) {
      await queryRunner.query(`
        ALTER INDEX "IDX_0a0db99cefe97147bef6bd89a0"
        RENAME TO "IDX_conversations_user1Id_user2Id";
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const hasExplicitIndex = await queryRunner.query(`
      SELECT 1 FROM pg_indexes
      WHERE schemaname = 'public' AND indexname = 'IDX_conversations_user1Id_user2Id'
    `);
    if (hasExplicitIndex.length > 0) {
      await queryRunner.query(`
        ALTER INDEX "IDX_conversations_user1Id_user2Id"
        RENAME TO "IDX_0a0db99cefe97147bef6bd89a0";
      `);
    }
  }
}
