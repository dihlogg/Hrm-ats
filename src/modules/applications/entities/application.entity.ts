import { BaseEntities } from 'src/common/entities/base.entity';
import { Candidate } from 'src/modules/candidates/entities/candidate.entity';
import { Job } from 'src/modules/jobs/entities/job.entity';
import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';

@Entity('Applications')
export class Application extends BaseEntities {
  @ManyToOne(() => Job, (job) => job.applications)
  @JoinColumn({ name: 'jobId' })
  job: Job;

  @ManyToOne(() => Candidate, (candidate) => candidate.applications)
  @JoinColumn({ name: 'candidateId' })
  candidate: Candidate;

  @Column()
  status: string;

  @Column('jsonb', { nullable: true })
  jobSnapshotJson: any;

  @Column('decimal', { nullable: true })
  matchScore: number;

  @Column('decimal', { nullable: true })
  skillMatchPercent: number;

  @Column({ nullable: true })
  experienceMatchStatus: string;

  @Column('text', { nullable: true })
  matchReason: string;

  @Column('text', { nullable: true })
  rawData: string;
}
