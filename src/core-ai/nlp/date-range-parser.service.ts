import { Injectable } from '@nestjs/common';

export interface WorkEntry {
  company: string;
  durationYears: number;
  rawDuration: string;
}

@Injectable()
export class DateRangeParserService {
  private readonly PRESENT_RE =
    /^(present|current|now|hiện tại|nay|đến nay|to date)$/i;

  private readonly MONTH_MAP: Record<string, number> = {
    jan: 0, january: 0,
    feb: 1, february: 1,
    mar: 2, march: 2,
    apr: 3, april: 3,
    may: 4,
    jun: 5, june: 5,
    jul: 6, july: 6,
    aug: 7, august: 7,
    sep: 8, september: 8,
    oct: 9, october: 9,
    nov: 10, november: 10,
    dec: 11, december: 11,
  };

  // ─── Public API ────────────────────────────────────────────────────────────

  /**
   * Build a work timeline from the LLM's experience array.
   * Parses each `duration` string into an exact decimal `durationYears`.
   */
  buildTimeline(
    experiences: Array<{ company: string; duration: string }>,
  ): WorkEntry[] {
    return (experiences ?? [])
      .map((exp) => ({
        company: exp.company?.trim() ?? '',
        durationYears: this.parseDurationText(exp.duration ?? ''),
        rawDuration: exp.duration ?? '',
      }))
      .filter((e) => e.company);
  }

  /**
   * Calculate total experienceYears for a skill given the companies it was
   * used at. Uses Jaro-Winkler fuzzy matching for company name resolution.
   * Returns 0 when no match is found (Q2 decision).
   */
  calculateExperienceYears(
    usedAtCompanies: string[],
    timeline: WorkEntry[],
  ): number {
    if (!usedAtCompanies?.length || !timeline?.length) return 0;

    let total = 0;
    for (const name of usedAtCompanies) {
      const entry = this.findBestMatch(name, timeline);
      if (entry) total += entry.durationYears;
    }
    return this.round(total, 1);
  }

  /**
   * Parse a duration string and return decimal years.
   *
   * Supported formats (EN + VI):
   *   "06/2020 - Present"
   *   "Jun 2020 - Dec 2022"
   *   "January 2018 - Present"
   *   "2018 - 2021"
   *   "Tháng 6/2020 - Hiện tại"
   *   "T6/2020 - T12/2022"
   *   "4 years" / "6 months"
   */
  parseDurationText(text: string): number {
    if (!text?.trim()) return 0;
    const s = text.trim();
    const now = new Date();

    // Pattern 1 — MM/YYYY - MM/YYYY  or  MM/YYYY - Present
    const p1 =
      /(\d{1,2})\/(\d{4})\s*[-–—to]+\s*(?:(\d{1,2})\/(\d{4})|(present|current|now|hiện tại|nay|đến nay))/i;
    let m = s.match(p1);
    if (m) {
      const from = new Date(+m[2], +m[1] - 1, 1);
      const to = m[5] ? now : new Date(+m[4], +m[3] - 1, 1);
      return this.calcYears(from, to);
    }

    // Pattern 2 — Tháng 6/2020 or T6/2020 (Vietnamese abbreviation)
    const p2 =
      /(?:tháng\s*|t)(\d{1,2})\/(\d{4})\s*[-–—to]+\s*(?:(?:tháng\s*|t)(\d{1,2})\/(\d{4})|(hiện tại|nay|đến nay|present|current|now))/i;
    m = s.match(p2);
    if (m) {
      const from = new Date(+m[2], +m[1] - 1, 1);
      const to = m[5] ? now : new Date(+m[4], +m[3] - 1, 1);
      return this.calcYears(from, to);
    }

    // Pattern 3 — "Jun 2020 - Dec 2022" or "June 2020 - Present"
    const monthKeys = Object.keys(this.MONTH_MAP).join('|');
    const p3 = new RegExp(
      `(${monthKeys})\\w*\\s+(\\d{4})\\s*[-–—to]+\\s*` +
      `(?:(${monthKeys})\\w*\\s+(\\d{4})|(present|current|now|hiện tại|nay|đến nay))`,
      'i',
    );
    m = s.match(p3);
    if (m) {
      const fromMon = this.MONTH_MAP[m[1].toLowerCase()] ?? 0;
      const from = new Date(+m[2], fromMon, 1);
      const to = m[5]
        ? now
        : new Date(+m[4], this.MONTH_MAP[m[3].toLowerCase()] ?? 11, 1);
      return this.calcYears(from, to);
    }

    // Pattern 4 — YYYY - YYYY  or  YYYY - Present
    const p4 =
      /\b(\d{4})\s*[-–—to]+\s*(?:(\d{4})|(present|current|now|hiện tại|nay|đến nay))\b/i;
    m = s.match(p4);
    if (m) {
      const from = new Date(+m[1], 0, 1);       // Jan 1 of start year
      const to = m[3] ? now : new Date(+m[2], 11, 31); // Dec 31 of end year
      return this.calcYears(from, to);
    }

    // Pattern 5 — "4 years" / "6 months" (pre-computed text)
    const pYears = /(\d+(?:\.\d+)?)\s*(?:years?|năm)/i;
    const pMonths = /(\d+)\s*(?:months?|tháng)/i;
    m = s.match(pYears);
    if (m) return parseFloat(m[1]);
    m = s.match(pMonths);
    if (m) return this.round(+m[1] / 12, 1);

    return 0;
  }

