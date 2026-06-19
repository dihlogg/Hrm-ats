import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { CreateJobDto } from './dto/create-job.dto';
import { UpdateJobDto } from './dto/update-job.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Job, SkillsExtractionStatus } from './entities/job.entity';
import { DataSource, ILike, Repository, SelectQueryBuilder } from 'typeorm';
import { PaginationDto } from '../../utils/pagination/pagination.dto';
import { paginateAndFormat } from '../../utils/pagination/pagination.util';
import { GetJobListDto } from './dto/get-job-list.dto';
import { EntitySkill } from '../entity-skills/entities/entity-skill.entity';
import { Skill } from '../skills/entities/skill.entity';
import { LlmProviderService } from '../../infrastructure/llm/llm-provider.service';
import { EmbeddingService } from '../../infrastructure/llm/embedding.service';

@Injectable()
export class JobsService {
  private readonly logger = new Logger(JobsService.name);

  constructor(
    @InjectRepository(Job) private repo: Repository<Job>,
    private dataSource: DataSource,
    private readonly llmProviderService: LlmProviderService,
    private readonly embeddingService: EmbeddingService,
  ) { }

  async create(createJobDto: CreateJobDto): Promise<Job> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const { skills, ...jobData } = createJobDto;

      // Step 1: Save job với status PROCESSING
      const job = queryRunner.manager.create(Job, {
        ...jobData,
        skillsExtractionStatus: SkillsExtractionStatus.PROCESSING,
      });
      const savedJob = await queryRunner.manager.save(job);

      // Step 2: Lưu manual skills nếu được truyền vào
      if (skills && skills.length > 0) {
        for (const skillItem of skills.filter((s) => s.skillId)) {
          const entitySkill = queryRunner.manager.create(EntitySkill, {
            job: { id: savedJob.id },
            skill: { id: skillItem.skillId },
            experienceYears: skillItem.experienceYears,
            standardizedName: skillItem.standardizedName || skillItem.skillName,
          });
          await queryRunner.manager.save(entitySkill);
        }
      }

      // Step 3: Chuẩn bị text cho LLM
      const combinedText = [
        savedJob.title,
        savedJob.description,
        savedJob.requirements,
        savedJob.responsibilities,
      ]
        .filter(Boolean)
        .join('\n\n');

      if (combinedText.trim()) {
        // Step 4: Extract skills từ JD qua LLM
        this.logger.log(`Extracting skills from JD for Job ID: ${savedJob.id}`);
        const parsedResult = await this.llmProviderService.parseJdSkills(combinedText);

        // Step 5: Generate JD embedding
        this.logger.log(`Generating JD embedding for Job ID: ${savedJob.id}`);
        const jdEmbedding = await this.embeddingService.generateEmbedding(combinedText);

        // Step 6: Lưu extracted skills (bỏ qua nếu đã có từ manual)
        const existingNames = new Set(
          (skills ?? []).map((s) => (s.standardizedName ?? s.skillName ?? '').toLowerCase()),
        );

        for (const skillItem of parsedResult.skills ?? []) {
          const normalizedName = skillItem.standardizedName?.trim();
          if (!normalizedName || existingNames.has(normalizedName.toLowerCase())) continue;

          const skill = await queryRunner.manager.findOne(Skill, {
            where: { name: ILike(normalizedName) },
          });

          const entitySkill = queryRunner.manager.create(EntitySkill, {
            job: { id: savedJob.id },
            skill: skill ? { id: skill.id } : undefined,
            experienceYears: skillItem.experienceYears ?? 0,
            standardizedName: skill?.name ?? normalizedName,
          });
          await queryRunner.manager.save(entitySkill);
          existingNames.add(normalizedName.toLowerCase());
        }

        // Step 7: Update job với embedding + status COMPLETED
        await queryRunner.manager.update(Job, savedJob.id, {
          jdEmbedding,
          parsedJson: { extractedSkills: parsedResult.skills },
          skillsExtractionStatus: SkillsExtractionStatus.COMPLETED,
        });

        this.logger.log(
          `Job ${savedJob.id} created and COMPLETED with ${parsedResult.skills?.length ?? 0} skill(s).`,
        );
      } else {
        // Không có text JD → mark COMPLETED ngay, không có skills
        await queryRunner.manager.update(Job, savedJob.id, {
          skillsExtractionStatus: SkillsExtractionStatus.COMPLETED,
        });
        this.logger.warn(`Job ${savedJob.id} has no JD text. Marked COMPLETED with no skills.`);
      }

      await queryRunner.commitTransaction();

      return this.repo.findOne({
        where: { id: savedJob.id },
        relations: ['entitySkills', 'entitySkills.skill'],
      }) as Promise<Job>;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      // Mark FAILED nếu có jobId 
      this.logger.error(`Failed to create job: ${error.message}`);
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
    if (!job) throw new NotFoundException(`Job not found`);
    return job;
  }

  async update(id: string, updateJobDto: UpdateJobDto): Promise<boolean> {
    const job = await this.repo.findOne({ where: { id } });
    if (!job) throw new NotFoundException(`Job not found`);
    await this.repo.update(id, updateJobDto);
    return true;
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.repo.delete(id);
    if (result.affected === 0) throw new NotFoundException(`Job not found`);
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
      query.andWhere('job.title ILIKE :keyword', { keyword: `%${keyword.trim()}%` });
    }
    if (level) {
      const levelArray = level.split(',').map((l) => l.trim()).filter(Boolean);
      if (levelArray.length > 0) {
        query.andWhere('job.level IN (:...levelArray)', { levelArray });
      }
    }
    if (jobTitleName) {
      query.andWhere('job.jobTitleName ILIKE :jobTitleName', { jobTitleName: `%${jobTitleName.trim()}%` });
    }
    if (location) {
      query.andWhere('job.location ILIKE :location', { location: `%${location.trim()}%` });
    }
    if (employmentType) {
      query.andWhere('job.employmentType = :employmentType', { employmentType });
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

    return query.orderBy(sortFieldMap[dto.sortBy], dto.sortOrder);
  }

  async getJobStatsByStatus() {
    return await this.dataSource
      .getRepository(Job)
      .createQueryBuilder('job')
      .select('job.status', 'status')
      .addSelect('COUNT(job.id)', 'count')
      .groupBy('job.status')
      .getRawMany();
  }
}
