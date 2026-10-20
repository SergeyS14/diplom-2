import './load-env';
import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

function corsOrigins(): boolean | string[] {
  const raw = process.env.CORS_ORIGIN;
  if (!raw || raw === '*') {
    return true;
  }
  return raw.split(',').map((item) => item.trim());
}

async function bootstrap() {
  const origins = corsOrigins();
  const app = await NestFactory.create(AppModule, {
    cors: { origin: origins, credentials: true },
  });

  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ whitelist: false, transform: true }));

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);

  const logger = new Logger('Bootstrap');
  logger.log(`API http://localhost:${port}  WS /socket.io`);
}

bootstrap();
