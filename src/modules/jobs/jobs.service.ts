import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateJobDto } from './dto/create-job.dto';
import { UpdateJobDto } from './dto/update-job.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Job } from './entities/job.entity';
import { DataSource, Repository, SelectQueryBuilder } from 'typeorm';
import { PaginationDto } from '../../utils/pagination/pagination.dto';
import { paginateAndFormat } from '../../utils/pagination/pagination.util';
import { GetJobListDto } from './dto/get-job-list.dto';
import { EntitySkill } from '../entity-skills/entities/entity-skill.entity';

@Injectable()
export class JobsService {
  constructor(
    @InjectRepository(Job) private repo: Repository<Job>,
    private dataSource: DataSource,
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

      if (skills && skills.length > 0) {
        for (const skillItem of skills) {
          if (!skillItem.skillId) {
            throw new BadRequestException(
              `Yêu cầu cung cấp skillId cho kỹ năng: ${skillItem.skillName}. Kỹ năng phải được chọn từ danh sách có sẵn.`,
            );
          }
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
