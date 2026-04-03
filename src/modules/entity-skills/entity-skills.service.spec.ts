import { Test, TestingModule } from '@nestjs/testing';
import { EntitySkillsService } from './entity-skills.service';

describe('EntitySkillsService', () => {
  let service: EntitySkillsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [EntitySkillsService],
    }).compile();

    service = module.get<EntitySkillsService>(EntitySkillsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
