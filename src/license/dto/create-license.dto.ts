import { IsNotEmpty, IsString} from 'class-validator';

export class CreateLicenseDto {

  @IsNotEmpty()
  @IsString()
  id: string;

  @IsNotEmpty()
  @IsString()
  name: string;

  @IsNotEmpty()
  @IsString()
  degree: string;

  @IsNotEmpty()
  @IsString()
  institution: string;

  @IsNotEmpty()
  @IsString()
  shift: string;

  @IsNotEmpty()
  @IsString()
  telephone: string;

  @IsNotEmpty()
  @IsString()
  blood_type: string;

  @IsNotEmpty()
  @IsString()
  bus: string;

  @IsNotEmpty()
  @IsString()
  photo: string;

  /* @IsNotEmpty()
  @IsString()
  employeeId: string; */
}