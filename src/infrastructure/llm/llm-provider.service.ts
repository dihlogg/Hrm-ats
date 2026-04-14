import { Injectable, Logger } from '@nestjs/common';
import { GoogleGenAI, Type } from '@google/genai';

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
    const prompt = `
        Role: You are an expert ATS (Applicant Tracking System) specialist and NLP data extraction engine.
        Task: Analyze the provided CV text and extract information into a highly structured JSON format using Information Extraction (IE) and Named Entity Recognition (NER).
        
        Instructions:
        1. Summary: Write a short, professional summary in Vietnamese (max 3 sentences).
        2. Education: Extract schools, degrees, and GPA.
        3. Work Experience: Extract the candidate's work history including company name, position/job title, duration, and a brief description of responsibilities/achievements.
        4. Skills NER & Taxonomy Mapping:
            - Identify Hard Skills (Programming Languages, Frameworks, Tools) and Soft Skills (Teamwork, Leadership, etc.).
            - "originalName": The exact skill name found in the CV.
            - "standardizedName": Apply Entity Resolution to standardize aliases to a single term (e.g., "NodeJS", "Node JS", "Node.js" -> "Node.js"; "ReactJS" -> "React"; "AWS", "Amazon Web Services" -> "AWS").
        5. Experience Duration: Calculate total experienceYears for each skill based on the candidate's work history timeline (e.g., "06/2020 - Present" is approx 4 years). Return 0 if unclear.

        CV CONTENT:
        ${rawText}
        `;

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
    const prompt = `
        Role: You are an expert ATS (Applicant Tracking System) specialist and NLP data extraction engine.
        Task: Analyze the provided Job Description (JD) text and extract all required skills using Named Entity Recognition (NER) and Entity Resolution.

        Instructions:
        1. Identify all Hard Skills (Programming Languages, Frameworks, Libraries, Tools, Platforms, Databases) and Soft Skills (Leadership, Communication, Teamwork, etc.) mentioned.
        2. "originalName": The exact skill name as it appears in the JD.
        3. "standardizedName": Apply Entity Resolution to normalize aliases to a canonical term (e.g., "NodeJS", "Node JS", "Node.js" -> "Node.js"; "ReactJS" -> "React"; "Amazon Web Services" -> "AWS").
        4. "experienceYears": Extract the required number of years for each skill from context (e.g., "3+ years of experience in Python" -> 3). Return 0 if not specified.
        5. "category": Classify the skill as one of: "Programming Language", "Framework", "Database", "DevOps", "Cloud", "Tool", "Soft Skill", "Other".
        6. Deduplicate: if the same skill appears multiple times, merge into one entry with the highest experienceYears.

        JOB DESCRIPTION CONTENT:
        ${rawText}
        `;

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
    const {
      jobTitle,
      jobLevel,
      jobRequirements,
      candidateSummary,
      matchScore,
      skillMatchPercent,
      experienceMatchStatus,
      matchedSkills,
      missingSkills,
    } = params;

    const matchedList =
      matchedSkills.length > 0 ? matchedSkills.join(', ') : 'None';
    const missingList =
      missingSkills.length > 0 ? missingSkills.slice(0, 5).join(', ') : 'None';

    const prompt = `
      Role: You are a Senior Talent Acquisition Expert.
      Task: Evaluate the candidate's suitability for the job position using Chain-of-Thought reasoning.

      === JOB INFORMATION ===
      Job Title: ${jobTitle} (${jobLevel})
      Job Requirements: ${jobRequirements || 'Not provided'}

      === CANDIDATE PROFILE ===
      Summary: ${candidateSummary || 'Not provided'}

      === MATCHING RESULTS ===
      Overall Score: ${matchScore}/100
      Skill Match: ${skillMatchPercent}%
      Experience Match: ${experienceMatchStatus}
      Matched Skills: ${matchedList}
      Missing Skills (top 5): ${missingList}

      === CHAIN-OF-THOUGHT INSTRUCTIONS ===
      Think step-by-step before reaching a conclusion:
      Step 1 - Strengths: What are the candidate's key strengths and qualifications that align well with this role?
      Step 2 - Gaps: What are the major gaps, missing skills, or areas of concern compared to the job requirements?
      Step 3 - Conclusion: Synthesize your findings into a concise, professional summary consisting of exactly 2-3 sentences. 

      CRITICAL REQUIREMENTS FOR THE FINAL OUTPUT:
      1. The final conclusion MUST be written entirely in Vietnamese.
      2. Only return the synthesized conclusion from Step 3. Do NOT include "Step 1", "Step 2", "Step 3", or any other reasoning steps in the final JSON output.
      `;

    for (let i = 0; i < this.geminiModels.length; i++) {
      const currentModel = this.geminiModels[i];

      try {
        this.logger.log(`Generating match reason using model: ${currentModel}`);

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
