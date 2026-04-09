import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateSkillDto } from './dto/create-skill.dto';
import { UpdateSkillDto } from './dto/update-skill.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Skill } from './entities/skill.entity';
import { Repository } from 'typeorm';

@Injectable()
export class SkillsService {
  constructor(
    @InjectRepository(Skill)
    private readonly repo: Repository<Skill>,
  ) {}

  async create(createSkillDto: CreateSkillDto): Promise<Skill> {
    const skill = this.repo.create(createSkillDto);
    return await this.repo.save(skill);
  }

  async findAll(): Promise<Skill[]> {
    return await this.repo.find({
      order: {
        createDate: 'ASC',
      },
    });
  }

  async findOne(id: string): Promise<Skill> {
    const skill = await this.repo.findOne({ where: { id } });
    if (!skill) {
      throw new NotFoundException('Skill not found');
    }
    return skill;
  }

  async update(id: string, updateSkillDto: UpdateSkillDto): Promise<boolean> {
    await this.repo.update(id, updateSkillDto);
    const updatedSkill = await this.repo.findOne({ where: { id } });
    if (!updatedSkill) {
      throw new NotFoundException('Skill not found');
    }
    return true;
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.repo.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException('Skill not found');
    }
    return true;
  }

  async sortByName(order: 'ASC' | 'DESC' = 'ASC'): Promise<Skill[]> {
    return this.repo.find({
      order: {
        name: order,
      },
    });
  }
}
