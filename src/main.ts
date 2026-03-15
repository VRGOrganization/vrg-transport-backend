import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {

  
  const app = await NestFactory.create(AppModule);

  app.useGlobalFilters(new HttpExceptionFilter());

  // ValidationPipe global — ativa os decorators @IsString, @IsNotEmpty do DTO.
  // Sem isso, a validação do class-validator não funciona.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,       // remove campos não declarados no DTO
      forbidNonWhitelisted: true, // retorna erro se vier campo extra
      transform: true,       // converte tipos automaticamente
    }),
  );
  
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
