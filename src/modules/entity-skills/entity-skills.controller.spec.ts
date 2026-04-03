import { Test, TestingModule } from '@nestjs/testing';
import { EntitySkillsController } from './entity-skills.controller';
import { EntitySkillsService } from './entity-skills.service';

describe('EntitySkillsController', () => {
  let controller: EntitySkillsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [EntitySkillsController],
      providers: [EntitySkillsService],
    }).compile();

    controller = module.get<EntitySkillsController>(EntitySkillsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
