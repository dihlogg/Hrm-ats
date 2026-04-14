/**
 * Prompt for parsing raw CV text into structured JSON.
 *
 * Uses Information Extraction (IE) and Named Entity Recognition (NER)
 * to extract summary, education, experience, and skills from a CV.
 *
 * @param rawText - The raw CV text to be parsed
 */
export const PARSE_CV_PROMPT = (rawText: string): string => `
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
