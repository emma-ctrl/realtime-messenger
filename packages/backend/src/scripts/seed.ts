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

  // Check if a thread between Alice and Bob already exists
  const existingThread = await prisma.thread.findFirst({
    where: {
      participants: {
        every: {
          userId: {
            in: [users[0].id, users[1].id] // alice and bob
          }
        }
      },
      AND: [
        {
          participants: {
            some: { userId: users[0].id } // has alice
          }
        },
        {
          participants: {
            some: { userId: users[1].id } // has bob
          }
        }
      ]
    },
    include: {
      messages: true
    }
  })

  let thread = existingThread
  
  if (!existingThread) {
    // Create thread only if it doesn't exist
    thread = await prisma.thread.create({
      data: {
        participants: {
          create: [
            { userId: users[0].id }, // alice
            { userId: users[1].id }, // bob
          ]
        }
      },
      include: {
        messages: true
      }
    })
    console.log('✅ Created new thread between Alice & Bob')
  } else {
    console.log('✅ Found existing thread between Alice & Bob')
  }

  // Only create the seeder message if it doesn't already exist
  const existingSeederMessage = await prisma.message.findFirst({
    where: {
      content: "Hey Bob! This is a test message from the seeder.",
      senderId: users[0].id,
      threadId: thread!.id
    }
  })

  if (!existingSeederMessage) {
    const message = await prisma.message.create({
      data: {
        content: "Hey Bob! This is a test message from the seeder.",
        senderId: users[0].id, // alice
        threadId: thread!.id,
      }
    })
    console.log('✅ Created seeder message')
  } else {
    console.log('✅ Seeder message already exists')
  }

  console.log('✅ Sample thread and message ready:')
  console.log(`   - Thread ${thread!.id} with Alice & Bob`)
  console.log(`   - Seeder message: "Hey Bob! This is a test message from the seeder."`)
  
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