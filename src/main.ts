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

  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.KAFKA,
    options: {
      client: {
        clientId: 'hrm-ats',
        brokers: [configService.get<string>('KAFKA_BROKER')!],
      },
      consumer: {
        groupId: 'hrm-ats-consumer-group',
        rebalanceTimeout: 300000, // 5 minutes — matches sessionTimeout
        heartbeatInterval: 10000,
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
