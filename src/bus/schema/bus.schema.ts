import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';


export type BusDocument = HydratedDocument<Bus>;

@Schema({ _id: false })
export class UniversitySlot {
  @Prop({ type: Types.ObjectId, ref: 'University', required: true })
  universityId: Types.ObjectId;

  // 1 = maior prioridade. Único dentro do mesmo ônibus.
  @Prop({ required: true, min: 1 })
  priorityOrder: number;

  // Vagas preenchidas por esta faculdade neste ônibus no período atual.
  // Resetado ao fechar EnrollmentPeriod.
  @Prop({ default: 0, min: 0 })
  filledSlots: number;
}

export const UniversitySlotSchema = SchemaFactory.createForClass(UniversitySlot);

@Schema({ timestamps: true, collection: 'buses' })
export class Bus {
  @Prop({ required: true, trim: true, unique: true })
  identifier: string;

  // OPCIONAL. Ausente = sem limite próprio.
  @Prop({ required: false, min: 1 })
  capacity?: number;

  // Substitui universityIds[]
  @Prop({ type: [UniversitySlotSchema], default: [] })
  universitySlots: UniversitySlot[];

  @Prop({ default: true })
  active: boolean;
}

export const BusSchema = SchemaFactory.createForClass(Bus);