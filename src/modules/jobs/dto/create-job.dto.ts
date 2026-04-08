import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EmploymentType, JobStatus } from '../entities/job.entity';

export class CreateJobDto {
  @ApiPropertyOptional()
  employeeId?: string;

  @ApiProperty()
  jobTitleId?: string;

  @ApiProperty()
  jobTitleName?: string;

  @ApiProperty()
  subUnitId?: string;

  @ApiProperty()
  subUnitName?: string;

  @ApiPropertyOptional()
  fromDate?: Date;

  @ApiPropertyOptional()
  toDate?: Date;

  @ApiPropertyOptional({
    enum: EmploymentType,
    default: EmploymentType.FULL_TIME,
  })
  employmentType?: EmploymentType;

  @ApiPropertyOptional()
  location?: string;

  @ApiPropertyOptional()
  level?: string;

  @ApiPropertyOptional()
  description?: string;

  @ApiPropertyOptional()
  requirements?: string;

  @ApiPropertyOptional()
  responsibilities?: string;

  @ApiPropertyOptional()
  benefits?: string;

  @ApiPropertyOptional({ enum: JobStatus, default: JobStatus.OPEN })
  status?: JobStatus;
}
