import { Controller, Logger } from '@nestjs/common';
import {
  Ctx,
  KafkaContext,
  MessagePattern,
  Payload,
} from '@nestjs/microservices';
import { DataSource } from 'typeorm';
import * as crypto from 'crypto';
import { KAFKA_TOPICS } from '../../kafka/config/kafka-topics.constant';
import { retry } from '../../utils/retry';
import { DlqService } from '../../kafka/dlq/dlq-handler.service';
import { MinioService } from '../../infrastructure/minio/minio.service';
import { LlmProviderService } from '../../infrastructure/llm/llm-provider.service';
import { ProducerService } from '../../kafka/producers/producer.service';
import { Application, ApplicationStatus } from './entities/application.entity';
import { CandidateCv, CvParsingStatus } from '../candidates/entities/candidate-cv.entity';
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

      // Flag: chỉ publish CV_MATCHING_REQUEST nếu CV vừa được xử lý lần đầu
      let shouldPublishMatching = false;

      await retry(
        async () => {
          // Idempotency guard: skip nếu đã xử lý thành công (Kafka redelivery)
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

          // Step 1: Download PDF from MinIO
          this.logger.log(`Fetching PDF from MinIO: ${data.storageKey}`);
          const pdfBuffer = await this.minioService.getFileBuffer(
            data.storageKey,
          );

          // Step 2: Compute content hash (SHA-256) for deduplication
          const contentHash = crypto
            .createHash('sha256')
            .update(pdfBuffer)
            .digest('hex');

          this.logger.log(
            `Content hash for storageKey ${data.storageKey}: ${contentHash.substring(0, 16)}...`,
          );

          // Step 3: Check if this exact CV was already parsed for this candidate
          const existingCv = await this.dataSource.manager.findOne(CandidateCv, {
            where: {
              candidate: { id: data.candidateId },
              contentHash,
              parsingStatus: CvParsingStatus.SUCCESS,
            },
          });

          if (existingCv) {
            this.logger.log(
              `Reusing existing CandidateCv ${existingCv.id} (same content hash) for Application ${data.applicationId}`,
            );

            await this.dataSource.manager.update(
              Application,
              data.applicationId,
              {
                candidateCv: { id: existingCv.id },
                status: ApplicationStatus.PARSED_SUCCESS,
                rawData: JSON.stringify(existingCv.parsedJson),
              },
            );
          } else {
            this.logger.log(
              `New CV detected for Candidate ${data.candidateId}. Running full parsing pipeline.`,
            );

            // text extraction
            const pdfData = await pdfParse(pdfBuffer);
            let rawText = pdfData.text;

            // clean text optimization
            rawText = this.cleanExtractedText(rawText);

            // Integrate with LLM for parsing
            const parsedData =
              await this.llmProviderService.parseCvToJson(rawText);

            // Create CandidateCv + EntitySkills and link to Application
            await this.createCandidateCvAndLink(
              data.applicationId,
              data.candidateId,
              data.storageKey,
              contentHash,
              rawText,
              parsedData,
            );
          }

          this.logger.log(
            `Successfully processed CV for Application ID: ${data.applicationId}`,
          );
          // Chỉ publish matching khi xử lý thành công lần đầu
          shouldPublishMatching = true;
        },
        { retries: 3, initialDelay: 1000 },
      );

      if (shouldPublishMatching) {
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
      }
    } catch (error: any) {
      this.logger.error('Failed to process CV. Sending to DLQ.', error);

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

  /**
   * Creates a new CandidateCv record with parsed skills, links it to the Application,
   * and updates Application status to PARSED_SUCCESS — all within a single transaction.
   */
  private async createCandidateCvAndLink(
    applicationId: string,
    candidateId: string,
    storageKey: string,
    contentHash: string,
    rawText: string,
    parsedData: any,
  ) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Create CandidateCv
      const candidateCv = queryRunner.manager.create(CandidateCv, {
        candidate: { id: candidateId },
        storageKey,
        contentHash,
        rawCvText: rawText,
        cvEmbedding: null as any,
        summary: parsedData.summary,
        metadata: {
          education: parsedData.education,
          experience: parsedData.experience,
        },
        parsedJson: parsedData,
        parsingStatus: CvParsingStatus.SUCCESS,
      });
      const savedCv = await queryRunner.manager.save(candidateCv);

      // Save EntitySkills linked to CandidateCv (not Candidate)
      if (parsedData.skills && Array.isArray(parsedData.skills)) {
        for (const skillItem of parsedData.skills) {
          const skill = await queryRunner.manager.findOne(Skill, {
            where: { name: ILike(skillItem.standardizedName) },
          });
          const canonicalName =
            skill?.name ?? skillItem.standardizedName ?? skillItem.originalName;

          const newEntitySkill = queryRunner.manager.create(EntitySkill, {
            candidateCv: { id: savedCv.id },
            skill: skill ? { id: skill.id } : undefined,
            experienceYears: Number(skillItem.experienceYears) || 0,
            standardizedName: canonicalName,
          });
          await queryRunner.manager.save(newEntitySkill);
        }
      }

      // Link Application → CandidateCv and update status
      await queryRunner.manager.update(Application, applicationId, {
        candidateCv: { id: savedCv.id },
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
