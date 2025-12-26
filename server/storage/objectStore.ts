import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";

let s3Client: S3Client | null = null;

function getS3Client(): S3Client {
  if (!s3Client) {
    const endpoint = process.env.R2_ENDPOINT;
    const accessKeyId = process.env.R2_ACCESS_KEY_ID;
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

    if (!endpoint || !accessKeyId || !secretAccessKey) {
      throw new Error("Object storage not configured: Missing R2_ENDPOINT, R2_ACCESS_KEY_ID, or R2_SECRET_ACCESS_KEY");
    }

    s3Client = new S3Client({
      region: "auto",
      endpoint,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });
  }
  return s3Client;
}

export function isObjectStorageConfigured(): boolean {
  return !!(
    process.env.R2_ENDPOINT &&
    process.env.R2_ACCESS_KEY_ID &&
    process.env.R2_SECRET_ACCESS_KEY &&
    process.env.R2_BUCKET
  );
}

export async function putObject(
  key: string,
  buffer: Buffer,
  contentType: string
): Promise<string> {
  const client = getS3Client();
  const bucket = process.env.R2_BUCKET;
  const publicBaseUrl = process.env.R2_PUBLIC_BASE_URL;

  if (!bucket) {
    throw new Error("Object storage not configured: Missing R2_BUCKET");
  }

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    })
  );

  if (publicBaseUrl) {
    return `${publicBaseUrl.replace(/\/$/, "")}/${key}`;
  }
  
  return `https://${bucket}.r2.dev/${key}`;
}

export async function deleteObject(key: string): Promise<void> {
  const client = getS3Client();
  const bucket = process.env.R2_BUCKET;

  if (!bucket) {
    throw new Error("Object storage not configured: Missing R2_BUCKET");
  }

  await client.send(
    new DeleteObjectCommand({
      Bucket: bucket,
      Key: key,
    })
  );
}

export function getNarrationKey(
  universeId: number,
  cardId: number,
  timestamp?: number
): string {
  const ts = timestamp || Date.now();
  return `narration/${universeId}/${cardId}/${ts}.mp3`;
}

export function extractKeyFromUrl(url: string): string | null {
  const match = url.match(/narration\/\d+\/\d+\/\d+\.mp3/);
  return match ? match[0] : null;
}
