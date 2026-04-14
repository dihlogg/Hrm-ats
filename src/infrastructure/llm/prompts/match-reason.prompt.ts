import { MatchReasonParams } from '../llm-provider.service';

/**
 * Prompt for generating a human-readable match reason using Chain-of-Thought (CoT) reasoning.
 *
 * The LLM is guided to reason step-by-step (strengths → gaps → conclusion)
 * before producing a final 2-3 sentence summary written in Vietnamese.
 *
 * @param params - Structured data about the job and candidate match
 */
export const MATCH_REASON_PROMPT = (params: MatchReasonParams): string => {
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

  return `
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
};
