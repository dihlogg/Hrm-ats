import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { Skill } from '../../skills/entities/skill.entity';
import { BaseEntities } from '../../../common/entities/base.entity';
import { Job } from '../../jobs/entities/job.entity';
import { CandidateCv } from '../../candidates/entities/candidate-cv.entity';

@Entity('EntitySkills')
export class EntitySkill extends BaseEntities {
  @ManyToOne(() => Skill, (skill) => skill.entitySkills, { nullable: true })
  @JoinColumn({ name: 'skillId' })
  skill: Skill;

  @ManyToOne(() => Job, (job) => job.entitySkills, { nullable: true })
  @JoinColumn({ name: 'jobId' })
  job: Job;

  @ManyToOne(() => CandidateCv, (cv) => cv.entitySkills, { nullable: true })
  @JoinColumn({ name: 'candidateCvId' })
  candidateCv: CandidateCv;

  @Column('decimal', { precision: 4, scale: 1, nullable: true })
  experienceYears: number;

  @Column({ nullable: true })
  standardizedName: string;
}
