import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type {
  PutObjectInput,
  StorageAdapter,
  StoredObject,
} from "@/storage/storage-adapter";
import { assertStorageKey } from "@/storage/storage-adapter";

type S3Options = {
  endpoint?: string;
  region: string;
  bucket: string;
  accessKey: string;
  secretKey: string;
  forcePathStyle: boolean;
};
export class S3StorageAdapter implements StorageAdapter {
  readonly driver = "s3" as const;
  private readonly client: S3Client;
  constructor(private readonly options: S3Options) {
    this.client = new S3Client({
      endpoint: options.endpoint || undefined,
      region: options.region,
      forcePathStyle: options.forcePathStyle,
      credentials: {
        accessKeyId: options.accessKey,
        secretAccessKey: options.secretKey,
      },
    });
  }
  async put(input: PutObjectInput) {
    assertStorageKey(input.key);
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.options.bucket,
        Key: input.key,
        Body: input.body,
        ContentType: input.contentType,
        ContentDisposition: input.contentDisposition,
        CacheControl:
          input.visibility === "public"
            ? "public, max-age=31536000, immutable"
            : "private, no-store",
      }),
    );
  }
  async get(key: string): Promise<StoredObject | null> {
    assertStorageKey(key);
    try {
      const result = await this.client.send(
        new GetObjectCommand({ Bucket: this.options.bucket, Key: key }),
      );
      if (!result.Body) return null;
      return {
        body: await result.Body.transformToByteArray(),
        contentType: result.ContentType ?? "application/octet-stream",
        contentLength: result.ContentLength,
        contentDisposition: result.ContentDisposition,
      };
    } catch (error) {
      const status = (error as { $metadata?: { httpStatusCode?: number } })
        .$metadata?.httpStatusCode;
      if (status === 404) return null;
      throw error;
    }
  }
  async delete(key: string) {
    assertStorageKey(key);
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.options.bucket, Key: key }),
    );
  }
  async exists(key: string) {
    assertStorageKey(key);
    try {
      await this.client.send(
        new HeadObjectCommand({ Bucket: this.options.bucket, Key: key }),
      );
      return true;
    } catch (error) {
      if (
        (error as { $metadata?: { httpStatusCode?: number } }).$metadata
          ?.httpStatusCode === 404
      )
        return false;
      throw error;
    }
  }
  async list(prefix: string) {
    if (prefix) assertStorageKey(prefix);
    const keys: string[] = [];
    let token: string | undefined;
    do {
      const result = await this.client.send(
        new ListObjectsV2Command({
          Bucket: this.options.bucket,
          Prefix: prefix,
          ContinuationToken: token,
        }),
      );
      keys.push(...(result.Contents ?? []).flatMap(({ Key }) => Key ?? []));
      token = result.IsTruncated ? result.NextContinuationToken : undefined;
    } while (token);
    return keys;
  }
  async signedUrl(key: string, expiresInSeconds: number) {
    assertStorageKey(key);
    return getSignedUrl(
      this.client,
      new GetObjectCommand({ Bucket: this.options.bucket, Key: key }),
      { expiresIn: Math.min(3600, Math.max(60, expiresInSeconds)) },
    );
  }
}
