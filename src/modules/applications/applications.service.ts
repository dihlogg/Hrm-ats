import {
  BadRequestException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { CreateApplicationDto } from './dto/create-application.dto';
import { GetApplicationsByJobDto } from './dto/get-applications-by-job.dto';
import { DataSource } from 'typeorm';
import { MinioService } from '../../infrastructure/minio/minio.service';
import { Candidate } from '../candidates/entities/candidate.entity';
import { Job } from '../jobs/entities/job.entity';
import { Application, ApplicationStatus } from './entities/application.entity';
import { ProducerService } from '../../kafka/producers/producer.service';
import { KAFKA_TOPICS } from '../../kafka/config/kafka-topics.constant';
import { paginateAndFormat } from '../../utils/pagination/pagination.util';

@Injectable()
export class ApplicationsService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly minioService: MinioService,
    private readonly producerService: ProducerService,
  ) { }

  // get presigned url upload cv to minio
  async getPresignedUrl(fileName: string, contentType: string) {
    return this.minioService.generatePresignedUrl(fileName, contentType);
  }

  // get presigned url to download/view a CV from minio
  async getPresignedDownloadUrl(storageKey: string) {
    return this.minioService.generateDownloadPresignedUrl(storageKey);
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
        throw new NotFoundException('Job not found');
      }

      // Verify CV file exists on MinIO before proceeding
      const fileExists = await this.minioService.fileExists(dto.storageKey);
      if (!fileExists) {
        throw new BadRequestException(
          'CV file not found on storage. Please upload the file first using the presigned URL.',
        );
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
        });
        candidate = await queryRunner.manager.save(candidate);
      } else {
        candidate.fullName = dto.fullName;
        candidate.phoneNumber = dto.phoneNumber;
        candidate.profileUrl = dto.profileUrl || candidate.profileUrl;
        candidate = await queryRunner.manager.save(candidate);
      }

      const application = queryRunner.manager.create(Application, {
        job: { id: job.id },
        candidate: { id: candidate.id },
        status: ApplicationStatus.PARSING,
        coverLetter: dto.coverLetter,
        jobSnapshotJson: {
          jobTitleName: job.jobTitleName,
          level: job.level,
          location: job.location,
        },
      });

      const savedApplication = await queryRunner.manager.save(application);

      await queryRunner.commitTransaction();

      await this.producerService.produce(KAFKA_TOPICS.CV_PARSING_REQUEST, {
        key: savedApplication.id,
        value: JSON.stringify({
          applicationId: savedApplication.id,
          candidateId: candidate.id,
          jobId: job.id,
          storageKey: dto.storageKey,
        }),
      });
      return savedApplication;
    } catch (error: any) {
      await queryRunner.rollbackTransaction();
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException('Submission failed: ' + error.message);
    } finally {
      await queryRunner.release();
    }
  }

  async getApplicationsByJob(jobId: string, query: GetApplicationsByJobDto) {
    const { page = 1, pageSize = 10, status, minScore } = query;

    const job = await this.dataSource.manager.findOne(Job, {
      where: { id: jobId },
    });
    if (!job) throw new NotFoundException(`Job not found: ${jobId}`);

    const qb = this.dataSource
      .getRepository(Application)
      .createQueryBuilder('app')
      .leftJoinAndSelect('app.candidate', 'candidate')
      .leftJoinAndSelect('app.candidateCv', 'candidateCv')
      .where('app.jobId = :jobId', { jobId })
      .orderBy('app.matchScore', 'DESC', 'NULLS LAST')
      .addOrderBy('app.createDate', 'DESC');

    // Default: only return MATCHED applications (pipeline completed)
    if (status) {
      qb.andWhere('app.status = :status', { status });
    } else {
      qb.andWhere('app.status = :status', {
        status: ApplicationStatus.MATCHED,
      });
    }

    if (minScore !== undefined) {
      qb.andWhere('app.matchScore >= :minScore', { minScore });
    }

    const result = await paginateAndFormat(qb, {
      page: Number(page),
      pageSize: Number(pageSize),
      useQueryBuilder: true,
      queryBuilder: qb,
    });

    result.data = result.data.map((app) => {
      if (app.candidate && app.candidateCv) {
        app.candidate.storageKey = app.candidateCv.storageKey;
      }
      return app;
    });

    return result;
  }

  async hireCandidate(applicationId: string) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const application = await queryRunner.manager.findOne(Application, {
        where: { id: applicationId },
        relations: ['candidate', 'job'],
      });

      if (!application) {
        throw new NotFoundException('Application not found');
      }

      if (application.status === ApplicationStatus.HIRED) {
        throw new BadRequestException('Candidate is already hired for this application');
      }

      application.status = ApplicationStatus.HIRED;
      await queryRunner.manager.save(application);

      await queryRunner.commitTransaction();

      const candidate = application.candidate;
      const job = application.job;

      const nameParts = candidate.fullName.trim().split(/\s+/);
      const firstName = nameParts[0] || '';
      const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : firstName;

      await this.producerService.produce(KAFKA_TOPICS.CANDIDATE_HIRED, {
        key: application.id,
        value: JSON.stringify({
          applicationId: application.id,
          candidateId: candidate.id,
          firstName,
          lastName,
          email: candidate.email,
          phoneNumber: candidate.phoneNumber,
          jobTitleId: job.jobTitleId,
          subUnitId: job.subUnitId,
        }),
      });

      return application;
    } catch (error: any) {
      await queryRunner.rollbackTransaction();
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException('Hire failed: ' + error.message);
    } finally {
      await queryRunner.release();
    }
  }

  async getApplicationStatsByStatus() {
    return await this.dataSource
      .getRepository(Application)
      .createQueryBuilder('app')
      .select('app.status', 'status')
      .addSelect('COUNT(app.id)', 'count')
      .groupBy('app.status')
      .getRawMany();
  }
}
