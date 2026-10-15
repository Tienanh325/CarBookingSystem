import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "../config/env";
import { ApiError } from "../utils/api-error";

const configured = Boolean(
  env.objectStorageEndpoint && env.objectStorageAccessKey && env.objectStorageSecretKey
);
const client = configured
  ? new S3Client({
      endpoint: env.objectStorageEndpoint,
      region: env.objectStorageRegion,
      forcePathStyle: env.objectStorageForcePathStyle,
      credentials: {
        accessKeyId: env.objectStorageAccessKey!,
        secretAccessKey: env.objectStorageSecretKey!
      }
    })
  : null;

function storage() {
  if (!client) throw new ApiError(503, "OBJECT_STORAGE_NOT_CONFIGURED", "Object storage chua duoc cau hinh");
  return client;
}

export async function signedUploadUrl(key: string, contentType: string, _contentLength: number) {
  return getSignedUrl(
    storage(),
    new PutObjectCommand({
      Bucket: env.objectStorageBucket,
      Key: key,
      ContentType: contentType
    }),
    { expiresIn: 15 * 60 }
  );
}

export async function signedDownloadUrl(key: string) {
  return getSignedUrl(storage(), new GetObjectCommand({ Bucket: env.objectStorageBucket, Key: key }), {
    expiresIn: 5 * 60
  });
}

export function storageReference(key: string) {
  return `s3://${env.objectStorageBucket}/${key}`;
}
