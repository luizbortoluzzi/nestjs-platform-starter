/**
 * Local development seed script.
 *
 * Creates a small set of predictable users and projects so developers can
 * explore the API without registering accounts manually.
 *
 * Run:  npm run seed
 *
 * Idempotent — skips seeding if the admin account already exists.
 * Safe to re-run after a fresh `make reset` + `npm run migration:run`.
 *
 * Credentials:
 *   admin@example.com / Admin1234!   (role: admin)
 *   alice@example.com / Alice1234!   (role: user, 3 projects)
 *   bob@example.com   / Bob12345!    (role: user, 1 project)
 */

import * as bcrypt from 'bcryptjs';

import { ProjectEntity, ProjectStatus } from '../../../modules/projects/entities/project.entity';
import { UserEntity, UserRole } from '../../../modules/users/entities/user.entity';
import dataSource from '../typeorm.config';

async function seed(): Promise<void> {
  await dataSource.initialize();
  console.log('✓ Connected to database');

  const userRepo = dataSource.getRepository(UserEntity);
  const projectRepo = dataSource.getRepository(ProjectEntity);

  const existing = await userRepo.findOne({ where: { email: 'admin@example.com' } });
  if (existing) {
    console.log('Seed data already present — skipping. Run `make reset` first to reseed.');
    await dataSource.destroy();
    return;
  }

  // ─── Users ─────────────────────────────────────────────────────────────────
  const [adminHash, aliceHash, bobHash] = await Promise.all([
    bcrypt.hash('Admin1234!', 12),
    bcrypt.hash('Alice1234!', 12),
    bcrypt.hash('Bob12345!', 12),
  ]);

  const admin = await userRepo.save(
    userRepo.create({
      email: 'admin@example.com',
      passwordHash: adminHash,
      name: 'Platform Admin',
      role: UserRole.ADMIN,
    }),
  );

  const alice = await userRepo.save(
    userRepo.create({ email: 'alice@example.com', passwordHash: aliceHash, name: 'Alice Smith' }),
  );

  const bob = await userRepo.save(
    userRepo.create({ email: 'bob@example.com', passwordHash: bobHash, name: 'Bob Jones' }),
  );

  // ─── Projects ───────────────────────────────────────────────────────────────
  await projectRepo.save([
    projectRepo.create({
      name: 'Website Redesign',
      description: 'Redesign the company marketing site.',
      ownerId: alice.id,
    }),
    projectRepo.create({
      name: 'Mobile App MVP',
      description: 'Build the first version of the mobile app.',
      ownerId: alice.id,
    }),
    projectRepo.create({
      name: 'API Integration',
      description: 'Integrate with the payment provider.',
      status: ProjectStatus.ARCHIVED,
      ownerId: alice.id,
    }),
    projectRepo.create({
      name: 'Internal Tooling',
      description: 'Admin dashboard for ops team.',
      ownerId: bob.id,
    }),
  ]);

  console.log('✓ Seeded users:');
  console.log(`    admin@example.com  / Admin1234!  (${admin.id})`);
  console.log(`    alice@example.com  / Alice1234!  (${alice.id})`);
  console.log(`    bob@example.com    / Bob12345!   (${bob.id})`);
  console.log('✓ Seeded 4 projects');

  await dataSource.destroy();
}

seed().catch((err: Error) => {
  console.error('Seed failed:', err.message);
  process.exit(1);
});
