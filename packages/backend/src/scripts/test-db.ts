/**
 * Manual Database Test Script
 * Run with: npx tsx src/scripts/test-db.ts
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function testDatabase() {
  console.log('🔍 Testing database connection and data...\n')

  try {
    // Test 1: Connection and user count
    const userCount = await prisma.user.count()
    console.log(`✅ Connection successful! Found ${userCount} users`)

    // Test 2: List all users
    const users = await prisma.user.findMany({
      select: { id: true, username: true, createdAt: true }
    })
    console.log('\n📋 All users:')
    users.forEach(user => {
      console.log(`   - ID: ${user.id}, Username: ${user.username}, Created: ${user.createdAt.toISOString()}`)
    })

    // Test 3: Get threads with participants
    const threadsWithParticipants = await prisma.thread.findMany({
      include: {
        participants: {
          include: {
            user: { select: { username: true } }
          }
        },
        messages: {
          include: {
            sender: { select: { username: true } }
          },
          orderBy: { createdAt: 'asc' }
        }
      }
    })

    console.log('\n💬 All threads:')
    threadsWithParticipants.forEach(thread => {
      const participantNames = thread.participants.map(p => p.user.username).join(', ')
      console.log(`   - Thread ${thread.id}: [${participantNames}]`)
      
      thread.messages.forEach(message => {
        console.log(`     📝 ${message.sender.username}: "${message.content}"`)
      })
    })

    // Test 4: Create a new message to verify write operations
    const testMessage = await prisma.message.create({
      data: {
        content: 'Test message from manual verification script!',
        senderId: users[1].id, // Bob
        threadId: threadsWithParticipants[0].id,
      },
      include: {
        sender: { select: { username: true } }
      }
    })

    console.log(`\n✍️  Created test message: "${testMessage.content}" by ${testMessage.sender.username}`)

    console.log('\n🎉 All database tests passed!')

  } catch (error) {
    console.error('❌ Database test failed:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

testDatabase()