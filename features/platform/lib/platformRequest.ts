import { ClientError, GraphQLClient } from 'graphql-request';
import { getAuthHeaders } from '@/features/dashboard/lib/cookies';
import { getGraphQLEndpoint } from '@/features/dashboard/lib/getBaseUrl';

/**
 * Server-side GraphQL call for platform screens. Unlike the shared dashboard client it keeps the
 * messages the commands write for staff (COMMAND_REFUSED, FORBIDDEN, NOT_FOUND) and Keystone's own
 * validation and access messages, so a refused action says why. Anything else stays generic.
 */
export type PlatformResult<T> = { ok: true; data: T } | { ok: false; error: string };

export const GENERIC_ERROR = 'This couldn’t be done. Check the fields and try again.';

const STAFF_CODES = new Set(['COMMAND_REFUSED', 'FORBIDDEN', 'NOT_FOUND', 'CONFLICT', 'BAD_USER_INPUT']);
const UNSAFE_DETAIL = /prisma|invocation|\bat\s+\S+\s*\(|\bat\s+\/|node_modules|postgres(ql)?:\/\/|\bSQL\b|ECONN|query engine|\.ts:\d+|\.js:\d+/i;

function readable(error: unknown): string {
  if (!(error instanceof ClientError)) return GENERIC_ERROR;
  return readableErrors(error.response.errors || []);
}

function readableErrors(errors: any[]): string {
  const out: string[] = [];
  for (const entry of errors) {
    const code = String(entry?.extensions?.code || '');
    const message = String(entry?.message || '');
    if (code === 'KS_VALIDATION_FAILURE') {
      out.push(...message.split('\n').slice(1).map((line) => line.replace(/^\s*-\s*/, '').replace(/^[\w.]+:\s*/, '').trim()).filter(Boolean));
    } else if (code === 'KS_ACCESS_DENIED') {
      out.push('Your role doesn’t allow this.');
    } else if (STAFF_CODES.has(code) && message && message.length < 400 && !UNSAFE_DETAIL.test(message)) {
      out.push(code === 'BAD_USER_INPUT' ? 'Some fields are not valid.' : message);
    }
  }
  return [...new Set(out)].join(' ') || GENERIC_ERROR;
}

export async function platformRequest<T>(query: string, variables: Record<string, unknown> = {}): Promise<PlatformResult<T>> {
  try {
    const client = new GraphQLClient(await getGraphQLEndpoint(), { headers: (await getAuthHeaders()) || {}, redirect: 'error' });
    return { ok: true, data: await client.request<T>(query, variables) };
  } catch (error) {
    return { ok: false, error: readable(error) };
  }
}

/**
 * A GraphQL multipart request (one file per variable path), for photos and signatures.
 * `files` maps a variable path such as "data.image.upload" to the file.
 */
export async function platformUpload<T>(query: string, variables: Record<string, unknown>, files: Record<string, File>): Promise<PlatformResult<T>> {
  try {
    const form = new FormData();
    const map: Record<string, string[]> = {};
    Object.keys(files).forEach((path, i) => { map[String(i)] = [`variables.${path}`]; });
    form.append('operations', JSON.stringify({ query, variables }));
    form.append('map', JSON.stringify(map));
    Object.values(files).forEach((file, i) => form.append(String(i), file, file.name || `upload-${i}`));
    const res = await fetch(await getGraphQLEndpoint(), {
      method: 'POST',
      body: form,
      headers: { ...((await getAuthHeaders()) || {}), 'apollo-require-preflight': 'true' },
      redirect: 'error',
      cache: 'no-store',
    });
    const json = await res.json().catch(() => null);
    if (!json) return { ok: false, error: GENERIC_ERROR };
    if (json.errors?.length) return { ok: false, error: readableErrors(json.errors) };
    return { ok: true, data: json.data as T };
  } catch {
    return { ok: false, error: GENERIC_ERROR };
  }
}

export const trimmed = (value: unknown, max = 500) => (typeof value === 'string' ? value.trim().slice(0, max) : '');

/** A fresh idempotency key for one press of a button. */
export const newKey = (prefix: string) => `${prefix}:${crypto.randomUUID()}`;

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

export function formImage(form: FormData, field: string): File | { error: string } | null {
  const file = form.get(field);
  if (!(file instanceof File) || !file.size) return null;
  if (!/^image\/(jpeg|png|webp|gif|avif|heic|heif)$/.test(file.type)) return { error: 'Use a JPG, PNG, WebP, GIF or AVIF image.' };
  if (file.size > MAX_IMAGE_BYTES) return { error: 'Images must be 8 MB or smaller.' };
  return file;
}
