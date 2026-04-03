import { BaseEntities } from 'src/common/entities/base.entity';
import { Application } from 'src/modules/applications/entities/application.entity';
import { EntitySkill } from 'src/modules/entity-skills/entities/entity-skill.entity';
import { Column, Entity, OneToMany } from 'typeorm';

export enum JobStatus {
  OPEN = 'OPEN',
  CLOSED = 'CLOSED',
}

export enum EmploymentType {
  FULL_TIME = 'FULL_TIME',
  PART_TIME = 'PART_TIME',
  REMOTE = 'REMOTE',
}

@Entity('Jobs')
export class Job extends BaseEntities {
  @Column('uuid')
  employeeId: string;

  @Column()
  title: string;

  @Column({ nullable: true })
  subTitle: string;

  @Column({ type: 'timestamptz', nullable: true })
  fromDate: Date;

  @Column({ type: 'timestamptz', nullable: true })
  toDate: Date;

  @Column({
    type: 'enum',
    enum: EmploymentType,
    default: EmploymentType.FULL_TIME,
  })
  employmentType: EmploymentType;

  @Column({ nullable: true })
  location: string;

  @Column('text', { nullable: true })
  description: string;

  @Column('text', { nullable: true })
  responsibilities: string;

  @Column('text', { nullable: true })
  requirements: string;

  @Column('text', { nullable: true })
  benefits: string;

  @Column('text', { nullable: true })
  rawText: string;

  @Column('jsonb', { nullable: true })
  parsedJson: any;

  @Column({ nullable: true })
  fileUrl: string;

  @Column({ nullable: true })
  storageKey: string;

  @Column({
    type: 'enum',
    enum: JobStatus,
    default: JobStatus.OPEN,
  })
  status: JobStatus;

  @OneToMany(() => Application, (application) => application.job)
  applications: Application[];

  @OneToMany(() => EntitySkill, (entitySkill) => entitySkill.job)
  entitySkills: EntitySkill[];
}
