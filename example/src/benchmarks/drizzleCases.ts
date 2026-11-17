import { and, desc, eq, lt, sql } from 'drizzle-orm'
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import type { NitroSQLiteConnection } from 'react-native-nitro-sqlite'
import { drizzle } from 'react-native-nitro-sqlite-drizzle'
import type { BenchmarkCase } from './runner'
import { createChatCases, type ChatClient } from './chatCases'
import { INBOX_SIZE, PAGE_SIZE } from './chatData'

const users = sqliteTable('users', {
  id: integer('id').primaryKey(),
  name: text('name').notNull(),
  avatarUrl: text('avatar_url'),
})
const conversations = sqliteTable('conversations', {
  id: integer('id').primaryKey(),
  title: text('title').notNull(),
  lastMessageId: text('last_message_id'),
  unreadCount: integer('unread_count').notNull(),
  updatedAt: integer('updated_at').notNull(),
})
const messages = sqliteTable('messages', {
  id: text('id').primaryKey(),
  conversationId: integer('conversation_id').notNull(),
  authorId: integer('author_id').notNull(),
  body: text('body').notNull(),
  sentAt: integer('sent_at').notNull(),
  editedAt: integer('edited_at'),
  reactions: text('reactions'),
})

// The chat workloads again, written with Drizzle's query builder.
export const drizzleCases: BenchmarkCase[] = createChatCases(
  'drizzle-chat',
  'Drizzle chat',
  drizzleClient,
)

function drizzleClient(connection: NitroSQLiteConnection): ChatClient {
  const db = drizzle(connection)
  return {
    inbox: () =>
      db
        .select({
          id: conversations.id,
          title: conversations.title,
          unreadCount: conversations.unreadCount,
          lastBody: messages.body,
          lastSentAt: messages.sentAt,
          lastAuthor: users.name,
        })
        .from(conversations)
        .leftJoin(messages, eq(messages.id, conversations.lastMessageId))
        .leftJoin(users, eq(users.id, messages.authorId))
        .orderBy(desc(conversations.updatedAt))
        .limit(INBOX_SIZE),
    page: (conversationId, before) =>
      db
        .select({
          id: messages.id,
          authorName: users.name,
          body: messages.body,
          sentAt: messages.sentAt,
          editedAt: messages.editedAt,
          reactions: messages.reactions,
        })
        .from(messages)
        .innerJoin(users, eq(users.id, messages.authorId))
        .where(
          and(
            eq(messages.conversationId, conversationId),
            lt(messages.sentAt, before),
          ),
        )
        .orderBy(desc(messages.sentAt))
        .limit(PAGE_SIZE),
    markRead: async (conversationId) => {
      await db
        .update(conversations)
        .set({ unreadCount: 0 })
        .where(eq(conversations.id, conversationId))
    },
    sync: (payload) =>
      db.transaction(async (tx) => {
        for (const message of payload.messages) {
          await tx
            .insert(messages)
            .values(message)
            .onConflictDoUpdate({
              target: messages.id,
              set: {
                body: sql`excluded.body`,
                editedAt: sql`excluded.edited_at`,
                reactions: sql`excluded.reactions`,
              },
            })
        }
        for (const conversation of payload.conversations) {
          await tx
            .update(conversations)
            .set({
              lastMessageId: conversation.lastMessageId,
              updatedAt: conversation.updatedAt,
              unreadCount: sql`${conversations.unreadCount} + ${conversation.newMessages}`,
            })
            .where(eq(conversations.id, conversation.id))
        }
      }),
  }
}
