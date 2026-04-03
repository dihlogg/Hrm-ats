import { Column, Entity, OneToMany } from 'typeorm';
import { EntitySkill } from '../../entity-skills/entities/entity-skill.entity';
import { BaseEntities } from '../../../common/entities/base.entity';

@Entity('Skills')
export class Skill extends BaseEntities {
  @Column()
  name: string;

  @Column({ nullable: true })
  category: string;

  @OneToMany(() => EntitySkill, (entitySkill) => entitySkill.skill)
  entitySkills: EntitySkill[];
}
