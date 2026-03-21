import {Prop, Schema, SchemaFactory} from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type AdminDocument = HydratedDocument<Admin>;

@Schema({timestamps: true, collection: 'admins'})
export class Admin{
    @Prop({required: true, trim: true})
    name: string;

    @Prop({required: true, trim: true, unique: true, lowercase: true})
    username: string;

    @Prop({required: true})
    password: string; // hashed password com bcrypt
}

export const AdminSchema = SchemaFactory.createForClass(Admin);

AdminSchema.set('toJSON', {
  transform: (_doc, ret: any) => {
    delete ret.password;
    return ret;
  },
});