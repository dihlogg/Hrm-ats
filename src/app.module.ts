import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JobsModule } from './modules/jobs/jobs.module';
import { CandidatesModule } from './modules/candidates/candidates.module';
import { SkillsModule } from './modules/skills/skills.module';
import { ApplicationsModule } from './modules/applications/applications.module';
import { EntitySkillsModule } from './modules/entity-skills/entity-skills.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }), // Load .env
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT),
      username: process.env.DB_USERNAME,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      autoLoadEntities: true,
      synchronize: false,
    }),
    JobsModule,
    CandidatesModule,
    SkillsModule,
    ApplicationsModule,
    EntitySkillsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
