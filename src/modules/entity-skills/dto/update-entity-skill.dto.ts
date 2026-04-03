import { PartialType } from '@nestjs/mapped-types';
import { CreateEntitySkillDto } from './create-entity-skill.dto';

export class UpdateEntitySkillDto extends PartialType(CreateEntitySkillDto) {}
