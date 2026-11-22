import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { s3ForcePathStyle } from './s3-storage'

/**
 * File and image storage (dissertation §10). S3-compatible storage when the S3_* variables are set,
 * as E-commerce does it; otherwise files go to the server's disk, so taking a photo works on a fresh
 * deployment with no extra setting.
 *
 * - `my_images`: public images (materials, containers, campaigns, logos), served by /api/uploads.
 * - `private_images` / `private_files`: ID documents, seller and material photos, signatures,
 *   W-9s, reports. Never public: on disk they are served only by /api/private-files, which checks
 *   the session; on S3 they are signed URLs that expire after five minutes and are only returned
 *   to users whose list access lets them read the field.
 */
export const LOCAL_UPLOAD_ROOT = process.env.UPLOAD_DIR || path.join(process.cwd(), '.runtime', 'uploads')

export function s3Configured(env = process.env) {
  return Boolean(env.S3_BUCKET_NAME && env.S3_ACCESS_KEY_ID && env.S3_SECRET_ACCESS_KEY && env.S3_REGION)
}

function s3(type: 'image' | 'file', prefix: string, signed: boolean) {
  const endpoint = process.env.S3_ENDPOINT || undefined
  return {
    kind: 's3' as const,
    type,
    bucketName: process.env.S3_BUCKET_NAME!,
    region: process.env.S3_REGION!,
    accessKeyId: process.env.S3_ACCESS_KEY_ID,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
    endpoint,
    pathPrefix: prefix,
    ...(signed ? { signed: { expiry: 300 } } : { signed: { expiry: 5000 } }),
    forcePathStyle: s3ForcePathStyle(endpoint),
  }
}

/** Keystone's local adapter writes into storagePath but never creates it; a fresh disk has none. */
export function ensureLocalDir(dir: string) {
  mkdirSync(dir, { recursive: true })
  return dir
}

function local(type: 'image' | 'file', folder: string, route: string) {
  const storagePath = path.join(LOCAL_UPLOAD_ROOT, folder)
  ensureLocalDir(storagePath)
  return {
    kind: 'local' as const,
    type,
    storagePath,
    serverRoute: null,
    generateUrl: (file: string) => `${route}/${folder}${file}`,
    preserve: true,
  }
}

export function storageConfig() {
  if (s3Configured()) {
    return {
      my_images: s3('image', 'public/', false),
      private_images: s3('image', 'private/images/', true),
      private_files: s3('file', 'private/files/', true),
    }
  }
  return {
    my_images: local('image', 'public', '/api/uploads'),
    private_images: local('image', 'private-images', '/api/private-files'),
    private_files: local('file', 'private-files', '/api/private-files'),
  }
}
