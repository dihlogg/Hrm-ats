import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { EntitySkillsService } from './entity-skills.service';
import { CreateEntitySkillDto } from './dto/create-entity-skill.dto';
import { UpdateEntitySkillDto } from './dto/update-entity-skill.dto';

@Controller('entity-skills')
export class EntitySkillsController {
  constructor(private readonly entitySkillsService: EntitySkillsService) {}

  @Post()
  create(@Body() createEntitySkillDto: CreateEntitySkillDto) {
    return this.entitySkillsService.create(createEntitySkillDto);
  }

  @Get()
  findAll() {
    return this.entitySkillsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.entitySkillsService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateEntitySkillDto: UpdateEntitySkillDto) {
    return this.entitySkillsService.update(+id, updateEntitySkillDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.entitySkillsService.remove(+id);
  }
}
