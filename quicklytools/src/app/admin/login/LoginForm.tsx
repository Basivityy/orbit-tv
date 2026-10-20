"use client";

import { useActionState } from "react";
import { loginAction } from "../actions";
import { StatusMessage, SubmitButton } from "@/components/admin/Form";

export function LoginForm() {
  const [state, action] = useActionState(loginAction, { ok: false, message: "" });
  return (
    <form action={action} className="space-y-4">
      <label className="block">
        <span className="label">Email</span>
        <input className="field" type="email" name="email" autoComplete="username" required autoFocus />
      </label>
      <label className="block">
        <span className="label">Password</span>
        <input className="field" type="password" name="password" autoComplete="current-password" required />
      </label>
      <SubmitButton className="w-full">Sign in</SubmitButton>
      <StatusMessage state={state} />
    </form>
  );
}
