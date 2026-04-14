import { Injectable, Logger } from '@nestjs/common';

export interface SkillItem {
  skillId?: string;
  standardizedName: string;
  experienceYears: number;
}

export interface SkillGapResult {
  /** JD skills the candidate already has */
  matched: string[];
  /** JD skills the candidate is missing */
  missing: string[];
  /** CV skills the candidate has beyond JD requirements (bonus) */
  extra: string[];
  /** matched.length / jdSkills.length → 0..1 */
  skillScore: number;
  /** skillScore * 100, rounded to 2 decimal places */
  skillMatchPercent: number;
}

export type ExperienceMatchStatus =
  | 'BELOW_REQUIRED'
  | 'MEETS_REQUIRED'
  | 'EXCEEDS_REQUIRED';

export interface ExperienceMatchResult {
  status: ExperienceMatchStatus;
  /** Numeric weight for composite score: 0 | 0.5 | 1 */
  score: number;
  /** Total years JD requires across matched skills */
  requiredYears: number;
  /** Total years candidate has across matched skills */
  candidateYears: number;
}

export interface CompositeScoreBreakdown {
  matchScore: number;
  breakdown: {
    semantic: number;
    skill: number;
    experience: number;
  };
}

@Injectable()
export class MatchingService {
  private readonly logger = new Logger(MatchingService.name);

  private readonly WEIGHT_SEMANTIC = 0.4;
  private readonly WEIGHT_SKILL = 0.4;
  private readonly WEIGHT_EXPERIENCE = 0.2;

  private readonly EXCEED_THRESHOLD = 1.1;
  private readonly MEET_THRESHOLD = 0.8;

  /** Minimum Jaro-Winkler similarity to consider a fuzzy match */
  private readonly FUZZY_THRESHOLD = 0.85;

  /**
   * 3-Tier Skill Gap Analysis:
   *   Tier 1 — Match by skill ID (both sides mapped to Skills table)
   *   Tier 2 — Exact string match (after normalize)
   *   Tier 3 — Fuzzy match via Jaro-Winkler (≥ threshold)
   */
  computeSkillGap(jdSkills: SkillItem[], cvSkills: SkillItem[]): SkillGapResult {
    const matched: string[] = [];
    const missing: string[] = [];

    const cvSkillIds = new Set(
      cvSkills.filter((s) => s.skillId).map((s) => s.skillId!),
    );
    const cvNormalizedNames = new Set(
      cvSkills.map((s) => this.normalize(s.standardizedName)),
    );
    const cvNormalizedList = cvSkills.map((s) =>
      this.normalize(s.standardizedName),
    );

    const consumedCvNames = new Set<string>();

    for (const jdSkill of jdSkills) {
      const jdNorm = this.normalize(jdSkill.standardizedName);

      // Tier 1: Match by skill ID
      if (jdSkill.skillId && cvSkillIds.has(jdSkill.skillId)) {
        matched.push(jdSkill.standardizedName);
        consumedCvNames.add(jdNorm);
        continue;
      }

      // Tier 2: Exact string match (after normalize)
      if (cvNormalizedNames.has(jdNorm)) {
        matched.push(jdSkill.standardizedName);
        consumedCvNames.add(jdNorm);
        continue;
      }

      // Tier 3: Fuzzy match via Jaro-Winkler
      let fuzzyMatched = false;
      for (const cvNorm of cvNormalizedList) {
        if (consumedCvNames.has(cvNorm)) continue;

        const similarity = this.jaroWinklerSimilarity(jdNorm, cvNorm);
        if (similarity >= this.FUZZY_THRESHOLD) {
          matched.push(jdSkill.standardizedName);
          consumedCvNames.add(cvNorm);
          fuzzyMatched = true;
          this.logger.debug(
            `Fuzzy matched: "${jdSkill.standardizedName}" with "${cvNorm}" (similarity: ${similarity.toFixed(3)})`,
          );
          break;
        }
      }

      if (!fuzzyMatched) {
        missing.push(jdSkill.standardizedName);
      }
    }

    const jdNormalizedNames = new Set(
      jdSkills.map((s) => this.normalize(s.standardizedName)),
    );
    const extra = cvSkills
      .filter((s) => {
        const cvNorm = this.normalize(s.standardizedName);
        return !consumedCvNames.has(cvNorm) && !jdNormalizedNames.has(cvNorm);
      })
      .map((s) => s.standardizedName);

    const skillScore =
      jdSkills.length === 0 ? 0 : matched.length / jdSkills.length;

    return {
      matched,
      missing,
      extra,
      skillScore,
      skillMatchPercent: this.round(skillScore * 100),
    };
  }

