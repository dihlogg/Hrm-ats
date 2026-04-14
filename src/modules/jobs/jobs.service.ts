import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { CreateJobDto } from './dto/create-job.dto';
import { UpdateJobDto } from './dto/update-job.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Job } from './entities/job.entity';
import { DataSource, Repository, SelectQueryBuilder } from 'typeorm';
import { PaginationDto } from '../../utils/pagination/pagination.dto';
import { paginateAndFormat } from '../../utils/pagination/pagination.util';
import { GetJobListDto } from './dto/get-job-list.dto';
import { EntitySkill } from '../entity-skills/entities/entity-skill.entity';
import { ProducerService } from '../../kafka/producers/producer.service';
import { KAFKA_TOPICS } from '../../kafka/config/kafka-topics.constant';

@Injectable()
export class JobsService {
  private readonly logger = new Logger(JobsService.name);

  constructor(
    @InjectRepository(Job) private repo: Repository<Job>,
    private dataSource: DataSource,
    private readonly producerService: ProducerService,
  ) {}
  // async create(createJobDto: CreateJobDto): Promise<Job> {
  //   const job = this.repo.create(createJobDto);
  //   return this.repo.save(job);
  // }
  async create(createJobDto: CreateJobDto): Promise<Job> {
    const queryRunner = this.dataSource.createQueryRunner();

    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const { skills, ...jobData } = createJobDto;

      const job = queryRunner.manager.create(Job, jobData);
      const savedJob = await queryRunner.manager.save(job);

      // Nếu skills được truyền tay (với skillId) thì dùng trực tiếp,
      // ngược lại hệ thống sẽ tự extract từ JD qua Kafka pipeline.
      if (skills && skills.length > 0) {
        const manualSkills = skills.filter((s) => s.skillId);
        for (const skillItem of manualSkills) {
          const entitySkill = queryRunner.manager.create(EntitySkill, {
            job: { id: savedJob.id },
            skill: { id: skillItem.skillId },
            experienceYears: skillItem.experienceYears,
            standardizedName: skillItem.standardizedName || skillItem.skillName,
          });
          await queryRunner.manager.save(entitySkill);
        }
      }

      await queryRunner.commitTransaction();

      // Trigger async JD skill extraction qua Kafka
      await this.producerService.produce(
        KAFKA_TOPICS.JD_SKILL_EXTRACTION_REQUEST,
        {
          key: savedJob.id,
          value: JSON.stringify({ jobId: savedJob.id }),
        },
      );
      this.logger.log(
        `Published JD_SKILL_EXTRACTION_REQUEST for Job ID: ${savedJob.id}`,
      );

      return savedJob;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
  async findAll(paginationDto: PaginationDto) {
    const page = Number(paginationDto.page) || 1;
    const pageSize = Number(paginationDto.pageSize) || 10;

    return paginateAndFormat(this.repo, {
      page,
      pageSize,
      findOptions: { order: { createDate: 'ASC' } },
    });
  }

  async findByLevel(level: string, paginationDto: PaginationDto) {
    const page = Number(paginationDto.page) || 1;
    const pageSize = Number(paginationDto.pageSize) || 10;

    return paginateAndFormat(this.repo, {
      page,
      pageSize,
      findOptions: { where: { level }, order: { createDate: 'ASC' } },
    });
  }

  async findOne(id: string): Promise<Job> {
    const job = await this.repo.findOne({
      where: { id },
      relations: ['entitySkills', 'entitySkills.skill'],
    });
    if (!job) {
      throw new NotFoundException(`Job not found`);
    }
    return job;
  }

  async update(id: string, updateJobDto: UpdateJobDto): Promise<boolean> {
    const updateJob = await this.repo.findOne({ where: { id } });
    if (!updateJob) {
      throw new NotFoundException(`Job not found`);
    }
    await this.repo.update(id, updateJobDto);
    return true;
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.repo.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`Job not found`);
    }
    return true;
  }

  async getJobList(dto: GetJobListDto) {
    const { page = 1, pageSize = 10 } = dto;

    let query = this.repo.createQueryBuilder('job');

    query = this.applyFilters(query, dto);
    query = this.applySorting(query, dto);

    return paginateAndFormat(query, {
      page: Number(page),
      pageSize: Number(pageSize),
      useQueryBuilder: true,
      queryBuilder: query,
    });
  }

  private applyFilters(query: SelectQueryBuilder<Job>, dto: GetJobListDto) {
    const { keyword, level, jobTitleName, location, employmentType } = dto;

    if (keyword) {
      query.andWhere('job.title ILIKE :keyword', {
        keyword: `%${keyword.trim()}%`,
      });
    }

    if (level) {
      const levelArray = level
        .split(',')
        .map((l) => l.trim())
        .filter(Boolean);

      if (levelArray.length > 0) {
        query.andWhere('job.level IN (:...levelArray)', { levelArray });
      }
    }

    if (jobTitleName) {
      query.andWhere('job.jobTitleName ILIKE :jobTitleName', {
        jobTitleName: `%${jobTitleName.trim()}%`,
      });
    }

    if (location) {
      query.andWhere('job.location ILIKE :location', {
        location: `%${location.trim()}%`,
      });
    }

    if (employmentType) {
      query.andWhere('job.employmentType = :employmentType', {
        employmentType,
      });
    }

    return query;
  }

  private applySorting(query: SelectQueryBuilder<Job>, dto: GetJobListDto) {
    const sortFieldMap: Record<string, string> = {
      title: 'job.title',
      jobTitleName: 'job.jobTitleName',
      level: 'job.level',
      location: 'job.location',
      createDate: 'job.createDate',
    };

    if (!dto.sortBy || !dto.sortOrder) {
      return query.orderBy('job.createDate', 'DESC');
    }

    const sortField = sortFieldMap[dto.sortBy];
    const sortOrder = dto.sortOrder;

    return query.orderBy(sortField, sortOrder);
  }
}
