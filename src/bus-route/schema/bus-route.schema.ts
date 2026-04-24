import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type BusRouteDocument = HydratedDocument<BusRoute>;

@Schema({ _id: false })
export class BusRouteDestination {
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true, trim: true, lowercase: true })
  nameNormalized: string;

  @Prop({ default: true })
  active: boolean;
}

export const BusRouteDestinationSchema =
  SchemaFactory.createForClass(BusRouteDestination);

@Schema({ timestamps: true, collection: 'bus_routes' })
export class BusRoute {
  @Prop({ required: true, trim: true })
  lineNumber: string;

  @Prop({ required: true, trim: true, lowercase: true, select: false })
  lineNumberNormalized: string;

  @Prop({ type: [BusRouteDestinationSchema], default: [] })
  destinations: BusRouteDestination[];

  @Prop({ default: true })
  active: boolean;
}

export const BusRouteSchema = SchemaFactory.createForClass(BusRoute);
BusRouteSchema.index(
  { lineNumberNormalized: 1 },
  { unique: true, partialFilterExpression: { active: true } },
);
