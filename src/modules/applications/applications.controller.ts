import { Controller, Get, Post, Body, Query, Param } from '@nestjs/common';
import { ApplicationsService } from './applications.service';
import { CreateApplicationDto } from './dto/create-application.dto';
import { GetApplicationsByJobDto } from './dto/get-applications-by-job.dto';
import { ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';

@ApiTags('Applications')
@Controller('applications')
export class ApplicationsController {
  constructor(private readonly applicationsService: ApplicationsService) { }

  @Get('presigned-url/download')
  @ApiOperation({ summary: 'Get presigned URL for CV download/view' })
  @ApiQuery({ name: 'storageKey', example: 'cvs/uuid.pdf', description: 'Storage key of the uploaded file' })
  async getPresignedDownloadUrl(
    @Query('storageKey') storageKey: string,
  ) {
    return this.applicationsService.getPresignedDownloadUrl(storageKey);
  }

  @Get('presigned-url')
  @ApiOperation({ summary: 'Get presigned URL for CV upload' })
  @ApiQuery({ name: 'fileName', example: 'my-cv.pdf' })
  @ApiQuery({ name: 'contentType', example: 'application/pdf' })
  async getPresignedUrl(
    @Query('fileName') fileName: string,
    @Query('contentType') contentType: string,
  ) {
    return this.applicationsService.getPresignedUrl(fileName, contentType);
  }


  @Post('apply')
  @ApiOperation({ summary: 'Submit job application' })
  async apply(@Body() createApplicationDto: CreateApplicationDto) {
    return this.applicationsService.applyJob(createApplicationDto);
  }

  @Get('by-job/:jobId/ranked')
  @ApiOperation({
    summary: 'Get candidates ranked by match score for a specific job',
  })
  @ApiParam({ name: 'jobId', type: 'string', description: 'UUID of the job' })
  async getRankedCandidatesByJob(
    @Param('jobId') jobId: string,
    @Query() query: GetApplicationsByJobDto,
  ) {
    return this.applicationsService.getApplicationsByJob(jobId, query);
  }
  @Post(':id/hire')
  @ApiOperation({ summary: 'Hire a candidate' })
  @ApiParam({ name: 'id', type: 'string', description: 'UUID of the application' })
  async hireCandidate(@Param('id') id: string) {
    return this.applicationsService.hireCandidate(id);
  }
}
