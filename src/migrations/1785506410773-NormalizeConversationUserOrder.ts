import { MigrationInterface, QueryRunner } from "typeorm";

export class NormalizeConversationUserOrder1785506410773 implements MigrationInterface {
  name = "NormalizeConversationUserOrder1785506410773";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Với mỗi cặp (user1Id, user2Id) đã bị đảo ngược ở >1 record (do
    //    race condition cũ), giữ lại record có lastMessageAt mới nhất
    //    (fallback createdAt), xoá các record trùng còn lại.
    //    Message không có FK tới Conversation nên xoá record trùng không
    //    mất tin nhắn.
    await queryRunner.query(`
      WITH normalized AS (
        SELECT
          id,
          LEAST("user1Id", "user2Id") AS norm_user1,
          GREATEST("user1Id", "user2Id") AS norm_user2,
          COALESCE("lastMessageAt", "createdAt") AS sort_key
        FROM conversations
      ),
      ranked AS (
        SELECT
          id,
          norm_user1,
          norm_user2,
          ROW_NUMBER() OVER (
            PARTITION BY norm_user1, norm_user2
            ORDER BY sort_key DESC
          ) AS rn
        FROM normalized
      )
      DELETE FROM conversations c
      USING ranked r
      WHERE c.id = r.id AND r.rn > 1;
    `);

    // 2. Với các record còn lại bị lưu ngược thứ tự (user1Id > user2Id),
    //    swap cả user1Id/user2Id lẫn user1UnreadCount/user2UnreadCount
    //    tương ứng để không đảo ngược ý nghĩa unread count.
    await queryRunner.query(`
      UPDATE conversations
      SET
        "user1Id" = "user2Id",
        "user2Id" = "user1Id",
        "user1UnreadCount" = "user2UnreadCount",
        "user2UnreadCount" = "user1UnreadCount"
      WHERE "user1Id" > "user2Id";
    `);

    // 3. Thêm unique constraint sau khi data đã chuẩn hoá.
    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_conversations_user1Id_user2Id"
      ON conversations ("user1Id", "user2Id");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX "IDX_conversations_user1Id_user2Id";
    `);
  }
}
