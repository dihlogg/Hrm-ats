import { Injectable } from '@nestjs/common';

export interface SkillItem {
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
  private readonly WEIGHT_SEMANTIC = 0.4;
  private readonly WEIGHT_SKILL = 0.4;
  private readonly WEIGHT_EXPERIENCE = 0.2;

  private readonly EXCEED_THRESHOLD = 1.1;
  private readonly MEET_THRESHOLD = 0.8;

  computeSkillGap(jdSkills: SkillItem[], cvSkills: SkillItem[]): SkillGapResult {
    const cvSkillNames = new Set(
      cvSkills.map((s) => this.normalize(s.standardizedName)),
    );
    const jdSkillNames = new Set(
      jdSkills.map((s) => this.normalize(s.standardizedName)),
    );

    const matched: string[] = [];
    const missing: string[] = [];

    for (const jdSkill of jdSkills) {
      const key = this.normalize(jdSkill.standardizedName);
      if (cvSkillNames.has(key)) {
        matched.push(jdSkill.standardizedName);
      } else {
        missing.push(jdSkill.standardizedName);
      }
    }

    const extra = cvSkills
      .filter((s) => !jdSkillNames.has(this.normalize(s.standardizedName)))
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
    const cvMap = new Map(
      cvSkills.map((s) => [this.normalize(s.standardizedName), s.experienceYears]),
    );

    let requiredYears = 0;
    let candidateYears = 0;

    for (const jdSkill of jdSkills) {
      const key = this.normalize(jdSkill.standardizedName);
      if (cvMap.has(key)) {
        requiredYears += jdSkill.experienceYears ?? 0;
        candidateYears += cvMap.get(key) ?? 0;
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

  private normalize(name: string): string {
    return (name ?? '').toLowerCase().trim();
  }

  private round(value: number, decimals = 2): number {
    const factor = Math.pow(10, decimals);
    return Math.round(value * factor) / factor;
  }
}
