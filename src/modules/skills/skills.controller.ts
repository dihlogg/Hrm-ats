import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  Put,
} from '@nestjs/common';
import { SkillsService } from './skills.service';
import { CreateSkillDto } from './dto/create-skill.dto';
import { UpdateSkillDto } from './dto/update-skill.dto';
import { Skill } from './entities/skill.entity';

@Controller('skills')
export class SkillsController {
  constructor(private readonly skillsService: SkillsService) {}

  //get all skills
  @Get('GetAllSkills')
  async findAll(): Promise<Skill[]> {
    return await this.skillsService.findAll();
  }

  //get skill by id
  @Get('GetSkillById/:id')
  async findOne(@Param('id') id: string): Promise<Skill> {
    return this.skillsService.findOne(id);
  }

  //create skill
  @Post('PostSkill')
  async create(@Body() createSkillDto: CreateSkillDto): Promise<Skill> {
    return await this.skillsService.create(createSkillDto);
  }

  //update skill
  @Put('PutSkill/:id')
  async update(
    @Param('id') id: string,
    @Body() updateSkillDto: UpdateSkillDto,
  ): Promise<boolean> {
    return this.skillsService.update(id, updateSkillDto);
  }

  //delete skill
  @Delete('DeleteSkill/:id')
  async delete(@Param('id') id: string): Promise<boolean> {
    return this.skillsService.delete(id);
  }

  //sort skills by name
  @Get('SortSkillsByName')
  async sortByName(
    @Query('sortOrder') sortOrder: 'ASC' | 'DESC' = 'ASC',
  ): Promise<Skill[]> {
    return this.skillsService.sortByName(sortOrder);
  }
}
