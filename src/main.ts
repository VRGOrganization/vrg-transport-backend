import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { json, urlencoded, type Request, type Response, type NextFunction } from 'express';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: false, // Desativa o body parser automático — gerenciamos manualmente abaixo
  });
  const configService = app.get(ConfigService);
  const logger = new Logger('Bootstrap');

  // ── Segurança e hardening
  const trustProxy = configService.get<number>('TRUST_PROXY_HOPS', 1);
  app.set('trust proxy', trustProxy);
  app.disable('x-powered-by');

  // ── Limite de body — antes de qualquer outro middleware
  // json() e urlencoded() para requisições normais.
  // multipart/form-data (uploads) é tratado pelo multer nos controllers.
  app.use(json({ limit: '2mb' }));
  app.use(urlencoded({ extended: true, limit: '2mb' }));
  app.use(cookieParser());

  // ── Helmet — headers HTTP defensivos
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'same-site' },
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true,
      },
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'https:'],
          connectSrc: ["'self'"],
          fontSrc: ["'self'"],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'"],
          frameSrc: ["'none'"],
        },
      },
    }),
  );

  app.use((_: Request, res: Response, next: NextFunction) => {
    res.setHeader(
      'Permissions-Policy',
      'camera=(), microphone=(), geolocation=(), payment=(), usb=(), vr=()',
    );
    next();
  });

  // ── CORS
  const allowedOrigins = configService
    .getOrThrow<string>('ALLOWED_ORIGINS')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.enableCors({
    origin: allowedOrigins,
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
    allowedHeaders: [
      'Content-Type',
      'x-session-id',
      'x-service-secret',
      'x-sse-ticket', // necessário para o endpoint de SSE de eventos
    ],
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
        enableImplicitConversion: false,
      },
      validationError: {
        target: false,
        value: false,
      },
    }),
  );

  // ── Exception filter global
  app.useGlobalFilters(new HttpExceptionFilter());

  // ── Swagger — apenas em desenvolvimento com ENABLE_SWAGGER=true
  const enableSwagger = configService.get<string>('ENABLE_SWAGGER') === 'true';
  const isProduction = configService.get<string>('NODE_ENV') === 'production';

  if (enableSwagger && !isProduction) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('VRG Transport API')
      .setDescription(
        'Documentação da API de gestão de transporte e carteirinhas',
      )
      .setVersion('1.0')
      .addApiKey(
        {
          type: 'apiKey',
          name: 'x-session-id',
          in: 'header',
          description: 'Sessao ativa gerenciada pelo BFF.',
        },
        'x-session-id',
      )
      .addApiKey(
        {
          type: 'apiKey',
          name: 'x-service-secret',
          in: 'header',
          description: 'Segredo compartilhado entre BFF e backend (somente /auth).',
        },
        'x-service-secret',
      )
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