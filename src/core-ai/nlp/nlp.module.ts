import { Module } from '@nestjs/common';
import { DateRangeParserService } from './date-range-parser.service';

@Module({
  providers: [DateRangeParserService],
  exports: [DateRangeParserService],
})
export class NlpModule {}
