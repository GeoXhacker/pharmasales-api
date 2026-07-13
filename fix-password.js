const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function fix() {
  const hash = bcrypt.hashSync('password123', 10);
  console.log('New hash:', hash);
  const updated = await prisma.user.updateMany({
    where: { email: 'admin@pharmasales.com' },
    data: { passwordHash: hash }
  });
  console.log('Updated users:', updated.count);
}
fix().then(() => process.exit(0));
