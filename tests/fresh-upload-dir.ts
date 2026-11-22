// Must be imported before the Keystone context: points local storage at a folder that does not exist yet.
import { tmpdir } from 'node:os'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
delete process.env.S3_BUCKET_NAME
process.env.UPLOAD_DIR = path.join(tmpdir(), `recycling-uploads-${randomUUID()}`, 'not-yet-created')