  /**
   * Format decimal years as human-readable Vietnamese string.
   * 4.917 → "4 năm 11 tháng"
   */
  formatDuration(durationYears: number): string {
    if (durationYears <= 0) return '0 tháng';
    const totalMonths = Math.round(durationYears * 12);
    const years = Math.floor(totalMonths / 12);
    const months = totalMonths % 12;
    if (years === 0) return `${months} tháng`;
    if (months === 0) return `${years} năm`;
    return `${years} năm ${months} tháng`;
  }

  // ─── Private helpers ───────────────────────────────────────────────────────

  private calcYears(from: Date, to: Date): number {
    if (to <= from) return 0;
    return this.round((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24 * 365.25), 1);
  }

  private round(value: number, decimals: number): number {
    const f = Math.pow(10, decimals);
    return Math.round(value * f) / f;
  }

  /**
   * Find best WorkEntry for a company name using substring + Jaro-Winkler.
   * Threshold: 0.82 (Q1 decision).
   */
  private findBestMatch(name: string, entries: WorkEntry[]): WorkEntry | null {
    const norm = name.toLowerCase().trim();
    if (!norm) return null;

    // Exact / substring match wins immediately
    for (const e of entries) {
      const en = e.company.toLowerCase().trim();
      if (en.includes(norm) || norm.includes(en)) return e;
    }

    // Fuzzy fallback (Jaro-Winkler ≥ 0.82)
    let bestScore = 0;
    let bestEntry: WorkEntry | null = null;
    for (const e of entries) {
      const score = this.jaroWinkler(norm, e.company.toLowerCase().trim());
      if (score > bestScore && score >= 0.82) {
        bestScore = score;
        bestEntry = e;
      }
    }
    return bestEntry;
  }

  private jaroWinkler(s1: string, s2: string): number {
    if (s1 === s2) return 1;
    if (!s1.length || !s2.length) return 0;
    const maxDist = Math.floor(Math.max(s1.length, s2.length) / 2) - 1;
    const s1m = new Array(s1.length).fill(false);
    const s2m = new Array(s2.length).fill(false);
    let matches = 0;
    for (let i = 0; i < s1.length; i++) {
      const start = Math.max(0, i - maxDist);
      const end = Math.min(i + maxDist + 1, s2.length);
      for (let j = start; j < end; j++) {
        if (s2m[j] || s1[i] !== s2[j]) continue;
        s1m[i] = true; s2m[j] = true; matches++; break;
      }
    }
    if (!matches) return 0;
    let t = 0, k = 0;
    for (let i = 0; i < s1.length; i++) {
      if (!s1m[i]) continue;
      while (!s2m[k]) k++;
      if (s1[i] !== s2[k]) t++;
      k++;
    }
    const jaro = (matches / s1.length + matches / s2.length + (matches - t / 2) / matches) / 3;
    let prefix = 0;
    const maxP = Math.min(4, s1.length, s2.length);
    for (let i = 0; i < maxP; i++) {
      if (s1[i] === s2[i]) prefix++; else break;
    }
    return jaro + prefix * 0.1 * (1 - jaro);
  }
}
