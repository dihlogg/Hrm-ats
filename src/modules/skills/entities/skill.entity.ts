import { BaseEntities } from 'src/common/entities/base.entity';
import { EntitySkill } from 'src/modules/entity-skills/entities/entity-skill.entity';
import { Column, Entity, OneToMany } from 'typeorm';

@Entity('Skills')
export class Skill extends BaseEntities {
  @Column()
  name: string;

  @Column({ nullable: true })
  category: string;

  @OneToMany(() => EntitySkill, (entitySkill) => entitySkill.skill)
  entitySkills: EntitySkill[];
}
