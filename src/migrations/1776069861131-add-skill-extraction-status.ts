import { MigrationInterface, QueryRunner } from "typeorm";

export class AddSkillExtractionStatus1776069861131 implements MigrationInterface {
    name = 'AddSkillExtractionStatus1776069861131'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."Jobs_skillsextractionstatus_enum" AS ENUM('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED')`);
        await queryRunner.query(`ALTER TABLE "Jobs" ADD "skillsExtractionStatus" "public"."Jobs_skillsextractionstatus_enum" NOT NULL DEFAULT 'PENDING'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "Jobs" DROP COLUMN "skillsExtractionStatus"`);
        await queryRunner.query(`DROP TYPE "public"."Jobs_skillsextractionstatus_enum"`);
    }

}
