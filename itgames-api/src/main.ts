import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  configureApp(app);

  const config = new DocumentBuilder()
    .setTitle('ITGames Arena API')
    .setDescription('Documentação OpenAPI do Backend ITGames Arena para CrossFit, HYROX, Súmulas com Foto, Baterias e Auditoria')
    .setVersion('1.0.0')
    .addBearerAuth()
    .addTag('Scores & Súmulas')
    .addTag('Baterias & Raias')
    .addTag('Auditoria & Logs Imutáveis')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api-docs', app, document, {
    swaggerOptions: { persistAuthorization: true },
  });

  const port = process.env.PORT || 3333;
  await app.listen(port, '0.0.0.0');
  console.log(`🚀 ITGames Arena API rodando em http://0.0.0.0:${port}`);
  console.log(`📑 Swagger UI disponível em http://localhost:${port}/api-docs`);
}

bootstrap();
