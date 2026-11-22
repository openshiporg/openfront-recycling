import { cookies, headers } from 'next/headers';

/**
 * The storefront's one GraphQL transport. Server-side only; it forwards the visitor's own session cookie,
 * so every custom operation proves ownership against the signed-in user. Never raw list CRUD for
 * transactional lists.
 */

export type GqlResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; code: string | null; unauthenticated: boolean; notFound: boolean };

const GENERIC = 'Something went wrong on our side. Please try again in a moment.';

// Codes whose messages are written for the person using the site (command refusals, Keystone validation).
const USER_CODES = new Set(['COMMAND_REFUSED', 'BAD_USER_INPUT', 'NOT_FOUND', 'FORBIDDEN', 'UNAUTHENTICATED', 'KS_VALIDATION_FAILURE', 'KS_USER_INPUT_ERROR', 'KS_ACCESS_DENIED', 'KS_EXTENSION_ERROR']);
// Database, driver or stack output never reaches the page.
const UNSAFE = /prisma|invocation|\bat\s+\S+\s*\(|\bat\s+\/|node_modules|postgres(ql)?:\/\/|\bSQL\b|ECONN|query engine|\.ts:\d+|\.js:\d+|Cannot query field|Unknown argument|Unknown type/i;

function cleanMessage(message: string) {
  const text = message.replace(/^\s*-\s*\w+(\.\w+)+:\s*/gm, '').trim();
  if (!text || text.length > 400 || UNSAFE.test(text)) return null;
  return text;
}

export async function graphqlEndpoint() {
  const h = await headers();
  const host = h.get('x-forwarded-host') || h.get('host');
  const proto = h.get('x-forwarded-proto') || (host?.startsWith('localhost') || host?.startsWith('127.') ? 'http' : 'https');
  return host ? `${proto}://${host}/api/graphql` : '/api/graphql';
}

export async function sessionCookieHeader(token?: string): Promise<Record<string, string>> {
  const value = token ?? (await cookies()).get('keystonejs-session')?.value;
  return value ? { Cookie: `keystonejs-session=${value}` } : {};
}

function hasFile(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  if (value instanceof File) return true;
  return Object.values(value as Record<string, unknown>).some(hasFile);
}

function multipart(query: string, variables: Record<string, unknown>) {
  const files: File[] = [];
  const map: Record<string, string[]> = {};
  const walk = (value: any, path: string): any => {
    if (value instanceof File) {
      files.push(value);
      map[String(files.length)] = [`variables.${path}`];
      return null;
    }
    if (Array.isArray(value)) return value.map((v, i) => walk(v, `${path}.${i}`));
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, walk(v, path ? `${path}.${k}` : k)]));
    return value;
  };
  const vars = walk(variables, '');
  const body = new FormData();
  body.append('operations', JSON.stringify({ query, variables: vars }));
  body.append('map', JSON.stringify(map));
  files.forEach((f, i) => body.append(String(i + 1), f));
  return body;
}

export async function gql<T = any>(query: string, variables: Record<string, unknown> = {}, opts: { token?: string } = {}): Promise<GqlResult<T>> {
  try {
    const endpoint = await graphqlEndpoint();
    const auth = await sessionCookieHeader(opts.token);
    const upload = hasFile(variables);
    const res = await fetch(endpoint, {
      method: 'POST',
      cache: 'no-store',
      redirect: 'error',
      headers: upload ? { ...auth, 'apollo-require-preflight': 'true' } : { ...auth, 'Content-Type': 'application/json' },
      body: upload ? multipart(query, variables) : JSON.stringify({ query, variables }),
    });
    const json: any = await res.json().catch(() => null);
    if (!json) return { ok: false, error: GENERIC, code: null, unauthenticated: false, notFound: false };
    if (Array.isArray(json.errors) && json.errors.length) {
      const first = json.errors[0];
      const code: string | null = first?.extensions?.code ?? null;
      const messages = json.errors
        .filter((e: any) => USER_CODES.has(e?.extensions?.code))
        .map((e: any) => cleanMessage(String(e?.message || '')))
        .filter(Boolean);
      if (!USER_CODES.has(code || '')) console.error('storefront graphql error', code, String(first?.message || '').slice(0, 160));
      return {
        ok: false,
        error: messages.length ? [...new Set(messages)].join(' ') : GENERIC,
        code,
        unauthenticated: code === 'UNAUTHENTICATED',
        notFound: code === 'NOT_FOUND',
      };
    }
    return { ok: true, data: json.data as T };
  } catch (error) {
    console.error('storefront graphql request failed', (error as Error)?.name);
    return { ok: false, error: GENERIC, code: null, unauthenticated: false, notFound: false };
  }
}
