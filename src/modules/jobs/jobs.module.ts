import { Module } from '@nestjs/common';
import { JobsService } from './jobs.service';
import { JobsController } from './jobs.controller';
import { Job } from './entities/job.entity';
import { Skill } from '../skills/entities/skill.entity';
import { EntitySkill } from '../entity-skills/entities/entity-skill.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LlmModule } from '../../infrastructure/llm/llm.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Job, Skill, EntitySkill]),
    LlmModule,
  ],
  controllers: [JobsController],
  providers: [JobsService],
  exports: [TypeOrmModule, JobsService],
})
export class JobsModule {}
