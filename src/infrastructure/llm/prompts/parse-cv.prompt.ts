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
  3. Work Experience: Extract the candidate's work history including company name, position/job title, duration (preserve the original date range string exactly as written, e.g. "06/2020 - Present"), and a brief description.
  4. Skills NER & Taxonomy Mapping:
      - Identify Hard Skills (Programming Languages, Frameworks, Tools) and Soft Skills (Teamwork, Leadership, etc.).
      - "originalName": The exact skill name found in the CV.
      - "standardizedName": Apply Entity Resolution to standardize aliases to a single term (e.g., "NodeJS", "Node JS", "Node.js" -> "Node.js"; "ReactJS" -> "React"; "AWS", "Amazon Web Services" -> "AWS").
      - "usedAtCompanies": An array of company names (from Work Experience) where this skill was actively used. Use the exact company name as extracted in the experience section. Return an empty array [] if the skill cannot be attributed to a specific company.
      - "category": Classify the skill as one of: "Programming Language", "Framework", "Database", "DevOps", "Cloud", "Tool", "Soft Skill", "Other".
  5. Do NOT calculate experienceYears — it will be computed automatically from the work timeline.

  CV CONTENT:
  ${rawText}
`;

