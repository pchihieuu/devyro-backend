import { MigrationInterface, QueryRunner, TableForeignKey } from "typeorm";

export class FixBlogPostFkOnDelete1787936999402 implements MigrationInterface {
  name = "FixBlogPostFkOnDelete1787936999402";

  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable("blog_posts");
    if (!table) {
      throw new Error('Table "blog_posts" not found');
    }

    const categoryFk = table.foreignKeys.find(
      (fk) => fk.columnNames.indexOf("categoryId") !== -1
    );
    if (categoryFk) {
      await queryRunner.dropForeignKey("blog_posts", categoryFk);
    }
    await queryRunner.createForeignKey(
      "blog_posts",
      new TableForeignKey({
        columnNames: ["categoryId"],
        referencedTableName: "blog_categories",
        referencedColumnNames: ["id"],
        onDelete: "RESTRICT",
      })
    );

    const authorFk = table.foreignKeys.find(
      (fk) => fk.columnNames.indexOf("authorId") !== -1
    );
    if (authorFk) {
      await queryRunner.dropForeignKey("blog_posts", authorFk);
    }
    await queryRunner.createForeignKey(
      "blog_posts",
      new TableForeignKey({
        columnNames: ["authorId"],
        referencedTableName: "users",
        referencedColumnNames: ["id"],
        onDelete: "RESTRICT",
      })
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable("blog_posts");
    if (!table) {
      throw new Error('Table "blog_posts" not found');
    }

    const categoryFk = table.foreignKeys.find(
      (fk) => fk.columnNames.indexOf("categoryId") !== -1
    );
    if (categoryFk) {
      await queryRunner.dropForeignKey("blog_posts", categoryFk);
    }
    await queryRunner.createForeignKey(
      "blog_posts",
      new TableForeignKey({
        columnNames: ["categoryId"],
        referencedTableName: "blog_categories",
        referencedColumnNames: ["id"],
        onDelete: "SET NULL",
      })
    );

    const authorFk = table.foreignKeys.find(
      (fk) => fk.columnNames.indexOf("authorId") !== -1
    );
    if (authorFk) {
      await queryRunner.dropForeignKey("blog_posts", authorFk);
    }
    await queryRunner.createForeignKey(
      "blog_posts",
      new TableForeignKey({
        columnNames: ["authorId"],
        referencedTableName: "users",
        referencedColumnNames: ["id"],
        onDelete: "SET NULL",
      })
    );
  }
}
