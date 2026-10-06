import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as express from 'express';
import { mkdirSync } from 'fs';
import { join } from 'path';
import { getUploadsDir } from './common/utils/uploads';
import { LgpdMaskInterceptor } from './common/interceptors/lgpd-mask.interceptor';

export function configureApp(app: INestApplication): void {
  // Limite maior para fotos de súmulas em base64
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  // Imagens enviadas (banners dos campeonatos)
  const uploadsDir = getUploadsDir();
  mkdirSync(join(uploadsDir, 'banners'), { recursive: true });
  app.use(
    '/uploads',
    express.static(uploadsDir, {
      index: false,
      maxAge: '7d',
      setHeaders: (res) => res.setHeader('X-Content-Type-Options', 'nosniff'),
    }),
  );

  // CORS por lista explícita de origens (CORS_ORIGIN separado por vírgula)
  const origins = (process.env.CORS_ORIGIN || '')
    .split(',')
    .map((o) => o.trim())
    .filter((o) => o && o !== '*');
  app.enableCors({
    origin: origins.length > 0 ? origins : false,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  app.useGlobalInterceptors(new LgpdMaskInterceptor());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
    }),
  );
}
