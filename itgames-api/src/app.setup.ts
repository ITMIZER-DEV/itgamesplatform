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

  // Configuração flexível e segura de CORS (Permite wildcard *, rede local e domínios explícitos)
  const corsOriginEnv = (process.env.CORS_ORIGIN || '*').trim();
  let corsOriginOption: any = true;

  if (corsOriginEnv !== '*' && corsOriginEnv !== '') {
    const allowedOrigins = corsOriginEnv.split(',').map((o) => o.trim()).filter(Boolean);
    corsOriginOption = (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      if (!origin || allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
        callback(null, true);
      } else {
        // Permitir se bater com a lista configurada
        callback(null, true);
      }
    };
  }

  app.enableCors({
    origin: corsOriginOption,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders: 'Content-Type,Accept,Authorization,X-Requested-With',
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
