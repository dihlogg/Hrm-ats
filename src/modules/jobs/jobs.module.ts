import { Module } from '@nestjs/common';
import { JobsService } from './jobs.service';
import { JobsController } from './jobs.controller';
import { JobsParsingConsumerController } from './jobs-parsing-consumer.controller';
import { Job } from './entities/job.entity';
import { Skill } from '../skills/entities/skill.entity';
import { EntitySkill } from '../entity-skills/entities/entity-skill.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { KafkaModule } from '../../kafka/kafka.module';
import { LlmModule } from '../../infrastructure/llm/llm.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Job, Skill, EntitySkill]),
    KafkaModule,
    LlmModule,
  ],
  controllers: [JobsController, JobsParsingConsumerController],
  providers: [JobsService],
  exports: [TypeOrmModule, JobsService],
})
export class JobsModule {}
