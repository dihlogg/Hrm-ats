import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { CreateApplicationDto } from './dto/create-application.dto';
import { DataSource } from 'typeorm';
import { MinioService } from '../../infrastructure/minio/minio.service';
import { Candidate } from '../candidates/entities/candidate.entity';
import { Job } from '../jobs/entities/job.entity';
import { Application } from './entities/application.entity';

@Injectable()
export class ApplicationsService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly minioService: MinioService,
  ) {}

  // api get presigned url upload cv to minio
  async getPresignedUrl(fileName: string, contentType: string) {
    return this.minioService.generatePresignedUrl(fileName, contentType);
  }

  async applyJob(dto: CreateApplicationDto) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const job = await queryRunner.manager.findOne(Job, {
        where: { id: dto.jobId },
      });
      if (!job) {
        throw new NotFoundException('Job không tồn tại!');
      }

      let candidate = await queryRunner.manager.findOne(Candidate, {
        where: { email: dto.email },
      });

      if (!candidate) {
        candidate = queryRunner.manager.create(Candidate, {
          fullName: dto.fullName,
          email: dto.email,
          phoneNumber: dto.phoneNumber,
          profileUrl: dto.profileUrl,
          storageKey: dto.storageKey,
        });
        candidate = await queryRunner.manager.save(candidate);
      } else {
        candidate.fullName = dto.fullName;
        candidate.phoneNumber = dto.phoneNumber;
        candidate.profileUrl = dto.profileUrl || candidate.profileUrl;
        candidate.storageKey = dto.storageKey;
        candidate = await queryRunner.manager.save(candidate);
      }

      const application = queryRunner.manager.create(Application, {
        job: { id: job.id },
        candidate: { id: candidate.id },
        status: 'PARSING',
        coverLetter: dto.coverLetter,
        jobSnapshotJson: {
          jobTitleName: job.jobTitleName,
          level: job.level,
          location: job.location,
        },
      });

      const savedApplication = await queryRunner.manager.save(application);

      await queryRunner.commitTransaction();
      return savedApplication;
    } catch (error: any) {
      await queryRunner.rollbackTransaction();
      throw new InternalServerErrorException(
        'Submission failed: ' + error.message,
      );
    } finally {
      await queryRunner.release();
    }
  }
}
