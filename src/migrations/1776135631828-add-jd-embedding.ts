import { MigrationInterface, QueryRunner } from "typeorm";

export class AddJdEmbedding1776135631828 implements MigrationInterface {
    name = 'AddJdEmbedding1776135631828'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "Jobs" ADD "jdEmbedding" jsonb`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "Jobs" DROP COLUMN "jdEmbedding"`);
    }

}
