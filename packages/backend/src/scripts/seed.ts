/**
 * Database Seeder - Creates hardcoded users for development
 * Run with: npm run db:seed --workspace=packages/backend
 */

import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Starting database seed...')

  // Hash password for security (even in development)
  const hashedPassword = await bcrypt.hash('password123', 10)

  // Create hardcoded users as specified in requirements
  const users = await Promise.all([
    prisma.user.upsert({
      where: { username: 'alice' },
      update: {},
      create: {
        username: 'alice',
        password: hashedPassword,
      },
    }),
    prisma.user.upsert({
      where: { username: 'bob' },
      update: {},
      create: {
        username: 'bob', 
        password: hashedPassword,
      },
    }),
    prisma.user.upsert({
      where: { username: 'charlie' },
      update: {},
      create: {
        username: 'charlie',
        password: hashedPassword,
      },
    }),
  ])

  console.log('✅ Created users:')
  users.forEach(user => {
    console.log(`   - ${user.username} (id: ${user.id})`)
  })

  // Test creating a sample thread and message
  const thread = await prisma.thread.create({
    data: {
      participants: {
        create: [
          { userId: users[0].id }, // alice
          { userId: users[1].id }, // bob
        ]
      }
    }
  })

  const message = await prisma.message.create({
    data: {
      content: "Hey Bob! This is a test message from the seeder.",
      senderId: users[0].id, // alice
      threadId: thread.id,
    }
  })

  console.log('✅ Created sample thread and message:')
  console.log(`   - Thread ${thread.id} with Alice & Bob`)
  console.log(`   - Message: "${message.content}"`)
  
  console.log('🎉 Database seeded successfully!')
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })