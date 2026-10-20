/**
 * Creates (or resets) an administrator account.
 *
 *   Interactive:      npm run admin:create
 *   Non-interactive:  ADMIN_EMAIL=... ADMIN_NAME=... ADMIN_PASSWORD=... ADMIN_ROLE=OWNER npm run admin:create -- --yes
 *
 * Credentials are never stored in code or environment files by this script.
 */
import { createInterface } from "node:readline";
import { PrismaClient, type Role } from "@prisma/client";
import { hashPassword, validatePasswordStrength } from "../src/lib/password";

const prisma = new PrismaClient();

function ask(question: string, hidden = false): Promise<string> {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    if (hidden) {
      const out = rl as unknown as { _writeToOutput: (s: string) => void; output: NodeJS.WriteStream };
      out._writeToOutput = (s: string) => {
        if (s.includes(question)) out.output.write(s);
        else out.output.write("*");
      };
    }
    rl.question(question, (a) => {
      rl.close();
      if (hidden) process.stdout.write("\n");
      resolve(a.trim());
    });
  });
}

async function main() {
  const nonInteractive = process.argv.includes("--yes");
  const email = (process.env.ADMIN_EMAIL || (nonInteractive ? "" : await ask("Admin email: "))).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("A valid email is required.");
  const name = process.env.ADMIN_NAME || (nonInteractive ? "Administrator" : (await ask("Display name [Administrator]: ")) || "Administrator");
  const role = (process.env.ADMIN_ROLE || "OWNER").toUpperCase() as Role;
  if (!["OWNER", "ADMIN", "EDITOR", "VIEWER"].includes(role)) throw new Error("ADMIN_ROLE must be OWNER, ADMIN, EDITOR or VIEWER.");
  let password = process.env.ADMIN_PASSWORD || "";
  if (!password) {
    if (nonInteractive) throw new Error("ADMIN_PASSWORD is required with --yes.");
    password = await ask("Password (12+ chars): ", true);
    const again = await ask("Repeat password: ", true);
    if (password !== again) throw new Error("Passwords do not match.");
  }
  const weak = validatePasswordStrength(password);
  if (weak) throw new Error(weak);

  const passwordHash = await hashPassword(password);
  const existing = await prisma.adminUser.findUnique({ where: { email } });
  if (existing) {
    await prisma.adminUser.update({ where: { email }, data: { passwordHash, role, active: true, failedLogins: 0, lockedUntil: null } });
    await prisma.session.deleteMany({ where: { userId: existing.id } });
    console.log(`✔ Updated existing user ${email} (role ${role}); their sessions were revoked.`);
  } else {
    await prisma.adminUser.create({ data: { email, name, role, passwordHash } });
    console.log(`✔ Created ${role} ${email}. Sign in at /admin/login`);
  }
  await prisma.auditLog.create({ data: { action: existing ? "cli.user_reset" : "cli.user_create", entity: "user", entityId: email } });
}

main()
  .catch((e) => {
    console.error("✖", e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
