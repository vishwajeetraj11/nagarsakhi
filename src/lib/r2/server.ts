import "server-only";

import {
  DeleteObjectsCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
  type ObjectIdentifier,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { getRuntimeEnv } from "@/lib/supabase";

const getR2Config = () => {
  const env = getRuntimeEnv();
  if (!env.hasR2Configuration) return null;
  return env.r2 as Required<typeof env.r2>;
};

let client: S3Client | null = null;

const getClient = () => {
  const config = getR2Config();
  if (!config) return null;
  client ??= new S3Client({
    region: "auto",
    endpoint: config.endpoint,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });
  return { client, config };
};

export const isR2Configured = () => Boolean(getR2Config());

export async function createR2UploadUrl(input: {
  key: string;
  contentType: string;
  expiresIn?: number;
}) {
  const configured = getClient();
  if (!configured) return null;
  const command = new PutObjectCommand({
    Bucket: configured.config.bucketName,
    Key: input.key,
    ContentType: input.contentType,
  });
  return getSignedUrl(configured.client, command, { expiresIn: input.expiresIn ?? 300 });
}

export async function createR2DownloadUrl(key: string, expiresIn = 600) {
  const configured = getClient();
  if (!configured) return null;
  const command = new GetObjectCommand({ Bucket: configured.config.bucketName, Key: key });
  return getSignedUrl(configured.client, command, { expiresIn });
}

export async function deleteR2Objects(keys: string[]) {
  const configured = getClient();
  if (!configured || keys.length === 0) return configured ? true : null;
  const objects: ObjectIdentifier[] = keys.map((key) => ({ Key: key }));
  const response = await configured.client.send(new DeleteObjectsCommand({
    Bucket: configured.config.bucketName,
    Delete: { Objects: objects, Quiet: true },
  }));
  return !response.Errors?.length;
}
