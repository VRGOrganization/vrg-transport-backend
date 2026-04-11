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
  dataInicio: Date;

  @IsDateString()
  dataFim: Date;

  @IsInt()
  @Min(1)
  qtdVagasTotais: number;

  @IsInt()
  @Min(1)
  validadeCarteirinhaMeses: number;
}

export class UpdateEnrollmentPeriodDto {
  @IsOptional()
  @IsDateString()
  dataInicio?: Date;

  @IsOptional()
  @IsDateString()
  dataFim?: Date;

  @IsOptional()
  @IsInt()
  @Min(1)
  qtdVagasTotais?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  validadeCarteirinhaMeses?: number;
}

export class ReleaseSlotsDto {
  @IsInt()
  @Min(1)
  quantidade: number;
}

export class ConfirmReleaseDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsMongoId({ each: true })
  requestIds: string[];
}
