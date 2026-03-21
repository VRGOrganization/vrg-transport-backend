import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  //Segurança

  //Helmet define headers HTTP defensivos (XSS protection, noSniff, etc.)
  app.use(helmet());

  //CORS — restrinja origins em produção via env
  app.enableCors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') ?? '*',
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  });

  //Prefixo global de API
  app.setGlobalPrefix('api/v1');

  //Pipes
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,            // remove campos não declarados no DTO
      forbidNonWhitelisted: true, // erro se vier campo extra
      transform: true,            // converte tipos automaticamente (string → number etc.)
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  //Filters
  app.useGlobalFilters(new HttpExceptionFilter());

  
  //Start server
  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(`Aplicação rodando em: http://localhost:${port}/api/v1`);
}

bootstrap();
