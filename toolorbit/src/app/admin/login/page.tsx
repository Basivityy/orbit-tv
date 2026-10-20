import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { LogoMark } from "@/components/site/Logo";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Sign in", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (await getCurrentUser()) redirect("/admin");
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="surface w-full max-w-sm rounded-2xl p-6 shadow-xl">
        <div className="mb-6 flex items-center gap-2 font-bold">
          <LogoMark /> Admin sign in
        </div>
        <LoginForm />
      </div>
    </main>
  );
}
