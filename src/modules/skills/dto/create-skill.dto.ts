import { ApiProperty } from "@nestjs/swagger";

export class CreateSkillDto {
    @ApiProperty()
    name: string;

    @ApiProperty()
    category?: string;
}
