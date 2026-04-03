import { BaseEntities } from 'src/common/entities/base.entity';
import { Application } from 'src/modules/applications/entities/application.entity';
import { EntitySkill } from 'src/modules/entity-skills/entities/entity-skill.entity';
import { Column, Entity, OneToMany } from 'typeorm';

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
  cvFileUrl: string;

  @Column({ nullable: true })
  storageKey: string;

  @Column('jsonb', { nullable: true })
  metadata: any;

  @OneToMany(() => Application, (application) => application.candidate)
  applications: Application[];

  @OneToMany(() => EntitySkill, (entitySkill) => entitySkill.candidate)
  entitySkills: EntitySkill[];
}
