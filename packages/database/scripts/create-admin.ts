/**
 * Create (or promote) the first admin for a real install.
 *
 *   npm run db:create-admin -- --email you@yourcamp.org --name "Your Name" --password 'something-long'
 *
 * If the email already exists, the member is promoted to LEAD and the
 * password is reset to the one given.
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const email = arg('email')?.trim().toLowerCase();
  const name = arg('name')?.trim();
  const password = arg('password');

  if (!email || !password) {
    console.error('Usage: npm run db:create-admin -- --email <email> --name "<name>" --password <password>');
    process.exit(1);
  }
  if (password.length < 8) {
    console.error('Password must be at least 8 characters.');
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const member = await prisma.member.upsert({
    where: { email },
    update: { role: 'LEAD', passwordHash, isActive: true, emailVerified: true },
    create: { email, name: name || email.split('@')[0], role: 'LEAD', passwordHash, emailVerified: true },
  });

  console.log(`Admin ready: ${member.email} (LEAD). Log in at /login.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
