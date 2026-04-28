import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  Unique,
} from 'typeorm';
import { BaseEntities } from '../../../common/entities/base.entity';
import { Candidate } from './candidate.entity';
import { EntitySkill } from '../../entity-skills/entities/entity-skill.entity';

export enum CvParsingStatus {
  PENDING = 'PENDING',
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
}

@Entity('CandidateCvs')
@Unique(['candidate', 'contentHash'])
export class CandidateCv extends BaseEntities {
  @ManyToOne(() => Candidate, (candidate) => candidate.candidateCvs)
  @JoinColumn({ name: 'candidateId' })
  candidate: Candidate;

  @Column()
  storageKey: string;

  @Column({ length: 64 })
  contentHash: string;

  @Column('text', { nullable: true })
  rawCvText: string;

  @Column('jsonb', { nullable: true })
  cvEmbedding: number[];

  @Column('text', { nullable: true })
  summary: string;

  @Column('jsonb', { nullable: true })
  metadata: any;

  @Column('jsonb', { nullable: true })
  parsedJson: any;

  @Column({
    type: 'enum',
    enum: CvParsingStatus,
    default: CvParsingStatus.PENDING,
  })
  parsingStatus: CvParsingStatus;

  @OneToMany(() => EntitySkill, (entitySkill) => entitySkill.candidateCv)
  entitySkills: EntitySkill[];
}
