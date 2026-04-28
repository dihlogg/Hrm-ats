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
import { Application, ApplicationStatus } from './entities/application.entity';
import { Job } from '../jobs/entities/job.entity';
import { CandidateCv } from '../candidates/entities/candidate-cv.entity';

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
  ) { }

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
          // Load job with skills (guaranteed COMPLETED since create is synchronous)
          const job = await this.dataSource.manager.findOne(Job, {
            where: { id: data.jobId },
            relations: ['entitySkills', 'entitySkills.skill'],
          });
          if (!job) throw new Error(`Job not found: ${data.jobId}`);

          // Load application with linked CandidateCv and its skills
          const application = await this.dataSource.manager.findOne(
            Application,
            {
              where: { id: data.applicationId },
              relations: [
                'candidateCv',
                'candidateCv.entitySkills',
                'candidateCv.entitySkills.skill',
              ],
            },
          );
          if (!application)
            throw new Error(`Application not found: ${data.applicationId}`);

          // Idempotency guard
          if (application.status !== ApplicationStatus.PARSED_SUCCESS) {
            this.logger.warn(
              `Application ${data.applicationId} is not in PARSED_SUCCESS state (current: ${application.status}). Skipping.`,
            );
            return;
          }

          const candidateCv = application.candidateCv;
          if (!candidateCv) {
            throw new Error(
              `Application ${data.applicationId} has no linked CandidateCv. Cannot match.`,
            );
          }

          const cvText = candidateCv.rawCvText ?? '';
          if (!cvText.trim()) {
            throw new Error(`CandidateCv ${candidateCv.id} has no rawCvText for embedding`);
          }

          // Use cached JD embedding (always present since create is synchronous)
          let jdVector: number[];
          if (job.jdEmbedding && job.jdEmbedding.length > 0) {
            jdVector = job.jdEmbedding;
          } else {
            const jdText = [job.title, job.jobTitleName, job.level, job.description, job.requirements, job.responsibilities]
              .filter(Boolean)
              .join('\n\n');
            if (!jdText.trim()) throw new Error(`Job ${data.jobId} has no text content for embedding`);
            jdVector = await this.embeddingService.generateEmbedding(jdText);
            await this.dataSource.manager.update(Job, job.id, { jdEmbedding: jdVector });
          }

          // Use cached CV embedding
          let cvVector: number[];
          if (candidateCv.cvEmbedding && candidateCv.cvEmbedding.length > 0) {
            cvVector = candidateCv.cvEmbedding;
            this.logger.debug(`Reusing cached CV embedding for CandidateCv ${candidateCv.id}`);
          } else {
            cvVector = await this.embeddingService.generateEmbedding(cvText);
            await this.dataSource.manager.update(CandidateCv, candidateCv.id, { cvEmbedding: cvVector });
          }

          // Semantic similarity score
          const semanticScore = this.embeddingService.cosineSimilarity(jdVector, cvVector);
          this.logger.log(`Semantic score: ${semanticScore.toFixed(4)}`);

          // Skills gap analysis
          const jdSkills = (job.entitySkills ?? []).map((es) => ({
            skillId: es.skill?.id,
            standardizedName: es.skill?.name ?? es.standardizedName ?? '',
            experienceYears: Number(es.experienceYears) || 0,
          }));
          const cvSkills = (candidateCv.entitySkills ?? []).map((es) => ({
            skillId: es.skill?.id,
            standardizedName: es.skill?.name ?? es.standardizedName ?? '',
            experienceYears: Number(es.experienceYears) || 0,
          }));

          const gapResult = this.matchingService.computeSkillGap(jdSkills, cvSkills);
          this.logger.log(`Skill gap — matched: ${gapResult.matched.length}, missing: ${gapResult.missing.length}`);

          const expResult = this.matchingService.computeExperienceMatch(jdSkills, cvSkills);
          this.logger.log(`Experience status: ${expResult.status}`);

          const { matchScore, breakdown } = this.matchingService.computeCompositeScore(
            semanticScore,
            gapResult.skillScore,
            expResult.score,
          );
          this.logger.log(`Composite score: ${matchScore} | breakdown: ${JSON.stringify(breakdown)}`);

          // Generate match reason via LLM
          const matchReason = await this.llmProviderService.generateMatchReason({
            jobTitle: job.jobTitleName ?? job.title ?? '',
            jobLevel: job.level ?? '',
            jobRequirements: job.requirements ?? '',
            candidateSummary: candidateCv.summary ?? '',
            matchScore,
            skillMatchPercent: gapResult.skillMatchPercent,
            experienceMatchStatus: expResult.status,
            experienceRatio: expResult.requiredYears > 0 ? expResult.candidateYears / expResult.requiredYears : 0,
            candidateYears: expResult.candidateYears,
            requiredYears: expResult.requiredYears,
            matchedSkills: gapResult.matched,
            missingSkills: gapResult.missing,
          });

          // Persist match results
          await this.dataSource.manager.update(Application, data.applicationId, {
            status: ApplicationStatus.MATCHED,
            matchScore,
            skillMatchPercent: gapResult.skillMatchPercent,
            experienceMatchStatus: expResult.status,
            matchReason,
          });

          this.logger.log(`Successfully matched Application ${data.applicationId} — score: ${matchScore}`);
        },
        {
          retries: 3,
          initialDelay: 1000,
          onRetry: (error, attempt) =>
            this.logger.warn(`[Retry ${attempt}/3] Application ${data.applicationId} — ${error.message}`),
        },
      );
    } catch (error: any) {
      this.logger.error(
        `Failed to match Application ${data?.applicationId}. Sending to DLQ.`,
        error,
      );

      if (data?.applicationId) {
        await this.dataSource.manager
          .update(Application, data.applicationId, {
            status: ApplicationStatus.MATCHING_FAILED,
          })
          .catch((updateErr) =>
            this.logger.error(
              `Could not update Application ${data.applicationId} status to MATCHING_FAILED`,
              updateErr,
            ),
          );
      }

      await this.dlqService.sendToDlq([message as any], topic, error);
    }
  }
}
