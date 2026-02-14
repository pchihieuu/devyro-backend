import { MigrationInterface, QueryRunner } from "typeorm";

export class AddConversation1770650019347 implements MigrationInterface {
    name = 'AddConversation1770650019347'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."messages_type_enum" AS ENUM('text', 'image', 'file')`);
        await queryRunner.query(`CREATE TABLE "messages" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "senderId" uuid NOT NULL, "receiverId" uuid NOT NULL, "content" text NOT NULL, "type" "public"."messages_type_enum" NOT NULL DEFAULT 'text', "fileUrl" character varying, "isRead" boolean NOT NULL DEFAULT false, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_18325f38ae6de43878487eff986" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "conversations" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user1Id" uuid NOT NULL, "user2Id" uuid NOT NULL, "lastMessage" text, "lastMessageSenderId" uuid, "lastMessageAt" TIMESTAMP, "user1UnreadCount" integer NOT NULL DEFAULT '0', "user2UnreadCount" integer NOT NULL DEFAULT '0', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_ee34f4f7ced4ec8681f26bf04ef" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "messages" ADD CONSTRAINT "FK_2db9cf2b3ca111742793f6c37ce" FOREIGN KEY ("senderId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "messages" ADD CONSTRAINT "FK_acf951a58e3b9611dd96ce89042" FOREIGN KEY ("receiverId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "conversations" ADD CONSTRAINT "FK_5ecde0e8532667bde83d87ed0b4" FOREIGN KEY ("user1Id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "conversations" ADD CONSTRAINT "FK_47c90625a3eed92def079e1a78d" FOREIGN KEY ("user2Id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "conversations" DROP CONSTRAINT "FK_47c90625a3eed92def079e1a78d"`);
        await queryRunner.query(`ALTER TABLE "conversations" DROP CONSTRAINT "FK_5ecde0e8532667bde83d87ed0b4"`);
        await queryRunner.query(`ALTER TABLE "messages" DROP CONSTRAINT "FK_acf951a58e3b9611dd96ce89042"`);
        await queryRunner.query(`ALTER TABLE "messages" DROP CONSTRAINT "FK_2db9cf2b3ca111742793f6c37ce"`);
        await queryRunner.query(`DROP TABLE "conversations"`);
        await queryRunner.query(`DROP TABLE "messages"`);
        await queryRunner.query(`DROP TYPE "public"."messages_type_enum"`);
    }

}
