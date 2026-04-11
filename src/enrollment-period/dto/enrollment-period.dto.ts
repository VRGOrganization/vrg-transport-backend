import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsInt,
  IsMongoId,
  IsOptional,
  Min,
} from 'class-validator';

export class CreateEnrollmentPeriodDto {
  @IsDateString()
  startDate: Date;

  @IsDateString()
  endDate: Date;

  @IsInt()
  @Min(1)
  totalSlots: number;

  @IsInt()
  @Min(1)
  licenseValidityMonths: number;
}

export class UpdateEnrollmentPeriodDto {
  @IsOptional()
  @IsDateString()
  startDate?: Date;

  @IsOptional()
  @IsDateString()
  endDate?: Date;

  @IsOptional()
  @IsInt()
  @Min(1)
  totalSlots?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  licenseValidityMonths?: number;
}

export class ReleaseSlotsDto {
  @IsInt()
  @Min(1)
  quantity: number;
}

export class ConfirmReleaseDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsMongoId({ each: true })
  requestIds: string[];
}
