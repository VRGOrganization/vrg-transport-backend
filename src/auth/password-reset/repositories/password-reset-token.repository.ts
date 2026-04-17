import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { PasswordResetToken, PasswordResetTokenDocument } from '../schemas/password-reset-token.schema';

@Injectable()
export class PasswordResetTokenRepository {
  constructor(
    @InjectModel(PasswordResetToken.name)
    private readonly model: Model<PasswordResetTokenDocument>,
  ) {}

  async create(data: {
    userId: Types.ObjectId;
    tokenHash: string;
    expiresAt: Date;
    ip: string;
  }): Promise<PasswordResetToken> {
    const token = new this.model(data);
    return token.save();
  }

  async findByTokenHash(tokenHash: string): Promise<PasswordResetToken | null> {
    return this.model.findOne({ tokenHash }).exec();
  }

  async findActiveByUserId(userId: Types.ObjectId): Promise<PasswordResetToken | null> {
    return this.model
      .findOne({
        userId,
        usedAt: null,
        expiresAt: { $gt: new Date() },
      })
      .exec();
  }

  async findByUserIdCreatedInLastHours(
    userId: Types.ObjectId,
    hours: number,
  ): Promise<PasswordResetToken | null> {
    const hoursAgo = new Date(Date.now() - hours * 60 * 60 * 1000);
    return this.model
      .findOne({
        userId,
        createdAt: { $gte: hoursAgo },
      })
      .sort({ createdAt: -1 })
      .exec();
  }

  async markAsUsed(id: Types.ObjectId): Promise<PasswordResetToken | null> {
    return this.model.findByIdAndUpdate(id, { usedAt: new Date() }, { new: true }).exec();
  }

  async deleteExpired(): Promise<number> {
    const result = await this.model.deleteMany({ expiresAt: { $lt: new Date() } }).exec();
    return result.deletedCount || 0;
  }
}