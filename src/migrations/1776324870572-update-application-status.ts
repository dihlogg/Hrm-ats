import { MigrationInterface, QueryRunner } from "typeorm";

export class UpdateApplicationStatus1776324870572 implements MigrationInterface {
    name = 'UpdateApplicationStatus1776324870572'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Set DEFAULT 'PARSING' cho cột status (từ việc thêm ApplicationStatus enum vào entity)
        await queryRunner.query(`ALTER TABLE "Applications" ALTER COLUMN "status" SET DEFAULT 'PARSING'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "Applications" ALTER COLUMN "status" DROP DEFAULT`);
    }

}
