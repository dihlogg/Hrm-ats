import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export class CreateApplicationDto {
  @ApiProperty()
  jobId: string;

  @ApiProperty()
  fullName: string;

  @ApiProperty()
  email: string;

  @ApiProperty()
  phoneNumber: string;

  @ApiPropertyOptional()
  profileUrl?: string;

  @ApiPropertyOptional()
  coverLetter?: string;

  @ApiProperty({
    description: 'CV Key get from API presigned-url after upload success',
  })
  storageKey: string;
}
