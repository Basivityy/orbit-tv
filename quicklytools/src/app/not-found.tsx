import Link from "next/link";
import { LogoMark } from "@/components/site/Logo";

export const metadata = { title: "Page not found", robots: { index: false, follow: true } };

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-[70vh] max-w-xl flex-col items-center justify-center px-4 text-center">
      <LogoMark className="h-12 w-12" />
      <p className="mt-6 text-sm font-semibold tracking-widest text-brand-600 uppercase">404</p>
      <h1 className="mt-2 text-3xl font-extrabold tracking-tight">This page doesn’t exist</h1>
      <p className="text-muted mt-3">The page you&apos;re looking for doesn&apos;t exist or has moved. Try searching our tools instead.</p>
      <div className="mt-6 flex gap-3">
        <Link href="/" className="btn btn-primary">Go home</Link>
        <Link href="/tools" className="btn btn-secondary">Browse all tools</Link>
      </div>
    </main>
  );
}
