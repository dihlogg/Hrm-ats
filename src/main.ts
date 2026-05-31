import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Transport, MicroserviceOptions } from '@nestjs/microservices';
import { ConfigService } from '@nestjs/config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  app.enableCors({
    origin: true,
    credentials: true,
  });
  app.useGlobalPipes(new ValidationPipe({ transform: true }));
  app.enableShutdownHooks();

  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.KAFKA,
    options: {
      client: {
        clientId: 'hrm-ats',
        brokers: [configService.get<string>('KAFKA_BROKER')!],
      },
      consumer: {
        groupId: 'hrm-ats-consumer-group',
        sessionTimeout: 60000,
        rebalanceTimeout: 90000,
        heartbeatInterval: 3000,
      },
    },
  });

  const config = new DocumentBuilder()
    .setTitle('HRM ATS API')
    .setDescription('HRM Management API')
    .setVersion('1.0')
    .addTag('Hrm Tool')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  await app.startAllMicroservices();
  await app.listen(process.env.PORT ?? 3004);
}
bootstrap();
