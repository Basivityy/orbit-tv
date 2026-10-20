import { prisma } from "@/lib/db";
import { requirePageUser } from "@/lib/auth";
import { ActionButton, AdminForm, Card, Input, SubmitButton } from "@/components/admin/Form";
import { createUserAction, deleteUserAction, updateUserAction } from "../../actions";

export const metadata = { title: "Users" };

const ROLE_HELP = { OWNER: "Everything incl. user management", ADMIN: "Tools, SEO, content, ads, redirects, logs", EDITOR: "SEO and content only", VIEWER: "Read-only dashboard" };

export default async function UsersPage() {
  const me = await requirePageUser("manageUsers");
  const users = await prisma.adminUser.findMany({ orderBy: { createdAt: "asc" } });
  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">Users & permissions</h1>
      <ul className="text-muted grid gap-1 text-xs sm:grid-cols-2">{Object.entries(ROLE_HELP).map(([r, h]) => <li key={r}><strong className="text-[var(--text)]">{r}</strong>: {h}</li>)}</ul>
      <Card title="Add user">
        <AdminForm action={createUserAction} resetOnSuccess>
              <div className="grid gap-3 sm:grid-cols-2">
                <Input label="Name" name="name" required />
                <Input label="Email" name="email" type="email" required />
                <Input label="Initial password" name="password" type="password" hint="12+ characters, 3 character types. Share it securely." required />
                <label className="block"><span className="label">Role</span><select className="field" name="role" defaultValue="EDITOR"><option>VIEWER</option><option>EDITOR</option><option>ADMIN</option><option>OWNER</option></select></label>
              </div>
              <div className="mt-3"><SubmitButton>Create user</SubmitButton></div>
        </AdminForm>
      </Card>
      {users.map((u) => (
        <Card key={u.id} title={`${u.name} ${u.id === me.id ? "(you)" : ""}`} description={`${u.email} · last login ${u.lastLoginAt ? u.lastLoginAt.toISOString().slice(0, 16).replace("T", " ") : "never"}${u.lockedUntil && u.lockedUntil > new Date() ? " · LOCKED" : ""}`}
          actions={u.id !== me.id ? <ActionButton action={deleteUserAction} fields={{ id: u.id }} label="Delete" variant="danger" confirm={`Delete ${u.email}?`} /> : undefined}>
          <AdminForm action={updateUserAction}>
            <input type="hidden" name="id" value={u.id} />
            <div className="grid items-end gap-3 sm:grid-cols-[160px_1fr_auto]">
              <label className="block"><span className="label">Role</span><select className="field" name="role" defaultValue={u.role}><option>VIEWER</option><option>EDITOR</option><option>ADMIN</option><option>OWNER</option></select></label>
              <Input label="Reset password (optional)" name="password" type="password" />
              <label className="flex items-center gap-2 pb-2 text-sm"><input type="checkbox" name="active" defaultChecked={u.active} className="accent-brand-600" /> Active</label>
            </div>
            <div className="mt-3"><SubmitButton variant="secondary">Update</SubmitButton></div>
          </AdminForm>
        </Card>
      ))}
    </div>
  );
}
