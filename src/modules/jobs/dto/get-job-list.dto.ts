import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';
import { PaginationDto } from '../../../utils/pagination/pagination.dto';

export class GetJobListDto extends PaginationDto {
  @ApiPropertyOptional({
    enum: ['title', 'jobTitleName', 'level', 'location', 'createDate'],
  })
  @IsOptional()
  @IsIn(['title', 'jobTitleName', 'level', 'location', 'createDate'])
  sortBy?: string;

  @ApiPropertyOptional({ enum: ['ASC', 'DESC'] })
  @IsOptional()
  @IsIn(['ASC', 'DESC'])
  sortOrder?: 'ASC' | 'DESC';

  @IsOptional()
  @IsString()
  keyword?: string;

  @IsOptional()
  @IsString()
  level?: string;

  @IsOptional()
  @IsString()
  jobTitleName?: string;

  @IsOptional()
  @IsString()
  location?: string;
}
