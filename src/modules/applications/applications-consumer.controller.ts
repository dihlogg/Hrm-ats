import { Controller, Logger } from '@nestjs/common';
import {
  Ctx,
  KafkaContext,
  MessagePattern,
  Payload,
} from '@nestjs/microservices';
import { DataSource } from 'typeorm';
import { KAFKA_TOPICS } from '../../kafka/config/kafka-topics.constant';
import { retry } from '../../utils/retry';
import { DlqService } from '../../kafka/dlq/dlq-handler.service';
import { MinioService } from '../../infrastructure/minio/minio.service';
import { LlmProviderService } from '../../infrastructure/llm/llm-provider.service';
import { ProducerService } from '../../kafka/producers/producer.service';
import { Application, ApplicationStatus } from './entities/application.entity';
import { Candidate } from '../candidates/entities/candidate.entity';
import { ILike } from 'typeorm';
import { Skill } from '../skills/entities/skill.entity';
import { EntitySkill } from '../entity-skills/entities/entity-skill.entity';
const pdfParse: (
  buffer: Buffer,
) => Promise<{ text: string }> = require('pdf-parse');

@Controller()
export class ApplicationsConsumerController {
  private readonly logger = new Logger(ApplicationsConsumerController.name);

  constructor(
    private readonly dlqService: DlqService,
    private readonly minioService: MinioService,
    private readonly llmProviderService: LlmProviderService,
    private readonly producerService: ProducerService,
    private readonly dataSource: DataSource,
  ) { }

  // Clean (Token Optimization) function
  private cleanExtractedText(rawText: string): string {
    return (
      rawText
        // Remove characters that are not letters, numbers, punctuation, or whitespace
        .replace(/https?:\/\/[^\s]+/g, '')
        .replace(/[^\w\s\p{L}\p{N}\p{P}]/gu, ' ')
        .replace(/\s+/g, ' ')
        .trim()
    );
  }

  @MessagePattern(KAFKA_TOPICS.CV_PARSING_REQUEST)
  async onCvParsingRequest(@Payload() data: any, @Ctx() context: KafkaContext) {
    const message = context.getMessage();
    const topic = context.getTopic();

    try {
      this.logger.log(`Received CV_PARSING_REQUEST: ${JSON.stringify(data)}`);

      await retry(
        async () => {
          // Idempotency guard: skip if already successfully parsed
          const existingApp = await this.dataSource.manager.findOne(
            Application,
            { where: { id: data.applicationId }, select: ['id', 'status'] },
          );
          if (
          existingApp?.status === ApplicationStatus.PARSED_SUCCESS ||
            existingApp?.status === ApplicationStatus.MATCHED
          ) {
            this.logger.warn(
              `Application ${data.applicationId} already processed (status: ${existingApp.status}). Skipping duplicate CV_PARSING_REQUEST.`,
            );
            return;
          }

          // read minio file
          this.logger.log(`Fetching PDF from MinIO: ${data.storageKey}`);
          const pdfBuffer = await this.minioService.getFileBuffer(
            data.storageKey,
          );

          // text extraction
          const pdfData = await pdfParse(pdfBuffer);
          let rawText = pdfData.text;

          // clean text optimization
          rawText = this.cleanExtractedText(rawText);

          // Integrate with LLM for parsing
          const parsedData =
            await this.llmProviderService.parseCvToJson(rawText);

          // update db
          await this.processAndSaveData(
            data.applicationId,
            data.candidateId,
            rawText,
            parsedData,
          );

          this.logger.log(
            `Successfully processed CV for Application ID: ${data.applicationId}`,
          );
        },
        { retries: 3, initialDelay: 1000 },
      );

      // Trigger Phase 4: Hybrid Matching
      // Placed outside retry so a Kafka publish failure does not re-trigger
      // the expensive MinIO → PDF → LLM pipeline.
      await this.producerService.produce(KAFKA_TOPICS.CV_MATCHING_REQUEST, {
        key: data.applicationId,
        value: JSON.stringify({
          applicationId: data.applicationId,
          candidateId: data.candidateId,
          jobId: data.jobId,
        }),
      });
      this.logger.log(
        `Published CV_MATCHING_REQUEST for Application ID: ${data.applicationId}`,
      );
    } catch (error: any) {
      this.logger.error('Failed to process CV. Sending to DLQ.', error);

      // Mark application as PARSING_FAILED so HR can identify broken submissions
      if (data?.applicationId) {
        await this.dataSource.manager
          .update(Application, data.applicationId, {
            status: ApplicationStatus.PARSING_FAILED,
          })
          .catch((updateErr) =>
            this.logger.error(
              `Could not update Application ${data.applicationId} status to PARSING_FAILED`,
              updateErr,
            ),
          );
      }

      await this.dlqService.sendToDlq([message as any], topic, error);
    }
  }

  private async processAndSaveData(
    applicationId: string,
    candidateId: string,
    rawText: string,
    parsedData: any,
  ) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      await queryRunner.manager.update(Candidate, candidateId, {
        rawCvText: rawText,
        cvEmbedding: null as any,
        summary: parsedData.summary,
        metadata: {
          education: parsedData.education,
          experience: parsedData.experience,
        },
      });
      if (parsedData.skills && Array.isArray(parsedData.skills)) {
        // Delete all previous EntitySkills for this candidate before re-inserting
        // so that re-parsing the same CV always produces a deterministic skill set.
        await queryRunner.manager.delete(EntitySkill, {
          candidate: { id: candidateId },
        });

        for (const skillItem of parsedData.skills) {
          const skill = await queryRunner.manager.findOne(Skill, {
            where: { name: ILike(skillItem.standardizedName) },
          });
          const canonicalName = skill?.name ?? skillItem.standardizedName ?? skillItem.originalName;

          const newEntitySkill = queryRunner.manager.create(EntitySkill, {
            candidate: { id: candidateId },
            skill: skill ? { id: skill.id } : undefined,
            experienceYears: skillItem.experienceYears,
            standardizedName: canonicalName,
          });
          await queryRunner.manager.save(newEntitySkill);
        }
      }
      await queryRunner.manager.update(Application, applicationId, {
        status: ApplicationStatus.PARSED_SUCCESS,
        rawData: JSON.stringify(parsedData),
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
