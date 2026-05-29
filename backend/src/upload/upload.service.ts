import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "node:crypto";

export type PresignedUpload = {
  uploadUrl: string;
  objectKey: string;
  expiresIn: number;
};

@Injectable()
export class UploadService {
  private readonly log = new Logger(UploadService.name);
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly prefix: string;
  private readonly ttlSeconds: number;

  constructor(cs: ConfigService) {
    // No explicit credentials — the SDK picks up the EC2 IAM Role via IMDS v2.
    // Locally, AWS_PROFILE or static creds via the standard chain still work.
    this.client = new S3Client({ region: cs.getOrThrow<string>("S3_REGION") });
    this.bucket = cs.getOrThrow<string>("S3_BUCKET");
    this.prefix = (cs.get<string>("S3_KEY_PREFIX") ?? "reports/").replace(/^\/?|\/?$/g, "");
    this.ttlSeconds = Number(cs.get<string>("S3_PRESIGN_TTL_SECONDS") ?? 300);
  }

  /**
   * Mint a single-use PUT URL. The browser PUTs the file body directly to
   * S3 with the matching Content-Type / Content-Length; bytes never touch
   * this server. The returned objectKey is what the SPA later attaches to
   * `business_reports.image_url`.
   *
   * We disambiguate the key with a UUID so duplicate filenames don't
   * overwrite each other. Sanitising the filename in the DTO already
   * blocks `..` / slashes; the UUID is defence-in-depth.
   */
  async presignPut(input: {
    userId: string;
    filename: string;
    contentType: string;
    contentLength: number;
  }): Promise<PresignedUpload> {
    const objectKey = `${this.prefix}/${input.userId}/${randomUUID()}-${input.filename}`;
    const cmd = new PutObjectCommand({
      Bucket: this.bucket,
      Key: objectKey,
      ContentType: input.contentType,
      ContentLength: input.contentLength,
    });
    const uploadUrl = await getSignedUrl(this.client, cmd, { expiresIn: this.ttlSeconds });
    this.log.debug?.(`presigned PUT ${objectKey} (${input.contentLength}B)`);
    return { uploadUrl, objectKey, expiresIn: this.ttlSeconds };
  }
}
