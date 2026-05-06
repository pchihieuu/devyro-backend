import { MigrationInterface, QueryRunner } from "typeorm";

export class AddSnakeCaseColumnNames1778079901302 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "group_members" RENAME COLUMN "groupId" TO "group_id"`);
    await queryRunner.query(`ALTER TABLE "group_members" RENAME COLUMN "userId" TO "user_id"`);
    await queryRunner.query(`ALTER TABLE "group_members" RENAME COLUMN "unreadCount" TO "unread_count"`);
    await queryRunner.query(`ALTER TABLE "group_members" RENAME COLUMN "lastReadAt" TO "last_read_at"`);
    await queryRunner.query(`ALTER TABLE "group_members" RENAME COLUMN "invitedAt" TO "invited_at"`);
    await queryRunner.query(`ALTER TABLE "group_members" RENAME COLUMN "invitedById" TO "invited_by_id"`);
    await queryRunner.query(`ALTER TABLE "group_members" RENAME COLUMN "respondedAt" TO "responded_at"`);

    await queryRunner.query(`ALTER TABLE "group_message_seen" RENAME COLUMN "messageId" TO "message_id"`);
    await queryRunner.query(`ALTER TABLE "group_message_seen" RENAME COLUMN "userId" TO "user_id"`);
    await queryRunner.query(`ALTER TABLE "group_message_seen" RENAME COLUMN "groupId" TO "group_id"`);
    await queryRunner.query(`ALTER TABLE "group_message_seen" RENAME COLUMN "seenAt" TO "seen_at"`);

    await queryRunner.query(`ALTER TABLE "group_messages" RENAME COLUMN "groupId" TO "group_id"`);
    await queryRunner.query(`ALTER TABLE "group_messages" RENAME COLUMN "senderId" TO "sender_id"`);
    await queryRunner.query(`ALTER TABLE "group_messages" RENAME COLUMN "replyToId" TO "reply_to_id"`);
    await queryRunner.query(`ALTER TABLE "group_messages" RENAME COLUMN "isDeleted" TO "is_deleted"`);

    await queryRunner.query(`ALTER TABLE "groups" RENAME COLUMN "createdById" TO "created_by_id"`);
    await queryRunner.query(`ALTER TABLE "groups" RENAME COLUMN "lastMessage" TO "last_message"`);
    await queryRunner.query(`ALTER TABLE "groups" RENAME COLUMN "lastMessageSenderId" TO "last_message_sender_id"`);
    await queryRunner.query(`ALTER TABLE "groups" RENAME COLUMN "lastMessageAt" TO "last_message_at"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "groups" RENAME COLUMN "created_by_id" TO "createdById"`);
    await queryRunner.query(`ALTER TABLE "groups" RENAME COLUMN "last_message" TO "lastMessage"`);
    await queryRunner.query(`ALTER TABLE "groups" RENAME COLUMN "last_message_sender_id" TO "lastMessageSenderId"`);
    await queryRunner.query(`ALTER TABLE "groups" RENAME COLUMN "last_message_at" TO "lastMessageAt"`);

    await queryRunner.query(`ALTER TABLE "group_messages" RENAME COLUMN "group_id" TO "groupId"`);
    await queryRunner.query(`ALTER TABLE "group_messages" RENAME COLUMN "sender_id" TO "senderId"`);
    await queryRunner.query(`ALTER TABLE "group_messages" RENAME COLUMN "reply_to_id" TO "replyToId"`);
    await queryRunner.query(`ALTER TABLE "group_messages" RENAME COLUMN "is_deleted" TO "isDeleted"`);

    await queryRunner.query(`ALTER TABLE "group_message_seen" RENAME COLUMN "message_id" TO "messageId"`);
    await queryRunner.query(`ALTER TABLE "group_message_seen" RENAME COLUMN "user_id" TO "userId"`);
    await queryRunner.query(`ALTER TABLE "group_message_seen" RENAME COLUMN "group_id" TO "groupId"`);
    await queryRunner.query(`ALTER TABLE "group_message_seen" RENAME COLUMN "seen_at" TO "seenAt"`);

    await queryRunner.query(`ALTER TABLE "group_members" RENAME COLUMN "group_id" TO "groupId"`);
    await queryRunner.query(`ALTER TABLE "group_members" RENAME COLUMN "user_id" TO "userId"`);
    await queryRunner.query(`ALTER TABLE "group_members" RENAME COLUMN "unread_count" TO "unreadCount"`);
    await queryRunner.query(`ALTER TABLE "group_members" RENAME COLUMN "last_read_at" TO "lastReadAt"`);
    await queryRunner.query(`ALTER TABLE "group_members" RENAME COLUMN "invited_at" TO "invitedAt"`);
    await queryRunner.query(`ALTER TABLE "group_members" RENAME COLUMN "invited_by_id" TO "invitedById"`);
    await queryRunner.query(`ALTER TABLE "group_members" RENAME COLUMN "responded_at" TO "respondedAt"`);
  }
}