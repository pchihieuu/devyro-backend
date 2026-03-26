import { MigrationInterface, QueryRunner } from "typeorm";

export class AddBlogTables1774434267278 implements MigrationInterface {
    name = 'AddBlogTables1774434267278'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "blog_tags" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying(100) NOT NULL, "slug" character varying(100) NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_eebefefef8fb6e935ba77d0a6ac" UNIQUE ("name"), CONSTRAINT "UQ_afc33ebb304bb6ee9dc0a26c5d9" UNIQUE ("slug"), CONSTRAINT "PK_8880485f371f1892310811845c8" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "blog_post_views" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "postId" uuid NOT NULL, "ipAddress" character varying(45), "userAgent" character varying, "userId" uuid, "viewedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_3435b9994ac02b414475c3407aa" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."blog_posts_status_enum" AS ENUM('draft', 'published', 'archived')`);
        await queryRunner.query(`CREATE TABLE "blog_posts" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "title" character varying(255) NOT NULL, "slug" character varying(280) NOT NULL, "excerpt" text, "content" text NOT NULL, "thumbnail" character varying, "status" "public"."blog_posts_status_enum" NOT NULL DEFAULT 'draft', "viewCount" integer NOT NULL DEFAULT '0', "publishedAt" TIMESTAMP, "authorId" uuid NOT NULL, "categoryId" uuid NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, CONSTRAINT "UQ_5b2818a2c45c3edb9991b1c7a51" UNIQUE ("slug"), CONSTRAINT "PK_dd2add25eac93daefc93da9d387" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."blog_categories_type_enum" AS ENUM('portal_news', 'industry_news')`);
        await queryRunner.query(`CREATE TABLE "blog_categories" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying(255) NOT NULL, "slug" character varying(255) NOT NULL, "description" text, "type" "public"."blog_categories_type_enum" NOT NULL, "isActive" boolean NOT NULL DEFAULT true, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_903a6ea496e83ba9bec10af5835" UNIQUE ("slug"), CONSTRAINT "PK_1056d6faca26b9957f5d26e6572" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "blog_post_tags" ("postId" uuid NOT NULL, "tagId" uuid NOT NULL, CONSTRAINT "PK_7a476784993f0b6be2c2cde4f44" PRIMARY KEY ("postId", "tagId"))`);
        await queryRunner.query(`CREATE INDEX "IDX_ad4d63c771dcd9365fe4fe5a46" ON "blog_post_tags" ("postId") `);
        await queryRunner.query(`CREATE INDEX "IDX_d6e4bd52e7bf4bd69be040cb17" ON "blog_post_tags" ("tagId") `);
        await queryRunner.query(`ALTER TABLE "blog_post_views" ADD CONSTRAINT "FK_144f794d0931d5b4d89a252499f" FOREIGN KEY ("postId") REFERENCES "blog_posts"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "blog_posts" ADD CONSTRAINT "FK_09269227c7acf3cdf47ea4051e1" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "blog_posts" ADD CONSTRAINT "FK_aaf6cdeebd8497289338899961b" FOREIGN KEY ("categoryId") REFERENCES "blog_categories"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "blog_post_tags" ADD CONSTRAINT "FK_ad4d63c771dcd9365fe4fe5a463" FOREIGN KEY ("postId") REFERENCES "blog_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "blog_post_tags" ADD CONSTRAINT "FK_d6e4bd52e7bf4bd69be040cb17d" FOREIGN KEY ("tagId") REFERENCES "blog_tags"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "blog_post_tags" DROP CONSTRAINT "FK_d6e4bd52e7bf4bd69be040cb17d"`);
        await queryRunner.query(`ALTER TABLE "blog_post_tags" DROP CONSTRAINT "FK_ad4d63c771dcd9365fe4fe5a463"`);
        await queryRunner.query(`ALTER TABLE "blog_posts" DROP CONSTRAINT "FK_aaf6cdeebd8497289338899961b"`);
        await queryRunner.query(`ALTER TABLE "blog_posts" DROP CONSTRAINT "FK_09269227c7acf3cdf47ea4051e1"`);
        await queryRunner.query(`ALTER TABLE "blog_post_views" DROP CONSTRAINT "FK_144f794d0931d5b4d89a252499f"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_d6e4bd52e7bf4bd69be040cb17"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_ad4d63c771dcd9365fe4fe5a46"`);
        await queryRunner.query(`DROP TABLE "blog_post_tags"`);
        await queryRunner.query(`DROP TABLE "blog_categories"`);
        await queryRunner.query(`DROP TYPE "public"."blog_categories_type_enum"`);
        await queryRunner.query(`DROP TABLE "blog_posts"`);
        await queryRunner.query(`DROP TYPE "public"."blog_posts_status_enum"`);
        await queryRunner.query(`DROP TABLE "blog_post_views"`);
        await queryRunner.query(`DROP TABLE "blog_tags"`);
    }

}
