import { Controller, Get, Post, Body, Query } from '@nestjs/common';
import { ApplicationsService } from './applications.service';
import { CreateApplicationDto } from './dto/create-application.dto';
import { ApiOperation, ApiQuery } from '@nestjs/swagger';

@Controller('applications')
export class ApplicationsController {
  constructor(private readonly applicationsService: ApplicationsService) {}

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
}
