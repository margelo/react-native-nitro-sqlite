import { open, type NitroSQLiteConnection } from 'react-native-nitro-sqlite'
import type { BenchmarkCase, BenchmarkFixture } from './runner'
import { assertBenchmark, disposeBenchmarkDatabase } from './database'
import {
  createChatDatabase,
  EDITED_MESSAGES,
  expectedBrowse,
  INBOX_SIZE,
  inboxChecksum,
  messageChecksum,
  messageParams,
  NEW_MESSAGES,
  OPENED_CONVERSATIONS,
  PAGE_SIZE,
  restoreSeedCommands,
  SCHEMA_VERSION,
  SCROLLED_PAGES,
  SEEDED_MESSAGES,
  seededUnreadCount,
  SETTINGS,
  syncPayload,
  type InboxRow,
  type MessageRow,
  type SyncPayload,
} from './chatData'

const LAUNCHES = 20
const LAUNCH_DATABASE = 'benchmark_chat_launch'
const INBOX_SQL = `SELECT c.id, c.title, c.unread_count AS unreadCount, m.body AS lastBody, m.sent_at AS lastSentAt, u.name AS lastAuthor
FROM conversations c
LEFT JOIN messages m ON m.id = c.last_message_id
LEFT JOIN users u ON u.id = m.author_id
ORDER BY c.updated_at DESC LIMIT ${INBOX_SIZE}`
const PAGE_SQL = `SELECT m.id, u.name AS authorName, m.body, m.sent_at AS sentAt, m.edited_at AS editedAt, m.reactions
FROM messages m JOIN users u ON u.id = m.author_id
WHERE m.conversation_id = ? AND m.sent_at < ?
ORDER BY m.sent_at DESC LIMIT ${PAGE_SIZE}`
const MARK_READ_SQL = 'UPDATE conversations SET unread_count = 0 WHERE id = ?'
const UPSERT_MESSAGE_SQL = `INSERT INTO messages (id, conversation_id, author_id, body, sent_at, edited_at, reactions)
VALUES (?, ?, ?, ?, ?, ?, ?)
ON CONFLICT (id) DO UPDATE SET body = excluded.body, edited_at = excluded.edited_at, reactions = excluded.reactions`
const UPDATE_CONVERSATION_SQL =
  'UPDATE conversations SET last_message_id = ?, updated_at = ?, unread_count = unread_count + ? WHERE id = ?'

/** The queries behind a chat app's screens, so raw SQL and ORM clients do the same work. */
export interface ChatClient {
  inbox(): Promise<InboxRow[]>
  page(conversationId: number, before: number): Promise<MessageRow[]>
  markRead(conversationId: number): Promise<void>
  sync(payload: SyncPayload): Promise<void>
}

export const chatCases: BenchmarkCase[] = [
  ...createChatCases('chat', 'Chat', sqlClient),
  {
    id: 'chat-launch',
    label: 'Chat · 20 launches: open, check schema, load inbox',
    setup: setupLaunch,
  },
]

export function createChatCases(
  id: string,
  label: string,
  createClient: (db: NitroSQLiteConnection) => ChatClient,
): BenchmarkCase[] {
  return [
    {
      id: `${id}-sync`,
      label: `${label} · store 500 synced messages in a transaction`,
      setup: () => setupSync(`benchmark_${id}_sync`, createClient),
    },
    {
      id: `${id}-browse`,
      label: `${label} · open inbox and 10 chats, scroll back 6 pages`,
      setup: () => setupBrowse(`benchmark_${id}_browse`, createClient),
    },
  ]
}

function sqlClient(db: NitroSQLiteConnection): ChatClient {
  return {
    inbox: async () => (await db.executeAsync<InboxRow>(INBOX_SQL)).rows._array,
    page: async (conversationId, before) =>
      (await db.executeAsync<MessageRow>(PAGE_SQL, [conversationId, before]))
        .rows._array,
    markRead: async (conversationId) => {
      await db.executeAsync(MARK_READ_SQL, [conversationId])
    },
    sync: (payload) =>
      db.transaction(async (tx) => {
        for (const message of payload.messages) {
          await tx.executeAsync(UPSERT_MESSAGE_SQL, messageParams(message))
        }
        for (const conversation of payload.conversations) {
          await tx.executeAsync(UPDATE_CONVERSATION_SQL, [
            conversation.lastMessageId,
            conversation.updatedAt,
            conversation.newMessages,
            conversation.id,
          ])
        }
      }),
  }
}

