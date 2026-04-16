import { MigrationInterface, QueryRunner } from "typeorm";

export class AddCvEmbedding1776309069691 implements MigrationInterface {
    name = 'AddCvEmbedding1776309069691'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "Candidates" ADD "cvEmbedding" jsonb`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "Candidates" DROP COLUMN "cvEmbedding"`);
    }

}
