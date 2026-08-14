import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  CreateBucketCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  DeleteObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

export interface StorageService {
  checkHealth(): Promise<void>;
  putObject(input: { key: string; body: Buffer; contentType?: string }): Promise<void>;
  getObject(key: string): Promise<Buffer>;
  deleteObject(key: string): Promise<void>;
}

export const STORAGE_SERVICE = Symbol("STORAGE_SERVICE");

async function streamToBuffer(stream: unknown): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream as AsyncIterable<Buffer | string>) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

@Injectable()
export class S3StorageService implements StorageService, OnModuleInit {
  private readonly logger = new Logger(S3StorageService.name);
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(private readonly configService: ConfigService) {
    const endpoint = this.configService.get<string>("STORAGE_ENDPOINT");
    const region = this.configService.get<string>("STORAGE_REGION") ?? "us-east-1";
    const accessKeyId = this.configService.get<string>("STORAGE_ACCESS_KEY_ID");
    const secretAccessKey = this.configService.get<string>("STORAGE_SECRET_ACCESS_KEY");
    const forcePathStyle = this.configService.get<string>("STORAGE_FORCE_PATH_STYLE") !== "false";
    this.bucket = this.configService.get<string>("STORAGE_BUCKET") ?? "spicytrack-artifacts";

    if (!endpoint || !accessKeyId || !secretAccessKey) {
      throw new Error(
        "STORAGE_ENDPOINT, STORAGE_ACCESS_KEY_ID and STORAGE_SECRET_ACCESS_KEY are required",
      );
    }

    this.client = new S3Client({
      endpoint,
      region,
      credentials: { accessKeyId, secretAccessKey },
      forcePathStyle,
    });
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
    } catch {
      try {
        await this.client.send(new CreateBucketCommand({ Bucket: this.bucket }));
      } catch (error) {
        this.logger.warn(
          `Could not ensure storage bucket "${this.bucket}" exists yet: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }
  }

  async checkHealth(): Promise<void> {
    await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
  }

  async putObject(input: { key: string; body: Buffer; contentType?: string }): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: input.key,
        Body: input.body,
        ContentType: input.contentType,
      }),
    );
  }

  async getObject(key: string): Promise<Buffer> {
    const response = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
    );
    return streamToBuffer(response.Body);
  }

  async deleteObject(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }
}
