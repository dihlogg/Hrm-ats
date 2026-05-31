import { Module } from '@nestjs/common';
import { ApplicationsService } from './applications.service';
import { ApplicationsController } from './applications.controller';
import { ApplicationsConsumerController } from './applications-consumer.controller';
import { ApplicationsMatchingConsumerController } from './applications-matching-consumer.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Application } from './entities/application.entity';
import { Job } from '../jobs/entities/job.entity';
import { Candidate } from '../candidates/entities/candidate.entity';
import { CandidateCv } from '../candidates/entities/candidate-cv.entity';
import { Skill } from '../skills/entities/skill.entity';
import { EntitySkill } from '../entity-skills/entities/entity-skill.entity';
import { MinioModule } from '../../infrastructure/minio/minio.module';
import { KafkaModule } from '../../kafka/kafka.module';
import { LlmModule } from '../../infrastructure/llm/llm.module';
import { MatchingModule } from '../../core-ai/matching/matching.module';
import { NlpModule } from '../../core-ai/nlp/nlp.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Application,
      Job,
      Candidate,
      CandidateCv,
      Skill,
      EntitySkill,
    ]),
    MinioModule,
    KafkaModule,
    LlmModule,
    MatchingModule,
    NlpModule,
  ],
  controllers: [
    ApplicationsController,
    ApplicationsConsumerController,
    ApplicationsMatchingConsumerController,
  ],
  providers: [ApplicationsService],
})
export class ApplicationsModule {}
