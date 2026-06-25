import { Injectable, Logger } from '@nestjs/common';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class MinioService {
  private readonly logger = new Logger(MinioService.name);
  private readonly s3Client: S3Client;        // Internal (Docker network)
  private readonly s3PublicClient: S3Client;  // Public (presigned URLs)
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

    // Internal S3Client (for operations within Docker network)
    this.s3Client = new S3Client({
      region: process.env.AWS_REGION || 'us-east-1',
      endpoint: process.env.MINIO_ENDPOINT,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
      forcePathStyle: true,
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED',
    });

    // Public S3Client (for presigned URL generation - with correct public host)
    this.s3PublicClient = new S3Client({
      region: process.env.AWS_REGION || 'us-east-1',
      endpoint: process.env.MINIO_PUBLIC_ENDPOINT || 'https://api.ltdhrm.me',
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
      forcePathStyle: true,
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED',
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

    // Use PUBLIC S3Client for presigned URL generation
    // Signature will be valid for https://api.ltdhrm.me
    const url = await getSignedUrl(this.s3PublicClient, command, { expiresIn: 900 });

    return { url, storageKey };
  }

  async generateDownloadPresignedUrl(
    storageKey: string,
    expiresIn = 900,
  ): Promise<{ url: string }> {
    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: storageKey,
    });

    // Use PUBLIC S3Client for presigned URL generation
    const url = await getSignedUrl(this.s3PublicClient, command, { expiresIn });

    return { url };
  }

  async fileExists(storageKey: string): Promise<boolean> {
    try {
      // Use INTERNAL S3Client for file operations (Docker network)
      await this.s3Client.send(
        new HeadObjectCommand({
          Bucket: this.bucketName,
          Key: storageKey,
        }),
      );
      return true;
    } catch (error: any) {
      if (
        error.name === 'NotFound' ||
        error.$metadata?.httpStatusCode === 404
      ) {
        return false;
      }
      throw error;
    }
  }

  async getFileBuffer(storageKey: string): Promise<Buffer> {
    // Use INTERNAL S3Client for file operations (Docker network)
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
