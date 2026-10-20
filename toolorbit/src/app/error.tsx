"use client";

import { useEffect } from "react";
import { reportClientError } from "@/lib/client-errors";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => reportClientError(error, "page"), [error]);
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center px-4 text-center">
      <h1 className="text-2xl font-bold">Something went wrong</h1>
      <p className="text-muted mt-2">An unexpected error occurred. Please try again.</p>
      <button type="button" className="btn btn-primary mt-6" onClick={reset}>Try again</button>
    </main>
  );
}
