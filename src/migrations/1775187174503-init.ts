import { MigrationInterface, QueryRunner } from "typeorm";

export class Init1775187174503 implements MigrationInterface {
    name = 'Init1775187174503'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."Jobs_employmenttype_enum" AS ENUM('FULL_TIME', 'PART_TIME', 'REMOTE')`);
        await queryRunner.query(`CREATE TYPE "public"."Jobs_status_enum" AS ENUM('OPEN', 'CLOSED')`);
        await queryRunner.query(`CREATE TABLE "Jobs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createDate" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updateDate" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "employeeId" uuid NOT NULL, "title" character varying NOT NULL, "subtitle" character varying, "fromDate" TIMESTAMP WITH TIME ZONE, "toDate" TIMESTAMP WITH TIME ZONE, "employmentType" "public"."Jobs_employmenttype_enum" NOT NULL DEFAULT 'FULL_TIME', "location" character varying, "description" text, "responsibilities" text, "requirements" text, "benefits" text, "rawText" text, "parsedJson" jsonb, "fileUrl" character varying, "storageKey" character varying, "status" "public"."Jobs_status_enum" NOT NULL DEFAULT 'OPEN', CONSTRAINT "PK_ddbadaace6379f579179949faf2" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "Applications" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createDate" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updateDate" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "status" character varying NOT NULL, "jobSnapshotJson" jsonb, "matchScore" numeric, "skillMatchPercent" numeric, "experienceMatchStatus" character varying, "matchReason" text, "rawData" text, "jobId" uuid, "candidateId" uuid, CONSTRAINT "PK_c537e3b52a523f50799d618d596" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "Candidates" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createDate" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updateDate" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "full_name" character varying NOT NULL, "email" character varying NOT NULL, "phoneNumber" character varying, "rawCvText" text, "summary" text, "cvFileUrl" character varying, "storageKey" character varying, "metadata" jsonb, CONSTRAINT "PK_425a3c7f933ceb7985bedfa2f43" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "EntitySkills" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createDate" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updateDate" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "experienceYears" integer, "standardizedName" character varying, "skillId" uuid, "jobId" uuid, "candidateId" uuid, CONSTRAINT "PK_86d003ea4804863cf334669b171" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "Skills" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createDate" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updateDate" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "name" character varying NOT NULL, "category" character varying, CONSTRAINT "PK_2f371d611f4a29288e11c9b628e" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "Applications" ADD CONSTRAINT "FK_14374dd5cbcb36a3dcd2226eb73" FOREIGN KEY ("jobId") REFERENCES "Jobs"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "Applications" ADD CONSTRAINT "FK_e1e659c70eed08b325d8f75e181" FOREIGN KEY ("candidateId") REFERENCES "Candidates"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "EntitySkills" ADD CONSTRAINT "FK_8a8feb4b900d23449610869433a" FOREIGN KEY ("skillId") REFERENCES "Skills"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "EntitySkills" ADD CONSTRAINT "FK_f4da3f671a5628fa5fc6acc3d8a" FOREIGN KEY ("jobId") REFERENCES "Jobs"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "EntitySkills" ADD CONSTRAINT "FK_8659ba810618f53f43d6817aa57" FOREIGN KEY ("candidateId") REFERENCES "Candidates"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "EntitySkills" DROP CONSTRAINT "FK_8659ba810618f53f43d6817aa57"`);
        await queryRunner.query(`ALTER TABLE "EntitySkills" DROP CONSTRAINT "FK_f4da3f671a5628fa5fc6acc3d8a"`);
        await queryRunner.query(`ALTER TABLE "EntitySkills" DROP CONSTRAINT "FK_8a8feb4b900d23449610869433a"`);
        await queryRunner.query(`ALTER TABLE "Applications" DROP CONSTRAINT "FK_e1e659c70eed08b325d8f75e181"`);
        await queryRunner.query(`ALTER TABLE "Applications" DROP CONSTRAINT "FK_14374dd5cbcb36a3dcd2226eb73"`);
        await queryRunner.query(`DROP TABLE "Skills"`);
        await queryRunner.query(`DROP TABLE "EntitySkills"`);
        await queryRunner.query(`DROP TABLE "Candidates"`);
        await queryRunner.query(`DROP TABLE "Applications"`);
        await queryRunner.query(`DROP TABLE "Jobs"`);
        await queryRunner.query(`DROP TYPE "public"."Jobs_status_enum"`);
        await queryRunner.query(`DROP TYPE "public"."Jobs_employmenttype_enum"`);
    }

}