async function setupSync(
  name: string,
  createClient: (db: NitroSQLiteConnection) => ChatClient,
): Promise<BenchmarkFixture> {
  const db = await createChatDatabase(name)
  try {
    const client = createClient(db)
    const payload = syncPayload()
    const restore = restoreSeedCommands(payload)
    return {
      database: db,
      reset: () => {
        db.executeBatch(restore)
      },
      run: () => client.sync(payload),
      verify: () => {
        const row = db
          .execute<{ messages: number; edited: number; unread: number }>(
            `SELECT (SELECT COUNT(*) FROM messages) AS messages,
              (SELECT COUNT(*) FROM messages WHERE edited_at IS NOT NULL) AS edited,
              (SELECT SUM(unread_count) FROM conversations) AS unread`,
          )
          .rows.item(0)
        assertBenchmark(
          row?.messages === SEEDED_MESSAGES + NEW_MESSAGES,
          'Wrong synced message count',
        )
        assertBenchmark(row.edited === EDITED_MESSAGES, 'Wrong edited count')
        assertBenchmark(
          row.unread === seededUnreadCount() + NEW_MESSAGES,
          'Wrong unread count',
        )
      },
      dispose: () => disposeBenchmarkDatabase(db),
    }
  } catch (error) {
    disposeBenchmarkDatabase(db)
    throw error
  }
}

async function setupBrowse(
  name: string,
  createClient: (db: NitroSQLiteConnection) => ChatClient,
): Promise<BenchmarkFixture> {
  const db = await createChatDatabase(name)
  try {
    const client = createClient(db)
    const expected = expectedBrowse()
    let result = { rows: 0, checksum: 0 }
    return {
      database: db,
      run: async () => {
        result = await browse(client)
      },
      verify: () => {
        assertBenchmark(result.rows === expected.rows, 'Wrong browsed rows')
        assertBenchmark(
          result.checksum === expected.checksum,
          'Wrong browsed row checksum',
        )
      },
      dispose: () => disposeBenchmarkDatabase(db),
    }
  } catch (error) {
    disposeBenchmarkDatabase(db)
    throw error
  }
}

async function setupLaunch(): Promise<BenchmarkFixture> {
  let db = await createChatDatabase(LAUNCH_DATABASE)
  const expected = LAUNCHES * (SETTINGS + INBOX_SIZE + seededUnreadCount())
  let checksum = 0
  return {
    get database() {
      return db
    },
    run: async () => {
      checksum = 0
      for (let launch = 0; launch < LAUNCHES; launch++) {
        db.close()
        db = open({ name: LAUNCH_DATABASE })
        checksum += await loadFirstScreen(db)
      }
    },
    verify: () => assertBenchmark(checksum === expected, 'Wrong launch data'),
    dispose: () => disposeBenchmarkDatabase(db),
  }
}

async function browse(
  client: ChatClient,
): Promise<{ rows: number; checksum: number }> {
  const inbox = await client.inbox()
  let rows = inbox.length
  let checksum = 0
  for (const conversation of inbox) checksum += inboxChecksum(conversation)

  for (const [position, conversation] of inbox
    .slice(0, OPENED_CONVERSATIONS)
    .entries()) {
    let before = Number.MAX_SAFE_INTEGER
    const pages = position === 0 ? 1 + SCROLLED_PAGES : 1
    for (let page = 0; page < pages; page++) {
      const messages = await client.page(conversation.id, before)
      rows += messages.length
      for (const message of messages) checksum += messageChecksum(message)
      before = messages[messages.length - 1]?.sentAt ?? 0
    }
    await client.markRead(conversation.id)
  }
  return { rows, checksum }
}

// The statements an app runs before its first screen.
async function loadFirstScreen(db: NitroSQLiteConnection): Promise<number> {
  db.execute('PRAGMA journal_mode = WAL')
  db.execute('PRAGMA synchronous = NORMAL')
  const version = db
    .execute<{ user_version: number }>('PRAGMA user_version')
    .rows.item(0)?.user_version
  assertBenchmark(version === SCHEMA_VERSION, 'Wrong schema version')
  const settings = db.execute<{ key: string; value: string }>(
    'SELECT key, value FROM settings',
  ).rows._array
  const inbox = (await db.executeAsync<InboxRow>(INBOX_SQL)).rows._array
  const badge = (
    await db.executeAsync<{ unread: number }>(
      'SELECT SUM(unread_count) AS unread FROM conversations',
    )
  ).rows.item(0)
  return settings.length + inbox.length + (badge?.unread ?? 0)
}
