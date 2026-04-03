import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
} from '@nestjs/common';
import { JobsService } from './jobs.service';
import { CreateJobDto } from './dto/create-job.dto';
import { UpdateJobDto } from './dto/update-job.dto';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('Jobs')
@Controller('jobs')
export class JobsController {
  constructor(private readonly jobsService: JobsService) {}

  //get all jobs
  @Get('GetAllJobs')
  async findAll() {
    return await this.jobsService.findAll();
  }

  //get job by id
  @Get('GetJobById/:id')
  async findOne(@Param('id') id: string) {
    return await this.jobsService.findOne(id);
  }

  //create job
  @Post('CreateJob')
  async create(@Body() createJobDto: CreateJobDto) {
    return await this.jobsService.create(createJobDto);
  }

  //update job
  @Patch('UpdateJob/:id')
  async update(@Param('id') id: string, @Body() updateJobDto: UpdateJobDto) {
    return await this.jobsService.update(id, updateJobDto);
  }

  //delete job
  @Delete('DeleteJob/:id')
  async delete(@Param('id') id: string) {
    return await this.jobsService.delete(id);
  }
}
