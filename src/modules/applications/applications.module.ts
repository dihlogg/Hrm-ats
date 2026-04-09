import { Module } from '@nestjs/common';
import { ApplicationsService } from './applications.service';
import { ApplicationsController } from './applications.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Application } from './entities/application.entity';
import { Job } from '../jobs/entities/job.entity';
import { Candidate } from '../candidates/entities/candidate.entity';
import { MinioModule } from '../../infrastructure/minio/minio.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Application, Job, Candidate]),
    MinioModule,
  ],
  controllers: [ApplicationsController],
  providers: [ApplicationsService],
})
export class ApplicationsModule {}
