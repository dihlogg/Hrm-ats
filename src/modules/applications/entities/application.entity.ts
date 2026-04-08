import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntities } from '../../../common/entities/base.entity';
import { Candidate } from '../../candidates/entities/candidate.entity';
import { Job } from '../../jobs/entities/job.entity';

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

  @Column('text', { nullable: true })
  coverLetter: string;

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
