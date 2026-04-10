import { Injectable, Logger } from '@nestjs/common';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class MinioService {
  private readonly logger = new Logger(MinioService.name);
  private readonly s3Client: S3Client;
  private readonly bucketName = process.env.MINIO_BUCKET_NAME || 'hrm-ats';

  constructor() {
    const accessKeyId =
      process.env.MINIO_ACCESS_KEY || process.env.MINIO_ROOT_USER;
    const secretAccessKey =
      process.env.MINIO_SECRET_KEY || process.env.MINIO_ROOT_PASSWORD;

    if (!accessKeyId || !secretAccessKey) {
      throw new Error(
        'Missing MinIO credentials. Define MINIO_ACCESS_KEY/MINIO_SECRET_KEY or MINIO_ROOT_USER/MINIO_ROOT_PASSWORD',
      );
    }

    this.s3Client = new S3Client({
      region: process.env.AWS_REGION || 'us-east-1',
      endpoint: process.env.MINIO_ENDPOINT,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
      forcePathStyle: true,
    });
  }

  async generatePresignedUrl(
    fileName: string,
    contentType: string,
  ): Promise<{ url: string; storageKey: string }> {
    const fileExtension = fileName.split('.').pop();
    const storageKey = `cvs/${uuidv4()}.${fileExtension}`;

    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: storageKey,
      ContentType: contentType,
    });

    const url = await getSignedUrl(this.s3Client, command, { expiresIn: 900 });

    return { url, storageKey };
  }

  async getFileBuffer(storageKey: string): Promise<Buffer> {
    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: storageKey,
    });

    const response = await this.s3Client.send(command);

    // Convert stream to buffer
    const stream = response.Body as any;
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }
}
