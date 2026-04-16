import { Column, Entity, OneToMany } from 'typeorm';
import { BaseEntities } from '../../../common/entities/base.entity';
import { EntitySkill } from '../../entity-skills/entities/entity-skill.entity';
import { Application } from '../../applications/entities/application.entity';

@Entity('Candidates')
export class Candidate extends BaseEntities {
  @Column({ name: 'full_name' })
  fullName: string;

  @Column()
  email: string;

  @Column({ nullable: true })
  phoneNumber: string;

  @Column('text', { nullable: true })
  rawCvText: string;

  @Column('text', { nullable: true })
  summary: string;

  @Column({ nullable: true })
  profileUrl: string;

  @Column({ nullable: true })
  cvFileUrl: string;

  @Column({ nullable: true })
  storageKey: string;

  @Column('jsonb', { nullable: true })
  cvEmbedding: number[];

  @Column('jsonb', { nullable: true })
  metadata: any;

  @OneToMany(() => Application, (application) => application.candidate)
  applications: Application[];

  @OneToMany(() => EntitySkill, (entitySkill) => entitySkill.candidate)
  entitySkills: EntitySkill[];
}