  computeExperienceMatch(
    jdSkills: SkillItem[],
    cvSkills: SkillItem[],
  ): ExperienceMatchResult {
    const cvMapById = new Map<string, number>();
    const cvMapByName = new Map<string, number>();
    const cvNormalizedList: { name: string; years: number }[] = [];

    for (const s of cvSkills) {
      if (s.skillId) {
        cvMapById.set(s.skillId, s.experienceYears);
      }
      const norm = this.normalize(s.standardizedName);
      cvMapByName.set(norm, s.experienceYears);
      cvNormalizedList.push({ name: norm, years: s.experienceYears });
    }

    let requiredYears = 0;
    let candidateYears = 0;

    for (const jdSkill of jdSkills) {
      const jdNorm = this.normalize(jdSkill.standardizedName);

      // Tier 1: Match by skill ID
      if (jdSkill.skillId && cvMapById.has(jdSkill.skillId)) {
        requiredYears += jdSkill.experienceYears ?? 0;
        candidateYears += cvMapById.get(jdSkill.skillId) ?? 0;
        continue;
      }

      // Tier 2: Exact string match
      if (cvMapByName.has(jdNorm)) {
        requiredYears += jdSkill.experienceYears ?? 0;
        candidateYears += cvMapByName.get(jdNorm) ?? 0;
        continue;
      }

      // Tier 3: Fuzzy match
      for (const cv of cvNormalizedList) {
        if (this.jaroWinklerSimilarity(jdNorm, cv.name) >= this.FUZZY_THRESHOLD) {
          requiredYears += jdSkill.experienceYears ?? 0;
          candidateYears += cv.years;
          break;
        }
      }
    }

    if (requiredYears === 0) {
      return {
        status: 'MEETS_REQUIRED',
        score: 0.5,
        requiredYears: 0,
        candidateYears,
      };
    }

    let status: ExperienceMatchStatus;
    let score: number;

    if (candidateYears >= requiredYears * this.EXCEED_THRESHOLD) {
      status = 'EXCEEDS_REQUIRED';
      score = 1;
    } else if (candidateYears >= requiredYears * this.MEET_THRESHOLD) {
      status = 'MEETS_REQUIRED';
      score = 0.5;
    } else {
      status = 'BELOW_REQUIRED';
      score = 0;
    }

    return { status, score, requiredYears, candidateYears };
  }

  /**
   * Combines semantic (embedding cosine), skill gap, and experience scores
   * into a single composite match score in the range 0..100.
   *
   * Weights: semantic 40% | skill 40% | experience 20%
   */
  computeCompositeScore(
    semanticScore: number,
    skillScore: number,
    experienceScore: number,
  ): CompositeScoreBreakdown {
    const composite =
      semanticScore * this.WEIGHT_SEMANTIC +
      skillScore * this.WEIGHT_SKILL +
      experienceScore * this.WEIGHT_EXPERIENCE;

    return {
      matchScore: this.round(composite * 100),
      breakdown: {
        semantic: this.round(semanticScore * this.WEIGHT_SEMANTIC * 100),
        skill: this.round(skillScore * this.WEIGHT_SKILL * 100),
        experience: this.round(experienceScore * this.WEIGHT_EXPERIENCE * 100),
      },
    };
  }


  /**
   * Jaro-Winkler similarity between two strings.
   * Returns a value between 0 (completely different) and 1 (identical).
   *
   * The algorithm works in two stages:
   *  1. Jaro similarity — considers matching characters and transpositions
   *  2. Winkler boost — rewards strings that share a common prefix (up to 4 chars)
   */
  jaroWinklerSimilarity(s1: string, s2: string): number {
    if (s1 === s2) return 1;
    if (s1.length === 0 || s2.length === 0) return 0;

    const jaroScore = this.jaroSimilarity(s1, s2);

    const prefixScale = 0.1;
    let commonPrefix = 0;
    const maxPrefix = Math.min(4, s1.length, s2.length);

    for (let i = 0; i < maxPrefix; i++) {
      if (s1[i] === s2[i]) {
        commonPrefix++;
      } else {
        break;
      }
    }

    return jaroScore + commonPrefix * prefixScale * (1 - jaroScore);
  }

  private jaroSimilarity(s1: string, s2: string): number {
    const maxDist = Math.floor(Math.max(s1.length, s2.length) / 2) - 1;

    const s1Matches = new Array(s1.length).fill(false);
    const s2Matches = new Array(s2.length).fill(false);

    let matches = 0;
    let transpositions = 0;

    // Find matching characters
    for (let i = 0; i < s1.length; i++) {
      const start = Math.max(0, i - maxDist);
      const end = Math.min(i + maxDist + 1, s2.length);

      for (let j = start; j < end; j++) {
        if (s2Matches[j] || s1[i] !== s2[j]) continue;
        s1Matches[i] = true;
        s2Matches[j] = true;
        matches++;
        break;
      }
    }

    if (matches === 0) return 0;

    // Count transpositions
    let k = 0;
    for (let i = 0; i < s1.length; i++) {
      if (!s1Matches[i]) continue;
      while (!s2Matches[k]) k++;
      if (s1[i] !== s2[k]) transpositions++;
      k++;
    }

    return (
      (matches / s1.length +
        matches / s2.length +
        (matches - transpositions / 2) / matches) /
      3
    );
  }

  private normalize(name: string): string {
    return (name ?? '').toLowerCase().trim();
  }

  private round(value: number, decimals = 2): number {
    const factor = Math.pow(10, decimals);
    return Math.round(value * factor) / factor;
  }
}
