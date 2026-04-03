import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { Skill } from '../../skills/entities/skill.entity';
import { BaseEntities } from '../../../common/entities/base.entity';
import { Job } from '../../jobs/entities/job.entity';
import { Candidate } from '../../candidates/entities/candidate.entity';

@Entity('EntitySkills')
export class EntitySkill extends BaseEntities {
  @ManyToOne(() => Skill, (skill) => skill.entitySkills)
  @JoinColumn({ name: 'skillId' })
  skill: Skill;

  @ManyToOne(() => Job, (job) => job.entitySkills, { nullable: true })
  @JoinColumn({ name: 'jobId' })
  job: Job;

  @ManyToOne(() => Candidate, (candidate) => candidate.entitySkills, {
    nullable: true,
  })
  @JoinColumn({ name: 'candidateId' })
  candidate: Candidate;

  @Column('int', { nullable: true })
  experienceYears: number;

  @Column({ nullable: true })
  standardizedName: string;
}
