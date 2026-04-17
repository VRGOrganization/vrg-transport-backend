import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type BusDocument = HydratedDocument<Bus>;

@Schema({ timestamps: true, collection: 'buses' })
export class Bus {
  @Prop({ required: true, trim: true, unique: true })
  identifier: string;

  @Prop({ required: true, min: 1 })
  capacity: number;

  @Prop({ type: [{ type: Types.ObjectId, ref: 'University' }], default: [] })
  universityIds: Types.ObjectId[];

  @Prop({ default: true })
  active: boolean;
}

export const BusSchema = SchemaFactory.createForClass(Bus);