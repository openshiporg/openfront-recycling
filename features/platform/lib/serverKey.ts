import { randomUUID } from 'node:crypto';

/** A fresh idempotency key for one server-side command call; the parts make it readable in receipts. */
export function newServerKey(...parts: string[]) {
  return `${parts.filter(Boolean).join(':').slice(0, 120)}:${randomUUID()}`;
}
