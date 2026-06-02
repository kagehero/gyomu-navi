import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createWriteStream } from "node:fs";
import { mkdir, stat } from "node:fs/promises";
import { join, normalize, relative, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import type { Request } from "express";
import { signUploadToken, verifyUploadToken } from "./upload-token";

export type PresignedUpload = {
  uploadUrl: string;
  objectKey: string;
  expiresIn: number;
};

type UploadMode = "s3" | "local";

@Injectable()
export class UploadService {
  private readonly log = new Logger(UploadService.name);
  private readonly mode: UploadMode;
  private readonly client: S3Client | null;
  private readonly bucket: string;
  private readonly prefix: string;
  private readonly ttlSeconds: number;
  private readonly localRoot: string;
  private readonly publicBaseUrl: string;
  private readonly jwtSecret: string;

  constructor(cs: ConfigService) {
    this.mode = resolveUploadMode(cs);
    this.bucket = cs.get<string>("S3_BUCKET") ?? "gyomu-navi-local-placeholder";
    this.prefix = (cs.get<string>("S3_KEY_PREFIX") ?? "reports/").replace(/^\/?|\/?$/g, "");
    this.ttlSeconds = Number(cs.get<string>("S3_PRESIGN_TTL_SECONDS") ?? 300);
    this.localRoot = resolve(cs.get<string>("UPLOAD_LOCAL_DIR") ?? join(process.cwd(), ".uploads"));
    const port = cs.get<string>("PORT") ?? "3001";
    this.publicBaseUrl = (cs.get<string>("BACKEND_PUBLIC_URL") ?? `http://localhost:${port}`).replace(
      /\/$/,
      "",
    );
    this.jwtSecret = cs.getOrThrow<string>("JWT_SECRET");

    if (this.mode === "s3") {
      this.client = new S3Client({ region: cs.getOrThrow<string>("S3_REGION") });
      this.log.log("upload storage: S3");
    } else {
      this.client = null;
      this.log.warn(`upload storage: local (${this.localRoot}) — set AWS credentials or UPLOAD_STORAGE=s3 for S3`);
    }
  }

  isLocalStorage(): boolean {
    return this.mode === "local";
  }

  /**
   * Mint a single-use PUT URL. The browser PUTs the file body directly to
   * S3 with the matching Content-Type / Content-Length; bytes never touch
   * this server. The returned objectKey is what the SPA later attaches to
   * `business_reports.image_url`.
   */
  async presignPut(input: {
    userId: string;
    filename: string;
    contentType: string;
    contentLength: number;
  }): Promise<PresignedUpload> {
    const objectKey = `${this.prefix}/${input.userId}/${randomUUID()}-${input.filename}`;

    if (this.mode === "local") {
      const exp = Date.now() + this.ttlSeconds * 1000;
      const token = signUploadToken(
        {
          objectKey,
          contentType: input.contentType,
          contentLength: input.contentLength,
          userId: input.userId,
          exp,
        },
        this.jwtSecret,
      );
      const uploadUrl = `${this.publicBaseUrl}/api/uploads/local/${token}`;
      this.log.debug(`local upload ${objectKey} (${input.contentLength}B)`);
      return { uploadUrl, objectKey, expiresIn: this.ttlSeconds };
    }

    if (!this.client) {
      throw new ServiceUnavailableException(
        "画像アップロードは未設定です。S3 の認証情報を設定してください。",
      );
    }

    const cmd = new PutObjectCommand({
      Bucket: this.bucket,
      Key: objectKey,
      ContentType: input.contentType,
      ContentLength: input.contentLength,
    });
    try {
      const uploadUrl = await getSignedUrl(this.client, cmd, { expiresIn: this.ttlSeconds });
      this.log.debug(`presigned PUT ${objectKey} (${input.contentLength}B)`);
      return { uploadUrl, objectKey, expiresIn: this.ttlSeconds };
    } catch (err) {
      this.log.error("S3 presign failed", err instanceof Error ? err.stack : err);
      throw new ServiceUnavailableException(
        "画像アップロードは未設定です。S3 の認証情報を設定してください。",
      );
    }
  }

  async completeLocalUpload(token: string, req: Request, contentType: string): Promise<void> {
    if (this.mode !== "local") {
      throw new BadRequestException("ローカルアップロードは無効です");
    }
    const payload = verifyUploadToken(token, this.jwtSecret);
    if (!payload) {
      throw new BadRequestException("アップロード URL が無効または期限切れです");
    }
    if (payload.contentType !== contentType) {
      throw new BadRequestException("Content-Type が一致しません");
    }

    const filePath = this.localFilePath(payload.objectKey);
    if (!filePath) {
      throw new BadRequestException("不正なアップロード先です");
    }
    await mkdir(join(filePath, ".."), { recursive: true });

    await new Promise<void>((resolvePromise, reject) => {
      let received = 0;
      const out = createWriteStream(filePath);
      req.on("data", (chunk: Buffer) => {
        received += chunk.length;
        if (received > payload.contentLength) {
          req.destroy();
          out.destroy();
          reject(new BadRequestException("ファイルサイズが大きすぎます"));
          return;
        }
        out.write(chunk);
      });
      req.on("end", () => {
        out.end();
      });
      req.on("error", reject);
      out.on("finish", () => {
        if (received !== payload.contentLength) {
          reject(new BadRequestException("ファイルサイズが一致しません"));
          return;
        }
        resolvePromise();
      });
      out.on("error", reject);
    });
    this.log.debug(`saved local upload ${payload.objectKey}`);
  }

  localFilePath(objectKey: string): string | null {
    if (!objectKey || isFullUrl(objectKey)) return null;
    const normalizedKey = objectKey.replace(/\\/g, "/").replace(/^\/+/, "");
    if (normalizedKey.includes("..")) return null;
    const abs = resolve(this.localRoot, normalizedKey);
    const rel = relative(this.localRoot, abs);
    if (rel.startsWith("..") || normalize(rel).startsWith("..")) return null;
    return abs;
  }

  async localFileExists(objectKey: string): Promise<boolean> {
    const filePath = this.localFilePath(objectKey);
    if (!filePath) return false;
    try {
      const info = await stat(filePath);
      return info.isFile();
    } catch {
      return false;
    }
  }

  /**
   * Mint a short-lived GET URL for a stored object. The reports image proxy
   * uses this to 302-redirect the `<img>` request straight to S3.
   */
  async presignGet(objectKey: string): Promise<string> {
    if (!this.client) {
      throw new ServiceUnavailableException("画像の取得に失敗しました");
    }
    const cmd = new GetObjectCommand({ Bucket: this.bucket, Key: objectKey });
    return getSignedUrl(this.client, cmd, { expiresIn: this.ttlSeconds });
  }
}

function isFullUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

function resolveUploadMode(cs: ConfigService): UploadMode {
  const explicit = cs.get<string>("UPLOAD_STORAGE")?.toLowerCase();
  if (explicit === "s3") return "s3";
  if (explicit === "local") return "local";
  if (process.env.NODE_ENV === "production") return "s3";
  if (process.env.AWS_ACCESS_KEY_ID || process.env.AWS_PROFILE) return "s3";
  return "local";
}
