import { MigrationInterface, QueryRunner } from "typeorm";

export class RenameSubTitle1775187364125 implements MigrationInterface {
    name = 'RenameSubTitle1775187364125'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "Jobs" RENAME COLUMN "subtitle" TO "subTitle"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "Jobs" RENAME COLUMN "subTitle" TO "subtitle"`);
    }

}
