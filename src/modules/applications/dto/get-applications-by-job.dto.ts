import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNumberString, IsOptional } from 'class-validator';
import { PaginationDto } from '../../../utils/pagination/pagination.dto';
import { ApplicationStatus } from '../entities/application.entity';

export class GetApplicationsByJobDto extends PaginationDto {
  @ApiPropertyOptional({
    enum: ApplicationStatus,
    description:
      'Filter by application status. Defaults to MATCHED if not provided.',
  })
  @IsOptional()
  @IsEnum(ApplicationStatus)
  status?: ApplicationStatus;

  @ApiPropertyOptional({
    description: 'Minimum matchScore threshold (0.0 → 1.0)',
    example: 0.7,
  })
  @IsOptional()
  @IsNumberString()
  minScore?: number;
}
