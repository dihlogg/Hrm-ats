import { MigrationInterface, QueryRunner } from "typeorm";

export class AddJobLevelEntity1775294635300 implements MigrationInterface {
    name = 'AddJobLevelEntity1775294635300'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "Jobs" ADD "level" character varying`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "Jobs" DROP COLUMN "level"`);
    }

}
