import { requirePageUser } from "@/lib/auth";
import { AdminForm, Card, Input, SubmitButton } from "@/components/admin/Form";
import { changeOwnPasswordAction } from "../../actions";

export const metadata = { title: "Account" };

export default async function AccountPage() {
  const user = await requirePageUser();
  return (
    <div className="max-w-lg space-y-5">
      <h1 className="text-2xl font-bold">Your account</h1>
      <p className="text-muted text-sm">{user.name} · {user.email} · {user.role}</p>
      <Card title="Change password">
        <AdminForm action={changeOwnPasswordAction} resetOnSuccess>
          <div className="space-y-3">
            <Input label="Current password" name="current" type="password" required />
            <Input label="New password" name="next" type="password" hint="At least 12 characters with 3 of: lowercase, uppercase, digits, symbols." required />
            <Input label="Confirm new password" name="confirm" type="password" required />
          </div>
          <div className="mt-4"><SubmitButton>Change password</SubmitButton></div>
        </AdminForm>
      </Card>
    </div>
  );
}
