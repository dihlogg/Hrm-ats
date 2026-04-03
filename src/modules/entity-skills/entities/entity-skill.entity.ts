import { BaseEntities } from 'src/common/entities/base.entity';
import { Candidate } from 'src/modules/candidates/entities/candidate.entity';
import { Job } from 'src/modules/jobs/entities/job.entity';
import { Skill } from 'src/modules/skills/entities/skill.entity';
import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';

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
