import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
} from '@nestjs/common';
import { JobsService } from './jobs.service';
import { CreateJobDto } from './dto/create-job.dto';
import { UpdateJobDto } from './dto/update-job.dto';
import { ApiTags } from '@nestjs/swagger';
import { PaginationDto } from '../../utils/pagination/pagination.dto';
import { GetJobListDto } from './dto/get-job-list.dto';

@ApiTags('Jobs')
@Controller('jobs')
export class JobsController {
  constructor(private readonly jobsService: JobsService) { }

  //get all jobs
  @Get('GetAllJobs')
  async findAll(@Query() paginationDto: PaginationDto) {
    return await this.jobsService.findAll(paginationDto);
  }

  //get jobs by level
  @Get('GetJobsByLevel/:level')
  async findByLevel(
    @Param('level') level: string,
    @Query() paginationDto: PaginationDto,
  ) {
    return await this.jobsService.findByLevel(level, paginationDto);
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

  //get job list with pagination
  @Get('GetJobList')
  async getJobList(@Query() query: GetJobListDto) {
    return await this.jobsService.getJobList(query);
  }

  @Get('stats/status')
  async getJobStatsByStatus() {
    return await this.jobsService.getJobStatsByStatus();
  }
}
