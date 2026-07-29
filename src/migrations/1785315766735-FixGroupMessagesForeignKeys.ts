import { MigrationInterface, QueryRunner } from "typeorm";

export class FixGroupMessagesForeignKeys1785315766735 implements MigrationInterface {
    name = 'FixGroupMessagesForeignKeys1785315766735'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "group_members" DROP CONSTRAINT "FK_d098ecaccb886e601cc6bab76a4"`);
        await queryRunner.query(`ALTER TABLE "group_members" DROP CONSTRAINT "FK_fdef099303bcf0ffd9a4a7b18f5"`);
        await queryRunner.query(`ALTER TABLE "group_members" DROP CONSTRAINT "FK_1aa8d31831c3126947e7a713c2b"`);
        await queryRunner.query(`ALTER TABLE "group_message_seen" DROP CONSTRAINT "FK_7f637bd0292be77009ec4a1b154"`);
        await queryRunner.query(`ALTER TABLE "group_message_seen" DROP CONSTRAINT "FK_5a45696067e82b40c011c1ac69c"`);
        await queryRunner.query(`ALTER TABLE "group_messages" DROP CONSTRAINT "FK_4d80ee0f113fc5ec863331990f0"`);
        await queryRunner.query(`ALTER TABLE "group_messages" DROP CONSTRAINT "FK_6c694d1eb78e62cf92dc31e9354"`);
        await queryRunner.query(`ALTER TABLE "group_messages" DROP CONSTRAINT "FK_8f9e67acada60b6ae7096c4f15f"`);
        await queryRunner.query(`ALTER TABLE "groups" DROP CONSTRAINT "FK_e0522c4be8bab20520896919da0"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_d15021a6ef9840d75966a1d0fa"`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_e8353253f56d41a91c178bf305" ON "group_message_seen" ("message_id", "user_id") `);
        await queryRunner.query(`ALTER TABLE "group_members" ADD CONSTRAINT "FK_2c840df5db52dc6b4a1b0b69c6e" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "group_members" ADD CONSTRAINT "FK_20a555b299f75843aa53ff8b0ee" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "group_members" ADD CONSTRAINT "FK_b382c0b598907b083c2b2440313" FOREIGN KEY ("invited_by_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "group_message_seen" ADD CONSTRAINT "FK_00e756dd8c65ff46ab8cdf42945" FOREIGN KEY ("message_id") REFERENCES "group_messages"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "group_message_seen" ADD CONSTRAINT "FK_19c906491ad6966d62278497a27" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "group_messages" ADD CONSTRAINT "FK_be264b91ac62d3b00c01212f565" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "group_messages" ADD CONSTRAINT "FK_ada93de56050fe469b3c53fe49f" FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "group_messages" ADD CONSTRAINT "FK_205d91278faea4c0ebbba5f14fa" FOREIGN KEY ("reply_to_id") REFERENCES "group_messages"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "groups" ADD CONSTRAINT "FK_65a98f23825ecdcdaaeefe1da15" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "groups" DROP CONSTRAINT "FK_65a98f23825ecdcdaaeefe1da15"`);
        await queryRunner.query(`ALTER TABLE "group_messages" DROP CONSTRAINT "FK_205d91278faea4c0ebbba5f14fa"`);
        await queryRunner.query(`ALTER TABLE "group_messages" DROP CONSTRAINT "FK_ada93de56050fe469b3c53fe49f"`);
        await queryRunner.query(`ALTER TABLE "group_messages" DROP CONSTRAINT "FK_be264b91ac62d3b00c01212f565"`);
        await queryRunner.query(`ALTER TABLE "group_message_seen" DROP CONSTRAINT "FK_19c906491ad6966d62278497a27"`);
        await queryRunner.query(`ALTER TABLE "group_message_seen" DROP CONSTRAINT "FK_00e756dd8c65ff46ab8cdf42945"`);
        await queryRunner.query(`ALTER TABLE "group_members" DROP CONSTRAINT "FK_b382c0b598907b083c2b2440313"`);
        await queryRunner.query(`ALTER TABLE "group_members" DROP CONSTRAINT "FK_20a555b299f75843aa53ff8b0ee"`);
        await queryRunner.query(`ALTER TABLE "group_members" DROP CONSTRAINT "FK_2c840df5db52dc6b4a1b0b69c6e"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_e8353253f56d41a91c178bf305"`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_d15021a6ef9840d75966a1d0fa" ON "group_message_seen" ("message_id", "user_id") `);
        await queryRunner.query(`ALTER TABLE "groups" ADD CONSTRAINT "FK_e0522c4be8bab20520896919da0" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "group_messages" ADD CONSTRAINT "FK_8f9e67acada60b6ae7096c4f15f" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "group_messages" ADD CONSTRAINT "FK_6c694d1eb78e62cf92dc31e9354" FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "group_messages" ADD CONSTRAINT "FK_4d80ee0f113fc5ec863331990f0" FOREIGN KEY ("reply_to_id") REFERENCES "group_messages"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "group_message_seen" ADD CONSTRAINT "FK_5a45696067e82b40c011c1ac69c" FOREIGN KEY ("message_id") REFERENCES "group_messages"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "group_message_seen" ADD CONSTRAINT "FK_7f637bd0292be77009ec4a1b154" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "group_members" ADD CONSTRAINT "FK_1aa8d31831c3126947e7a713c2b" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "group_members" ADD CONSTRAINT "FK_fdef099303bcf0ffd9a4a7b18f5" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "group_members" ADD CONSTRAINT "FK_d098ecaccb886e601cc6bab76a4" FOREIGN KEY ("invited_by_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

}
