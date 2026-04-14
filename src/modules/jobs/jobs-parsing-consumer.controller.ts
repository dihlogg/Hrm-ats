import { Controller, Logger } from '@nestjs/common';
import {
  Ctx,
  KafkaContext,
  MessagePattern,
  Payload,
} from '@nestjs/microservices';
import { DataSource, ILike } from 'typeorm';
import { KAFKA_TOPICS } from '../../kafka/config/kafka-topics.constant';
import { retry } from '../../utils/retry';
import { DlqService } from '../../kafka/dlq/dlq-handler.service';
import { LlmProviderService } from '../../infrastructure/llm/llm-provider.service';
import { EmbeddingService } from '../../infrastructure/llm/embedding.service';
import { Job, SkillsExtractionStatus } from './entities/job.entity';
import { Skill } from '../skills/entities/skill.entity';
import { EntitySkill } from '../entity-skills/entities/entity-skill.entity';

@Controller()
export class JobsParsingConsumerController {
  private readonly logger = new Logger(JobsParsingConsumerController.name);

  constructor(
    private readonly dlqService: DlqService,
    private readonly llmProviderService: LlmProviderService,
    private readonly embeddingService: EmbeddingService,
    private readonly dataSource: DataSource,
  ) { }

  @MessagePattern(KAFKA_TOPICS.JD_SKILL_EXTRACTION_REQUEST)
  async onJdSkillExtractionRequest(
    @Payload() data: any,
    @Ctx() context: KafkaContext,
  ) {
    const message = context.getMessage();
    const topic = context.getTopic();

    try {
      this.logger.log(
        `Received JD_SKILL_EXTRACTION_REQUEST: ${JSON.stringify(data)}`,
      );

      await retry(
        async () => {
          // load job fr db
          const job = await this.dataSource.manager.findOne(Job, {
            where: { id: data.jobId },
            relations: ['entitySkills'],
          });

          if (!job) {
            throw new Error(`Job not found: ${data.jobId}`);
          }

          // mark as processing
          await this.dataSource.manager.update(Job, job.id, {
            skillsExtractionStatus: SkillsExtractionStatus.PROCESSING,
          });

          // prepare text for LLM
          const combinedText = [
            job.title,
            job.description,
            job.requirements,
            job.responsibilities,
          ]
            .filter(Boolean)
            .join('\n\n');

          if (!combinedText.trim()) {
            this.logger.warn(
              `Job ${job.id} has no text content. Marking as COMPLETED with no skills.`,
            );
            await this.dataSource.manager.update(Job, job.id, {
              skillsExtractionStatus: SkillsExtractionStatus.COMPLETED,
            });
            return;
          }

          // using LLM to extract skills
          this.logger.log(`Sending JD text to LLM for Job ID: ${job.id}`);
          const parsedResult =
            await this.llmProviderService.parseJdSkills(combinedText);

          // generate JD embedding and cache it (so matching phase can reuse)
          this.logger.log(`Generating JD embedding for Job ID: ${job.id}`);
          const jdEmbedding =
            await this.embeddingService.generateEmbedding(combinedText);

          // save entity skills + embedding
          await this.saveExtractedSkills(job, parsedResult.skills, jdEmbedding);

          this.logger.log(
            `Successfully extracted ${parsedResult.skills.length} skill(s) and cached embedding for Job ID: ${job.id}`,
          );
        },
        { retries: 3, initialDelay: 1000 },
      );
    } catch (error: any) {
      this.logger.error(
        `Failed to extract JD skills for Job ID: ${data.jobId}. Sending to DLQ.`,
        error,
      );

      // update job status
      if (data.jobId) {
        await this.dataSource.manager
          .update(Job, data.jobId, {
            skillsExtractionStatus: SkillsExtractionStatus.FAILED,
          })
          .catch((updateErr) =>
            this.logger.error(
              `Could not update skillsExtractionStatus to FAILED`,
              updateErr,
            ),
          );
      }

      await this.dlqService.sendToDlq([message as any], topic, error);
    }
  }

  private async saveExtractedSkills(
    job: Job,
    skills: any[],
    jdEmbedding: number[],
  ) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const existingNames = new Set(
        (job.entitySkills ?? []).map((es) =>
          (es.standardizedName ?? '').toLowerCase(),
        ),
      );

      for (const skillItem of skills) {
        const normalizedName = skillItem.standardizedName?.trim();
        if (!normalizedName) continue;

        if (existingNames.has(normalizedName.toLowerCase())) continue;

        const skill = await queryRunner.manager.findOne(Skill, {
          where: { name: ILike(normalizedName) },
        });

        const canonicalName = skill?.name ?? normalizedName;

        const entitySkill = queryRunner.manager.create(EntitySkill, {
          job: { id: job.id },
          skill: skill ? { id: skill.id } : undefined,
          experienceYears: skillItem.experienceYears ?? 0,
          standardizedName: canonicalName,
        });

        await queryRunner.manager.save(entitySkill);
        existingNames.add(canonicalName.toLowerCase());
      }

      await queryRunner.manager.update(Job, job.id, {
        parsedJson: { extractedSkills: skills },
        jdEmbedding,
        skillsExtractionStatus: SkillsExtractionStatus.COMPLETED,
      });

      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
}
