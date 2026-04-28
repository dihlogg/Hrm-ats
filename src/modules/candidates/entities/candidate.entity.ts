import { Column, Entity, OneToMany } from 'typeorm';
import { BaseEntities } from '../../../common/entities/base.entity';
import { Application } from '../../applications/entities/application.entity';
import { CandidateCv } from './candidate-cv.entity';

@Entity('Candidates')
export class Candidate extends BaseEntities {
  @Column({ name: 'full_name' })
  fullName: string;

  @Column()
  email: string;

  @Column({ nullable: true })
  phoneNumber: string;

  @Column({ nullable: true })
  profileUrl: string;

  @OneToMany(() => Application, (application) => application.candidate)
  applications: Application[];

  @OneToMany(() => CandidateCv, (cv) => cv.candidate)
  candidateCvs: CandidateCv[];
}
