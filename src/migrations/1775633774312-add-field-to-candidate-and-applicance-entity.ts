import { MigrationInterface, QueryRunner } from "typeorm";

export class AddFieldToCandidateAndApplicanceEntity1775633774312 implements MigrationInterface {
    name = 'AddFieldToCandidateAndApplicanceEntity1775633774312'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "Candidates" ADD "profileUrl" character varying`);
        await queryRunner.query(`ALTER TABLE "Applications" ADD "coverLetter" text`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "Applications" DROP COLUMN "coverLetter"`);
        await queryRunner.query(`ALTER TABLE "Candidates" DROP COLUMN "profileUrl"`);
    }

}
