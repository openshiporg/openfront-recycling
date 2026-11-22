'use client';

export function PrintButton({ label = 'Print' }: { label?: string }) {
  return (
    <button type="button" className="sf-btn sf-btn-ghost sf-btn-sm sf-noprint" onClick={() => window.print()}>
      {label}
    </button>
  );
}
