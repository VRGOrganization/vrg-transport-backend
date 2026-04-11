import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Session, SessionDocument, UserType } from './session.schema';
import {
  CreateSessionDto,
  ISessionStore,
  SessionPayload,
} from './session-store.interface';

@Injectable()
export class MongoSessionStore implements ISessionStore {
  constructor(
    @InjectModel(Session.name)
    private readonly sessionModel: Model<SessionDocument>,
  ) {}

  async create(dto: CreateSessionDto): Promise<SessionPayload> {
    const now = new Date();
    const doc = await this.sessionModel.create({
      _id: new Types.ObjectId(),
      userId: dto.userId,
      userType: dto.userType,
      userAgent: dto.userAgent ?? null,
      ipAddress: dto.ipAddress ?? null,
      createdAt: now,
      expiresAt: dto.expiresAt,
      lastSeenAt: now,
      revoked: false,
      revokedAt: null,
    });

    return this.toPayload(doc);
  }

  async findById(sessionId: string): Promise<SessionPayload | null> {
    if (!Types.ObjectId.isValid(sessionId)) return null;

    const doc = await this.sessionModel.findOneAndUpdate(
      {
        _id: new Types.ObjectId(sessionId),
        revoked: false,
        expiresAt: { $gt: new Date() },
      },
      {
        $set: { lastSeenAt: new Date() },
        $inc: { version: 1 },
      },
      { returnDocument: 'after' },
    );

    if (!doc) return null;
    return this.toPayload(doc);
  }

  async touch(sessionId: string): Promise<void> {
    if (!Types.ObjectId.isValid(sessionId)) return;

    await this.sessionModel.updateOne(
      { _id: new Types.ObjectId(sessionId), revoked: false },
      { $set: { lastSeenAt: new Date() } },
    );
  }

  async revoke(sessionId: string): Promise<void> {
    if (!Types.ObjectId.isValid(sessionId)) return;

    await this.sessionModel.updateOne(
      { _id: new Types.ObjectId(sessionId) },
      { $set: { revoked: true, revokedAt: new Date() } },
    );
  }

  async revokeAllForUser(userId: string, userType: UserType): Promise<void> {
    await this.sessionModel.updateMany(
      { userId, userType, revoked: false },
      { $set: { revoked: true, revokedAt: new Date() } },
    );
  }

  async listActiveForUser(
    userId: string,
    userType: UserType,
  ): Promise<SessionPayload[]> {
    const docs = await this.sessionModel.find({
      userId,
      userType,
      revoked: false,
      expiresAt: { $gt: new Date() },
    });

    return docs.map((doc) => this.toPayload(doc));
  }

  private toPayload(doc: SessionDocument): SessionPayload {
    return {
      sessionId: (doc._id as Types.ObjectId).toHexString(),
      userId: doc.userId,
      userType: doc.userType,
      expiresAt: doc.expiresAt,
      lastSeenAt: doc.lastSeenAt,
      revoked: doc.revoked,
    };
  }
}
