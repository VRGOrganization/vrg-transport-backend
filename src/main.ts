import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { json } from 'express';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const configService = app.get(ConfigService);
  const logger = new Logger('Bootstrap');

  // ── Segurança e hardening
  // Configurações de segurança e hardening da aplicação.
  const trustProxy = configService.get<number>('TRUST_PROXY_HOPS', 1);
  app.set('trust proxy', trustProxy);
  app.disable('x-powered-by');

  // ── Limite de body — antes de qualquer outro middleware
  // Bloqueia na camada do body-parser antes de alocar memória para parse.
  // O @MaxLength nos DTOs é uma segunda camada, não substitui este limite.
  app.use(json({ limit: '2mb' }));
  app.use(cookieParser());

  // ── Helmet — headers HTTP defensivos
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      crossOriginOpenerPolicy: false,
    }),
  );

  // ── CORS
  // Usa getOrThrow para garantir que a variável está definida.
  // validateSecurityConfig já bloqueia wildcard na inicialização,
  // mas getOrThrow garante que a app não sobe sem a variável presente.
  const allowedOrigins = configService
    .getOrThrow<string>('ALLOWED_ORIGINS')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.enableCors({
    origin: allowedOrigins,
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  });

  // ── Prefixo global
  app.setGlobalPrefix('api/v1');

  // ── ValidationPipe global
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      forbidUnknownValues: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: false, // coerção explícita via @Transform nos DTOs
      },
      validationError: {
        target: false, // não expõe o objeto recebido no erro
        value: false, // não expõe o valor inválido no erro
      },
    }),
  );

  // ── Exception filter global
  app.useGlobalFilters(new HttpExceptionFilter());

  // ── Swagger — apenas em desenvolvimento com ENABLE_SWAGGER=true
  // Dupla proteção: variável de ambiente explícita E verificação de NODE_ENV.
  // Nunca expor em produção — documenta endpoints, schemas e exemplos.
  const enableSwagger = configService.get<string>('ENABLE_SWAGGER') === 'true';
  const isProduction = configService.get<string>('NODE_ENV') === 'production';

  if (enableSwagger && !isProduction) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('VRG Transport API')
      .setDescription(
        'Documentação da API de gestão de transporte e carteirinhas',
      )
      .setVersion('1.0')
      .addBearerAuth()
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document);
    logger.log('Swagger disponível em /api/docs (dev only)');
  }

  // ── Start
  const port = configService.get<number>('PORT', 3000);
  await app.listen(port);
  logger.log(`Aplicação rodando em: http://localhost:${port}/api/v1`);
}

bootstrap();
