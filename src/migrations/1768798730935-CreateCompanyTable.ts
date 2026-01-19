// src/migrations/[timestamp]-CreateCompanyTable.ts
import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
} from "typeorm";

export class CreateCompanyTable1234567890000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Kiểm tra xem bảng companies đã tồn tại chưa
    const tableExists = await queryRunner.hasTable("companies");

    if (!tableExists) {
      // 1. Tạo bảng companies
      await queryRunner.createTable(
        new Table({
          name: "companies",
          columns: [
            {
              name: "id",
              type: "uuid",
              isPrimary: true,
              generationStrategy: "uuid",
              default: "uuid_generate_v4()",
            },
            {
              name: "name",
              type: "varchar",
              length: "255",
            },
            {
              name: "description",
              type: "text",
              isNullable: true,
            },
            {
              name: "logo",
              type: "varchar",
              length: "500",
              isNullable: true,
            },
            {
              name: "size",
              type: "varchar",
              length: "100",
              isNullable: true,
            },
            {
              name: "industry",
              type: "varchar",
              length: "255",
              isNullable: true,
            },
            {
              name: "address",
              type: "varchar",
              length: "500",
              isNullable: true,
            },
            {
              name: "website",
              type: "varchar",
              length: "255",
              isNullable: true,
            },
            {
              name: "foundedYear",
              type: "varchar",
              length: "50",
              isNullable: true,
            },
            {
              name: "benefits",
              type: "text",
              isNullable: true,
            },
            {
              name: "totalJobs",
              type: "int",
              default: 0,
            },
            {
              name: "activeJobs",
              type: "int",
              default: 0,
            },
            {
              name: "employerId",
              type: "uuid",
              isUnique: true,
            },
            {
              name: "createdAt",
              type: "timestamp",
              default: "now()",
            },
            {
              name: "updatedAt",
              type: "timestamp",
              default: "now()",
            },
            {
              name: "deletedAt",
              type: "timestamp",
              isNullable: true,
            },
          ],
        }),
        true
      );

      // 2. Tạo foreign key với users
      await queryRunner.createForeignKey(
        "companies",
        new TableForeignKey({
          columnNames: ["employerId"],
          referencedColumnNames: ["id"],
          referencedTableName: "users",
          onDelete: "CASCADE",
        })
      );

      console.log("✅ Companies table created successfully");
    } else {
      console.log("⚠️ Companies table already exists, skipping creation");
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const tableExists = await queryRunner.hasTable("companies");

    if (tableExists) {
      await queryRunner.dropTable("companies");
      console.log("✅ Companies table dropped successfully");
    }
  }
}
