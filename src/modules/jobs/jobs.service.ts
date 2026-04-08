import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateJobDto } from './dto/create-job.dto';
import { UpdateJobDto } from './dto/update-job.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Job } from './entities/job.entity';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { PaginationDto } from '../../utils/pagination/pagination.dto';
import { paginateAndFormat } from '../../utils/pagination/pagination.util';
import { GetJobListDto } from './dto/get-job-list.dto';

@Injectable()
export class JobsService {
  constructor(@InjectRepository(Job) private repo: Repository<Job>) {}
  async create(createJobDto: CreateJobDto): Promise<Job> {
    const job = this.repo.create(createJobDto);
    return this.repo.save(job);
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
    const job = await this.repo.findOne({ where: { id } });
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
