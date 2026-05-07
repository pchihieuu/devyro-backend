import { MigrationInterface, QueryRunner } from "typeorm";

export class AddMemberCountGroups1778077672661 implements MigrationInterface {
    name = 'AddMemberCountGroups1778077672661'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "group_members" DROP CONSTRAINT "FK_group_members_invitedBy"`);
        await queryRunner.query(`ALTER TABLE "group_members" DROP CONSTRAINT "FK_group_members_user"`);
        await queryRunner.query(`ALTER TABLE "group_members" DROP CONSTRAINT "FK_group_members_group"`);
        await queryRunner.query(`ALTER TABLE "group_message_seen" DROP CONSTRAINT "FK_group_message_seen_user"`);
        await queryRunner.query(`ALTER TABLE "group_message_seen" DROP CONSTRAINT "FK_group_message_seen_message"`);
        await queryRunner.query(`ALTER TABLE "group_messages" DROP CONSTRAINT "FK_group_messages_replyTo"`);
        await queryRunner.query(`ALTER TABLE "group_messages" DROP CONSTRAINT "FK_group_messages_sender"`);
        await queryRunner.query(`ALTER TABLE "group_messages" DROP CONSTRAINT "FK_group_messages_group"`);
        await queryRunner.query(`ALTER TABLE "groups" DROP CONSTRAINT "FK_groups_createdBy"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_group_message_seen_messageId_userId"`);
        await queryRunner.query(`ALTER TABLE "groups" ADD "memberCount" integer NOT NULL DEFAULT '0'`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_d15021a6ef9840d75966a1d0fa" ON "group_message_seen" ("messageId", "userId") `);
        await queryRunner.query(`ALTER TABLE "group_members" ADD CONSTRAINT "FK_1aa8d31831c3126947e7a713c2b" FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "group_members" ADD CONSTRAINT "FK_fdef099303bcf0ffd9a4a7b18f5" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "group_members" ADD CONSTRAINT "FK_d098ecaccb886e601cc6bab76a4" FOREIGN KEY ("invitedById") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "group_message_seen" ADD CONSTRAINT "FK_5a45696067e82b40c011c1ac69c" FOREIGN KEY ("messageId") REFERENCES "group_messages"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "group_message_seen" ADD CONSTRAINT "FK_7f637bd0292be77009ec4a1b154" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "group_messages" ADD CONSTRAINT "FK_8f9e67acada60b6ae7096c4f15f" FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "group_messages" ADD CONSTRAINT "FK_6c694d1eb78e62cf92dc31e9354" FOREIGN KEY ("senderId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "group_messages" ADD CONSTRAINT "FK_4d80ee0f113fc5ec863331990f0" FOREIGN KEY ("replyToId") REFERENCES "group_messages"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "groups" ADD CONSTRAINT "FK_e0522c4be8bab20520896919da0" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "groups" DROP CONSTRAINT "FK_e0522c4be8bab20520896919da0"`);
        await queryRunner.query(`ALTER TABLE "group_messages" DROP CONSTRAINT "FK_4d80ee0f113fc5ec863331990f0"`);
        await queryRunner.query(`ALTER TABLE "group_messages" DROP CONSTRAINT "FK_6c694d1eb78e62cf92dc31e9354"`);
        await queryRunner.query(`ALTER TABLE "group_messages" DROP CONSTRAINT "FK_8f9e67acada60b6ae7096c4f15f"`);
        await queryRunner.query(`ALTER TABLE "group_message_seen" DROP CONSTRAINT "FK_7f637bd0292be77009ec4a1b154"`);
        await queryRunner.query(`ALTER TABLE "group_message_seen" DROP CONSTRAINT "FK_5a45696067e82b40c011c1ac69c"`);
        await queryRunner.query(`ALTER TABLE "group_members" DROP CONSTRAINT "FK_d098ecaccb886e601cc6bab76a4"`);
        await queryRunner.query(`ALTER TABLE "group_members" DROP CONSTRAINT "FK_fdef099303bcf0ffd9a4a7b18f5"`);
        await queryRunner.query(`ALTER TABLE "group_members" DROP CONSTRAINT "FK_1aa8d31831c3126947e7a713c2b"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_d15021a6ef9840d75966a1d0fa"`);
        await queryRunner.query(`ALTER TABLE "groups" DROP COLUMN "memberCount"`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_group_message_seen_messageId_userId" ON "group_message_seen" ("messageId", "userId") `);
        await queryRunner.query(`ALTER TABLE "groups" ADD CONSTRAINT "FK_groups_createdBy" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "group_messages" ADD CONSTRAINT "FK_group_messages_group" FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "group_messages" ADD CONSTRAINT "FK_group_messages_sender" FOREIGN KEY ("senderId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "group_messages" ADD CONSTRAINT "FK_group_messages_replyTo" FOREIGN KEY ("replyToId") REFERENCES "group_messages"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "group_message_seen" ADD CONSTRAINT "FK_group_message_seen_message" FOREIGN KEY ("messageId") REFERENCES "group_messages"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "group_message_seen" ADD CONSTRAINT "FK_group_message_seen_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "group_members" ADD CONSTRAINT "FK_group_members_group" FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "group_members" ADD CONSTRAINT "FK_group_members_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "group_members" ADD CONSTRAINT "FK_group_members_invitedBy" FOREIGN KEY ("invitedById") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

}
