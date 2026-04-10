import { Module } from '@nestjs/common';
import { ApplicationsService } from './applications.service';
import { ApplicationsController } from './applications.controller';
import { ApplicationsConsumerController } from './applications-consumer.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Application } from './entities/application.entity';
import { Job } from '../jobs/entities/job.entity';
import { Candidate } from '../candidates/entities/candidate.entity';
import { Skill } from '../skills/entities/skill.entity';
import { EntitySkill } from '../entity-skills/entities/entity-skill.entity';
import { MinioModule } from '../../infrastructure/minio/minio.module';
import { KafkaModule } from '../../kafka/kafka.module';
import { LlmModule } from '../../infrastructure/llm/llm.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Application, Job, Candidate, Skill, EntitySkill]),
    MinioModule,
    KafkaModule,
    LlmModule,
  ],
  controllers: [ApplicationsController, ApplicationsConsumerController],
  providers: [ApplicationsService],
})
export class ApplicationsModule {}
