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
import { Job, SkillsExtractionStatus } from '../jobs/entities/job.entity';
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
          // load job with require skill
          const job = await this.dataSource.manager.findOne(Job, {
            where: { id: data.jobId },
            relations: ['entitySkills', 'entitySkills.skill'],
          });
          if (!job) throw new Error(`Job not found: ${data.jobId}`);

          // Guard: JD skills must be fully extracted before matching
          if (
            job.skillsExtractionStatus !== SkillsExtractionStatus.COMPLETED
          ) {
            throw new Error(
              `Job ${data.jobId} skills extraction not completed (status: ${job.skillsExtractionStatus}). Will retry.`,
            );
          }

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

          if (application.status !== ApplicationStatus.PARSED_SUCCESS) {
            this.logger.warn(
              `Application ${data.applicationId} is not in PARSED_SUCCESS state (current: ${application.status}). Skipping.`,
            );
            return;
          }

          // build plain text for embedding (only needed if JD embedding not cached)
          const cvText = candidate.rawCvText ?? '';

          if (!cvText.trim()) {
            throw new Error(
              `Candidate ${data.candidateId} has no rawCvText for embedding`,
            );
          }

          // Use cached JD embedding if available, otherwise generate on-the-fly (fallback for old jobs)
          let jdVector: number[];
          if (job.jdEmbedding && job.jdEmbedding.length > 0) {
            jdVector = job.jdEmbedding;
          } else {
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

            if (!jdText.trim()) {
              throw new Error(
                `Job ${data.jobId} has no text content for embedding`,
              );
            }
            jdVector = await this.embeddingService.generateEmbedding(jdText);

            // Cache the JD embedding for future use
            await this.dataSource.manager.update(Job, job.id, {
              jdEmbedding: jdVector,
            });
          }

          // Use cached CV embedding if available
          let cvVector: number[];
          if (candidate.cvEmbedding && candidate.cvEmbedding.length > 0) {
            cvVector = candidate.cvEmbedding;
            this.logger.debug(
              `Reusing cached CV embedding for Candidate ${data.candidateId}`,
            );
          } else {
            cvVector = await this.embeddingService.generateEmbedding(cvText);

            // Cache the CV embedding
            await this.dataSource.manager.update(Candidate, candidate.id, {
              cvEmbedding: cvVector,
            });
          }

          // semantic similarity score
          const semanticScore = this.embeddingService.cosineSimilarity(
            jdVector,
            cvVector,
          );
          this.logger.log(`Semantic score: ${semanticScore.toFixed(4)}`);

          // skills gap analysis (3-tier: skillId → exact → fuzzy)
          const jdSkills = (job.entitySkills ?? []).map((es) => ({
            skillId: es.skill?.id,
            standardizedName: es.skill?.name ?? es.standardizedName ?? '',
            experienceYears: es.experienceYears ?? 0,
          }));

          const cvSkills = (candidate.entitySkills ?? []).map((es) => ({
            skillId: es.skill?.id,
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

          // composite score
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
          const matchReason = await this.llmProviderService.generateMatchReason(
            {
              jobTitle: job.jobTitleName ?? job.title ?? '',
              jobLevel: job.level ?? '',
              jobRequirements: job.requirements ?? '',
              candidateSummary: candidate.summary ?? '',
              matchScore,
              skillMatchPercent: gapResult.skillMatchPercent,
              experienceMatchStatus: expResult.status,
              experienceRatio: expResult.requiredYears > 0
                ? expResult.candidateYears / expResult.requiredYears
                : 0,
              candidateYears: expResult.candidateYears,
              requiredYears: expResult.requiredYears,
              matchedSkills: gapResult.matched,
              missingSkills: gapResult.missing,
            },
          );

          // persist match results to DB
          this.logger.log(
            `Saving match results for Application ${data.applicationId}`,
          );
          await this.dataSource.manager.update(
            Application,
            data.applicationId,
            {
            status: ApplicationStatus.MATCHED,
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

      // Mark application as MATCHING_FAILED so HR can identify broken matches
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
