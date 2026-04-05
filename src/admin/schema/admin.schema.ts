import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type AdminDocument = HydratedDocument<Admin>;

@Schema({ timestamps: true, collection: 'admins' })
export class Admin {
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true, trim: true, unique: true, lowercase: true })
  username: string;

  @Prop({ required: true, select: false })
  password: string;

  @Prop({type: String, default: null, select: false})
  refreshTokenHash: string | null;

  // Increment this field to invalidate all existing refresh tokens
  @Prop({ type: Number, default: 0,  select: false })
  refreshTokenVersion: number;
}

export const AdminSchema = SchemaFactory.createForClass(Admin);

AdminSchema.set('toJSON', {
  transform: (_doc, ret: any) => {
    delete ret.password;
    delete ret.refreshTokenHash;
    delete ret.refreshTokenVersion;
    return ret;
  },
});
