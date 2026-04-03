import { Injectable } from '@nestjs/common';
import { CreateEntitySkillDto } from './dto/create-entity-skill.dto';
import { UpdateEntitySkillDto } from './dto/update-entity-skill.dto';

@Injectable()
export class EntitySkillsService {
  create(createEntitySkillDto: CreateEntitySkillDto) {
    return 'This action adds a new entitySkill';
  }

  findAll() {
    return `This action returns all entitySkills`;
  }

  findOne(id: number) {
    return `This action returns a #${id} entitySkill`;
  }

  update(id: number, updateEntitySkillDto: UpdateEntitySkillDto) {
    return `This action updates a #${id} entitySkill`;
  }

  remove(id: number) {
    return `This action removes a #${id} entitySkill`;
  }
}
