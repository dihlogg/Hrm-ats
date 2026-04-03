import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateJobDto } from './dto/create-job.dto';
import { UpdateJobDto } from './dto/update-job.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Job } from './entities/job.entity';
import { Not, Repository } from 'typeorm';

@Injectable()
export class JobsService {
  constructor(@InjectRepository(Job) private repo: Repository<Job>) {}
  async create(createJobDto: CreateJobDto): Promise<Job> {
    const job = this.repo.create(createJobDto);
    return this.repo.save(job);
  }

  async findAll(): Promise<Job[]> {
    return await this.repo.find({
      order: {
        createDate: 'ASC',
      },
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
    return true;
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.repo.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`Job not found`);
    }
    return true;
  }
}
