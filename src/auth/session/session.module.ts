import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule } from '@nestjs/config';
import { Session, SessionSchema } from './session.schema';
import { MongoSessionStore } from './mongo-session.store';
import { SESSION_STORE } from './session-store.interface';
import { SessionService } from './session.service';

/**
 * HOW TO SWAP TO REDIS (quando estiver pronto):
 *
 * 1. Adicione no providers:
 *    {
 *      provide: REDIS_CLIENT,
 *      useFactory: () => new Redis(process.env.REDIS_URL),
 *    }
 *
 * 2. Troque a linha SESSION_STORE provider:
 *    { provide: SESSION_STORE, useClass: RedisSessionStore }
 *
 * 3. Remova o MongooseModule.forFeature abaixo (sessions no Mongo não serão mais usadas).
 *
 * O resto do sistema não muda — guards, services, BFF continuam iguais.
 */

@Module({
  imports: [
    ConfigModule,
    MongooseModule.forFeature([
      { name: Session.name, schema: SessionSchema },
    ]),
  ],
  providers: [
    // Store concreta: MongoDB agora, Redis depois (hot-swap via esta linha)
    {
      provide: SESSION_STORE,
      useClass: MongoSessionStore,
    },
    SessionService,
  ],
  exports: [SessionService],
})
export class SessionModule {}