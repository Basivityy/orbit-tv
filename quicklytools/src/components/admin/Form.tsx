"use client";

import { useActionState, useEffect, useRef, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";
import type { ActionState } from "@/lib/admin-action";

type Action = (prev: ActionState, form: FormData) => Promise<ActionState>;

export function SubmitButton({ children, variant = "primary", className = "", confirm }: { children: ReactNode; variant?: "primary" | "secondary" | "danger" | "ghost"; className?: string; confirm?: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      className={`btn btn-${variant} ${className}`}
      disabled={pending}
      onClick={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
    >
      {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
}

export function StatusMessage({ state }: { state: ActionState }) {
  if (!state.message) return null;
  return (
    <div role="status" className={`text-sm ${state.ok ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
      <p className="flex items-center gap-1.5">
        {state.ok ? <CheckCircle2 className="h-4 w-4" aria-hidden /> : <AlertTriangle className="h-4 w-4" aria-hidden />}
        {state.message}
      </p>
      {state.fieldErrors && (
        <ul className="mt-1 list-disc pl-6 text-xs">
          {Object.entries(state.fieldErrors).map(([k, v]) => (
            <li key={k}>
              {k}: {v}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Form bound to a server action with inline status. Refreshes server data on success. */
export function AdminForm({
  action, children, className = "", resetOnSuccess, onResult,
}: {
  action: Action; children: ReactNode | ((state: ActionState) => ReactNode); className?: string; resetOnSuccess?: boolean; onResult?: (s: ActionState) => void;
}) {
  const [state, formAction] = useActionState(action, { ok: false, message: "" });
  const ref = useRef<HTMLFormElement>(null);
  const router = useRouter();
  useEffect(() => {
    if (!state.message) return;
    onResult?.(state);
    if (state.ok) {
      if (resetOnSuccess) ref.current?.reset();
      router.refresh();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);
  return (
    <form ref={ref} action={formAction} className={className}>
      {typeof children === "function" ? children(state) : children}
      <div className="mt-3">
        <StatusMessage state={state} />
      </div>
    </form>
  );
}

/** One-button form for quick actions (toggle, delete, revert). */
export function ActionButton({ action, fields, label, variant = "secondary", confirm, small = true }: { action: Action; fields: Record<string, string>; label: ReactNode; variant?: "primary" | "secondary" | "danger" | "ghost"; confirm?: string; small?: boolean }) {
  const [state, formAction] = useActionState(action, { ok: false, message: "" });
  const router = useRouter();
  useEffect(() => {
    if (state.ok) router.refresh();
  }, [state, router]);
  return (
    <form action={formAction} className="inline-flex items-center gap-2">
      {Object.entries(fields).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <SubmitButton variant={variant} className={small ? "btn-sm" : ""} confirm={confirm}>
        {label}
      </SubmitButton>
      {!state.ok && state.message && <span className="text-xs text-red-600">{state.message}</span>}
    </form>
  );
}

export function Input({ label, name, defaultValue, hint, type = "text", placeholder, maxLength, required, error }: { label: string; name: string; defaultValue?: string | number | null; hint?: ReactNode; type?: string; placeholder?: string; maxLength?: number; required?: boolean; error?: string }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      <input className="field" name={name} type={type} defaultValue={defaultValue ?? ""} placeholder={placeholder} maxLength={maxLength} required={required} aria-invalid={!!error || undefined} />
      {error ? <span className="mt-1 block text-xs text-red-600">{error}</span> : hint ? <span className="text-muted mt-1 block text-xs">{hint}</span> : null}
    </label>
  );
}

export function TextArea({ label, name, defaultValue, hint, rows = 4, placeholder, mono }: { label: string; name: string; defaultValue?: string | null; hint?: ReactNode; rows?: number; placeholder?: string; mono?: boolean }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      <textarea className={`field ${mono ? "" : "!font-sans !text-sm"}`} name={name} rows={rows} defaultValue={defaultValue ?? ""} placeholder={placeholder} />
      {hint && <span className="text-muted mt-1 block text-xs">{hint}</span>}
    </label>
  );
}

export function Toggle({ label, name, defaultChecked, hint }: { label: string; name: string; defaultChecked?: boolean; hint?: string }) {
  return (
    <label className="flex cursor-pointer items-start gap-2.5 py-1">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} className="mt-0.5 h-4 w-4 accent-brand-600" />
      <span>
        <span className="text-sm font-medium">{label}</span>
        {hint && <span className="text-muted block text-xs">{hint}</span>}
      </span>
    </label>
  );
}

export function Card({ title, description, children, actions }: { title?: ReactNode; description?: ReactNode; children: ReactNode; actions?: ReactNode }) {
  return (
    <section className="surface rounded-2xl p-5">
      {(title || actions) && (
        <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
          <div>
            {title && <h2 className="font-semibold">{title}</h2>}
            {description && <p className="text-muted mt-0.5 text-sm">{description}</p>}
          </div>
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}
