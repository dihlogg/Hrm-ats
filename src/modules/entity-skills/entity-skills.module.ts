import { Module } from '@nestjs/common';
import { EntitySkillsService } from './entity-skills.service';
import { EntitySkillsController } from './entity-skills.controller';
import { EntitySkill } from './entities/entity-skill.entity';
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({
  imports: [TypeOrmModule.forFeature([EntitySkill])],
  controllers: [EntitySkillsController],
  providers: [EntitySkillsService],
})
export class EntitySkillsModule {}
