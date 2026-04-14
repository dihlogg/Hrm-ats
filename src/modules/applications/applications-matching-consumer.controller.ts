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
import { EmbeddingService } from '../../infrastructure/llm/embedding.service';
import { MatchingService } from '../../core-ai/matching/matching.service';
import { LlmProviderService } from '../../infrastructure/llm/llm-provider.service';
import { Application } from './entities/application.entity';
import { Job } from '../jobs/entities/job.entity';
import { Candidate } from '../candidates/entities/candidate.entity';

@Controller()
export class ApplicationsMatchingConsumerController {
  private readonly logger = new Logger(
    ApplicationsMatchingConsumerController.name,
  );

  constructor(
    private readonly dataSource: DataSource,
    private readonly dlqService: DlqService,
    private readonly embeddingService: EmbeddingService,
    private readonly matchingService: MatchingService,
    private readonly llmProviderService: LlmProviderService,
  ) {}

  @MessagePattern(KAFKA_TOPICS.CV_MATCHING_REQUEST)
  async onCvMatchingRequest(
    @Payload() data: any,
    @Ctx() context: KafkaContext,
  ): Promise<void> {
    const message = context.getMessage();
    const topic = context.getTopic();

    try {
      this.logger.log(`Received CV_MATCHING_REQUEST: ${JSON.stringify(data)}`);

      await retry(
        async () => {
          // load job with require skill
          const job = await this.dataSource.manager.findOne(Job, {
            where: { id: data.jobId },
            relations: ['entitySkills', 'entitySkills.skill'],
          });
          if (!job) throw new Error(`Job not found: ${data.jobId}`);

          // load candidate
          const candidate = await this.dataSource.manager.findOne(Candidate, {
            where: { id: data.candidateId },
            relations: ['entitySkills', 'entitySkills.skill'],
          });
          if (!candidate)
            throw new Error(`Candidate not found: ${data.candidateId}`);

          // only process if application is in PARSED_SUCCESS state (idempotency guard)
          const application = await this.dataSource.manager.findOne(
            Application,
            { where: { id: data.applicationId } },
          );
          if (!application)
            throw new Error(`Application not found: ${data.applicationId}`);

          if (application.status !== 'PARSED_SUCCESS') {
            this.logger.warn(
              `Application ${data.applicationId} is not in PARSED_SUCCESS state (current: ${application.status}). Skipping.`,
            );
            return;
          }

          // build plan text for LLM
          const jdText = [
            job.title,
            job.jobTitleName,
            job.level,
            job.description,
            job.requirements,
            job.responsibilities,
          ]
            .filter(Boolean)
            .join('\n\n');

          const cvText = candidate.rawCvText ?? '';

          if (!jdText.trim()) {
            throw new Error(
              `Job ${data.jobId} has no text content for embedding`,
            );
          }
          if (!cvText.trim()) {
            throw new Error(
              `Candidate ${data.candidateId} has no rawCvText for embedding`,
            );
          }

          // generate embeddings in parallel
          this.logger.log('Generating JD and CV embeddings in parallel');
          const [jdVector, cvVector] = await Promise.all([
            this.embeddingService.generateEmbedding(jdText),
            this.embeddingService.generateEmbedding(cvText),
          ]);

          // semantic similarity score
          const semanticScore = this.embeddingService.cosineSimilarity(
            jdVector,
            cvVector,
          );
          this.logger.log(`Semantic score: ${semanticScore.toFixed(4)}`);

          // skills gap analysis
          // Prefer skill.name (canonical from Skills table) over free-text standardizedName
          const jdSkills = (job.entitySkills ?? []).map((es) => ({
            standardizedName: es.skill?.name ?? es.standardizedName ?? '',
            experienceYears: es.experienceYears ?? 0,
          }));

          const cvSkills = (candidate.entitySkills ?? []).map((es) => ({
            standardizedName: es.skill?.name ?? es.standardizedName ?? '',
            experienceYears: es.experienceYears ?? 0,
          }));

          const gapResult = this.matchingService.computeSkillGap(
            jdSkills,
            cvSkills,
          );
          this.logger.log(
            `Skill gap — matched: ${gapResult.matched.length}, missing: ${gapResult.missing.length}`,
          );

          // experience match analysis
          const expResult = this.matchingService.computeExperienceMatch(
            jdSkills,
            cvSkills,
          );
          this.logger.log(`Experience status: ${expResult.status}`);

          // xomposite score
          const { matchScore, breakdown } =
            this.matchingService.computeCompositeScore(
              semanticScore,
              gapResult.skillScore,
              expResult.score,
            );
          this.logger.log(
            `Composite score: ${matchScore} | breakdown: ${JSON.stringify(breakdown)}`,
          );

          // generate match reason via LLM
          this.logger.log('Generating match reason via LLM');
          const matchReason = await this.llmProviderService.generateMatchReason(
            {
              jobTitle: job.jobTitleName ?? job.title ?? '',
              jobLevel: job.level ?? '',
              jobRequirements: job.requirements ?? '',
              candidateSummary: candidate.summary ?? '',
              matchScore,
              skillMatchPercent: gapResult.skillMatchPercent,
              experienceMatchStatus: expResult.status,
              matchedSkills: gapResult.matched,
              missingSkills: gapResult.missing,
            },
          );

          // oersist match results to DB
          this.logger.log(
            `Saving match results for Application ${data.applicationId}`,
          );
          await this.dataSource.manager.update(
            Application,
            data.applicationId,
            {
              status: 'MATCHED',
              matchScore,
              skillMatchPercent: gapResult.skillMatchPercent,
              experienceMatchStatus: expResult.status,
              matchReason,
            },
          );

          this.logger.log(
            `Successfully matched Application ${data.applicationId} — score: ${matchScore}`,
          );
        },
        { retries: 3, initialDelay: 1000 },
      );
    } catch (error: any) {
      this.logger.error(
        `Failed to match Application ${data?.applicationId}. Sending to DLQ.`,
        error,
      );
      await this.dlqService.sendToDlq([message as any], topic, error);
    }
  }
}
