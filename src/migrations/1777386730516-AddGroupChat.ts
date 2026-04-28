import { MigrationInterface, QueryRunner } from "typeorm";

export class AddGroupChat1777386730516 implements MigrationInterface {
    name = 'AddGroupChat1777386730516'

    public async up(queryRunner: QueryRunner): Promise<void> {
   
        await queryRunner.query(`CREATE TYPE "public"."group_members_role_enum" AS ENUM('admin', 'member')`);
        await queryRunner.query(`CREATE TYPE "public"."group_members_status_enum" AS ENUM('pending', 'active', 'rejected', 'left', 'kicked')`);
        await queryRunner.query(`CREATE TYPE "public"."group_messages_type_enum" AS ENUM('text', 'image', 'file', 'video')`);
        await queryRunner.query(`CREATE TABLE "groups" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying(255) NOT NULL, "description" text, "avatar" character varying, "createdById" uuid NOT NULL, "lastMessage" text, "lastMessageSenderId" uuid, "lastMessageAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_659d1483316afb28afd3a90646e" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "group_members" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "groupId" uuid NOT NULL, "userId" uuid NOT NULL, "role" "public"."group_members_role_enum" NOT NULL DEFAULT 'member', "status" "public"."group_members_status_enum" NOT NULL DEFAULT 'pending', "unreadCount" integer NOT NULL DEFAULT '0', "lastReadAt" TIMESTAMP, "invitedAt" TIMESTAMP, "invitedById" uuid, "respondedAt" TIMESTAMP, "joinedAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_group_members" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "group_messages" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "groupId" uuid NOT NULL, "senderId" uuid NOT NULL, "content" text, "type" "public"."group_messages_type_enum" NOT NULL DEFAULT 'text', "fileUrl" character varying, "filePublicId" character varying, "fileName" character varying, "fileSize" integer, "fileMimeType" character varying, "replyToId" uuid, "isDeleted" boolean NOT NULL DEFAULT false, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_group_messages" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "group_message_seen" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "messageId" uuid NOT NULL, "userId" uuid NOT NULL, "groupId" uuid NOT NULL, "seenAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_group_message_seen" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_group_message_seen_messageId_userId" ON "group_message_seen" ("messageId", "userId") `);
        await queryRunner.query(`ALTER TABLE "groups" ADD CONSTRAINT "FK_groups_createdBy" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "group_members" ADD CONSTRAINT "FK_group_members_group" FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "group_members" ADD CONSTRAINT "FK_group_members_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "group_members" ADD CONSTRAINT "FK_group_members_invitedBy" FOREIGN KEY ("invitedById") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "group_messages" ADD CONSTRAINT "FK_group_messages_group" FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "group_messages" ADD CONSTRAINT "FK_group_messages_sender" FOREIGN KEY ("senderId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "group_messages" ADD CONSTRAINT "FK_group_messages_replyTo" FOREIGN KEY ("replyToId") REFERENCES "group_messages"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "group_message_seen" ADD CONSTRAINT "FK_group_message_seen_message" FOREIGN KEY ("messageId") REFERENCES "group_messages"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "group_message_seen" ADD CONSTRAINT "FK_group_message_seen_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "group_message_seen" DROP CONSTRAINT "FK_group_message_seen_user"`);
        await queryRunner.query(`ALTER TABLE "group_message_seen" DROP CONSTRAINT "FK_group_message_seen_message"`);
        await queryRunner.query(`ALTER TABLE "group_messages" DROP CONSTRAINT "FK_group_messages_replyTo"`);
        await queryRunner.query(`ALTER TABLE "group_messages" DROP CONSTRAINT "FK_group_messages_sender"`);
        await queryRunner.query(`ALTER TABLE "group_messages" DROP CONSTRAINT "FK_group_messages_group"`);
        await queryRunner.query(`ALTER TABLE "group_members" DROP CONSTRAINT "FK_group_members_invitedBy"`);
        await queryRunner.query(`ALTER TABLE "group_members" DROP CONSTRAINT "FK_group_members_user"`);
        await queryRunner.query(`ALTER TABLE "group_members" DROP CONSTRAINT "FK_group_members_group"`);
        await queryRunner.query(`ALTER TABLE "groups" DROP CONSTRAINT "FK_groups_createdBy"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_group_message_seen_messageId_userId"`);
        await queryRunner.query(`DROP TABLE "group_message_seen"`);
        await queryRunner.query(`DROP TABLE "group_messages"`);
        await queryRunner.query(`DROP TABLE "group_members"`);
        await queryRunner.query(`DROP TABLE "groups"`);
        await queryRunner.query(`DROP TYPE "public"."group_messages_type_enum"`);
        await queryRunner.query(`DROP TYPE "public"."group_members_status_enum"`);
        await queryRunner.query(`DROP TYPE "public"."group_members_role_enum"`);
    }
}