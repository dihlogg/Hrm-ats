import { MigrationInterface, QueryRunner } from "typeorm";

export class UpdateEntityJobs1775206553803 implements MigrationInterface {
    name = 'UpdateEntityJobs1775206553803'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "Jobs" DROP COLUMN "title"`);
        await queryRunner.query(`ALTER TABLE "Jobs" DROP COLUMN "subTitle"`);
        await queryRunner.query(`ALTER TABLE "Jobs" ADD "jobTitleId" character varying`);
        await queryRunner.query(`ALTER TABLE "Jobs" ADD "jobTitleName" character varying`);
        await queryRunner.query(`ALTER TABLE "Jobs" ADD "subUnitId" character varying`);
        await queryRunner.query(`ALTER TABLE "Jobs" ADD "subUnitName" character varying`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "Jobs" DROP COLUMN "subUnitName"`);
        await queryRunner.query(`ALTER TABLE "Jobs" DROP COLUMN "subUnitId"`);
        await queryRunner.query(`ALTER TABLE "Jobs" DROP COLUMN "jobTitleName"`);
        await queryRunner.query(`ALTER TABLE "Jobs" DROP COLUMN "jobTitleId"`);
        await queryRunner.query(`ALTER TABLE "Jobs" ADD "subTitle" character varying`);
        await queryRunner.query(`ALTER TABLE "Jobs" ADD "title" character varying NOT NULL`);
    }

}
