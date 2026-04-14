import { Injectable, Logger } from '@nestjs/common';
import { GoogleGenAI, Type } from '@google/genai';
import { PARSE_CV_PROMPT } from './prompts/parse-cv.prompt';
import { PARSE_JD_PROMPT } from './prompts/parse-jd.prompt';
import { MATCH_REASON_PROMPT } from './prompts/match-reason.prompt';

export interface JdSkillItem {
  originalName: string;
  standardizedName: string;
  experienceYears: number;
  category: string;
}

export interface ParseJdSkillsResult {
  skills: JdSkillItem[];
}

export interface MatchReasonParams {
  jobTitle: string;
  jobLevel: string;
  jobRequirements: string;
  candidateSummary: string;
  matchScore: number;
  skillMatchPercent: number;
  experienceMatchStatus: string;
  matchedSkills: string[];
  missingSkills: string[];
}

@Injectable()
export class LlmProviderService {
  private readonly logger = new Logger(LlmProviderService.name);
  private ai: GoogleGenAI;
  private readonly geminiModels: string[];

  constructor() {
    this.ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    const modelsEnv = process.env.GEMINI_MODELS?.trim();
    this.geminiModels = modelsEnv
      ? modelsEnv.split(',').map((m) => m.trim())
      : ['gemini-2.5-flash'];
  }

  async parseCvToJson(rawText: string): Promise<any> {
    const prompt = PARSE_CV_PROMPT(rawText);

    for (let i = 0; i < this.geminiModels.length; i++) {
      const currentModel = this.geminiModels[i];

      try {
        this.logger.log(`Attempting to parse CV using model: ${currentModel}`);

        const response = await this.ai.models.generateContent({
          model: currentModel,
          contents: prompt,
          config: {
            temperature: 0,
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                summary: { type: Type.STRING },
                education: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      school: { type: Type.STRING },
                      degree: { type: Type.STRING },
                      gpa: { type: Type.STRING },
                    },
                  },
                },
                experience: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      company: { type: Type.STRING },
                      position: { type: Type.STRING },
                      duration: { type: Type.STRING },
                      description: { type: Type.STRING },
                    },
                  },
                },
                skills: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      originalName: { type: Type.STRING },
                      standardizedName: { type: Type.STRING },
                      experienceYears: { type: Type.INTEGER },
                      category: { type: Type.STRING },
                    },
                    required: [
                      'originalName',
                      'standardizedName',
                      'experienceYears',
                      'category',
                    ],
                  },
                },
              },
              required: ['summary', 'education', 'experience', 'skills'],
            },
          },
        });

        const responseText = response.text;
        if (!responseText) throw new Error('EMPTY_LLM_RESPONSE');

        return JSON.parse(responseText);
      } catch (error: any) {
        this.logger.error(`Error with model ${currentModel}: ${error.message}`);

        if (i < this.geminiModels.length - 1) {
          this.logger.warn(
            `Model ${currentModel} failed. Falling back to the next model...`,
          );
          continue;
        }

        this.logger.error('All available models failed or exhausted quotas.');
        throw new Error('LLM_PARSING_FAILED');
      }
    }
  }
  async parseJdSkills(rawText: string): Promise<ParseJdSkillsResult> {
    const prompt = PARSE_JD_PROMPT(rawText);

    for (let i = 0; i < this.geminiModels.length; i++) {
      const currentModel = this.geminiModels[i];

      try {
        this.logger.log(
          `Attempting to parse JD skills using model: ${currentModel}`,
        );

        const response = await this.ai.models.generateContent({
          model: currentModel,
          contents: prompt,
          config: {
            temperature: 0,
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                skills: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      originalName: { type: Type.STRING },
                      standardizedName: { type: Type.STRING },
                      experienceYears: { type: Type.INTEGER },
                      category: { type: Type.STRING },
                    },
                    required: [
                      'originalName',
                      'standardizedName',
                      'experienceYears',
                      'category',
                    ],
                  },
                },
              },
              required: ['skills'],
            },
          },
        });

        const responseText = response.text;
        if (!responseText) throw new Error('EMPTY_LLM_RESPONSE');

        return JSON.parse(responseText) as ParseJdSkillsResult;
      } catch (error: any) {
        this.logger.error(
          `Error parsing JD skills with model ${currentModel}: ${error.message}`,
        );

        if (i < this.geminiModels.length - 1) {
          this.logger.warn(
            `Model ${currentModel} failed. Falling back to the next model...`,
          );
          continue;
        }

        this.logger.error('All available models failed or exhausted quotas.');
        throw new Error('LLM_JD_PARSING_FAILED');
      }
    }

    throw new Error('LLM_JD_PARSING_FAILED');
  }

  /**
   * Generates a human-readable match reason using Chain-of-Thought prompting.
   *
   * The LLM is asked to reason step-by-step (strengths → gaps → conclusion)
   * before producing a final 2-3 sentence summary in Vietnamese.
   * We use Structured Output (plain string) so the model returns only the
   * final summary without any markdown or extra fields.
   */
  async generateMatchReason(params: MatchReasonParams): Promise<string> {
    const prompt = MATCH_REASON_PROMPT(params);

    for (let i = 0; i < this.geminiModels.length; i++) {
      const currentModel = this.geminiModels[i];

      try {
        const response = await this.ai.models.generateContent({
          model: currentModel,
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                reason: {
                  type: Type.STRING,
                  description:
                    'The final 2-3 sentence professional summary in Vietnamese.',
                },
              },
              required: ['reason'],
            },
          },
        });

        const responseText = response.text;
        if (!responseText) throw new Error('EMPTY_LLM_RESPONSE');

        const parsed = JSON.parse(responseText);
        if (!parsed.reason) throw new Error('MATCH_REASON_FIELD_MISSING');

        return parsed.reason as string;
      } catch (error: any) {
        this.logger.error(
          `Error generating match reason with model ${currentModel}: ${error.message}`,
        );

        if (i < this.geminiModels.length - 1) {
          this.logger.warn(
            `Model ${currentModel} failed. Falling back to the next model...`,
          );
          continue;
        }

        this.logger.error('All available models failed or exhausted quotas.');
        throw new Error('LLM_MATCH_REASON_FAILED');
      }
    }

    throw new Error('LLM_MATCH_REASON_FAILED');
  }
}
