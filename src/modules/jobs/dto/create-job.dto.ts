import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EmploymentType, JobStatus } from '../entities/job.entity';

export class CreateJobDto {
  @ApiPropertyOptional()
  employeeId?: string;

  @ApiProperty()
  title: string;

  @ApiPropertyOptional()
  subtitle?: string;

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
  description?: string;

  @ApiPropertyOptional()
  responsibilities?: string;

  @ApiPropertyOptional()
  benefits?: string;

  @ApiPropertyOptional({ enum: JobStatus, default: JobStatus.OPEN })
  status?: JobStatus;
}
