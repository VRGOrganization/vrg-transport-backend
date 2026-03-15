import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

// Enum garante type safety no TypeScript e reutilização em todo o módulo.
// Antes era string livre — um typo como 'activ' compilava sem erro.
export enum LicenseStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  EXPIRED = 'expired',
}

export type LicenseDocument = License & Document;

@Schema({ timestamps: true })
export class License {
  @Prop({ required: true })
  studentId: string;

  @Prop({ required: true })
  employeeId: string;

  @Prop({ required: true })
  imageLicense: string;

  @Prop({
    required: true,
    enum: Object.values(LicenseStatus),
    default: LicenseStatus.ACTIVE,
  })
  status: LicenseStatus;

  @Prop({ default: true })
  existing: boolean;

  @Prop({ required: true })
  expirationDate: Date;
}

export const LicenseSchema = SchemaFactory.createForClass(License);

// Índice para buscas frequentes por studentId (findOneByStudentId).
// Sem índice, o Mongo faz full collection scan — O(n) em vez de O(log n).
LicenseSchema.index({ studentId: 1 });
