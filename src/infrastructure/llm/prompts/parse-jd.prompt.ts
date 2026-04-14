/**
 * Prompt for parsing raw Job Description (JD) text into a structured skills list.
 *
 * Uses Named Entity Recognition (NER) and Entity Resolution to extract
 * and normalize required skills from a JD.
 *
 * @param rawText - The raw JD text to be parsed
 */
export const PARSE_JD_PROMPT = (rawText: string): string => `
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
