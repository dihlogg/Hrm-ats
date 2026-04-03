import { MigrationInterface, QueryRunner } from "typeorm";

export class AddTitleToJob1775206898514 implements MigrationInterface {
    name = 'AddTitleToJob1775206898514'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "Jobs" ADD "title" character varying`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "Jobs" DROP COLUMN "title"`);
    }

}
