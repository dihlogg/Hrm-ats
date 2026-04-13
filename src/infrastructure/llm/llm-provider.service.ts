import { Injectable, Logger } from '@nestjs/common';
import { GoogleGenAI, Type } from '@google/genai';

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
}
