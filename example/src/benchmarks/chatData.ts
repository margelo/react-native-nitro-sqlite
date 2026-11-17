import type {
  BatchQueryCommand,
  NitroSQLiteConnection,
  SQLiteQueryParams,
} from 'react-native-nitro-sqlite'
import { createAppDatabase, disposeBenchmarkDatabase } from './database'

export const INBOX_SIZE = 50
export const PAGE_SIZE = 50
export const OPENED_CONVERSATIONS = 10
export const SCROLLED_PAGES = 6
export const SEEDED_MESSAGES = 32000
export const NEW_MESSAGES = 400
export const EDITED_MESSAGES = 100
export const SETTINGS = 30
export const SCHEMA_VERSION = 3
const USERS = 200
const CONVERSATIONS = 80
const START_TIME = Date.UTC(2026, 0, 1)
// Chat text with accents, emoji, other scripts, quotes, and line breaks.
const WORDS = [
  'hey',
  'are',
  'we',
  'still',
  'on',
  'for',
  'tonight?',
  'café',
  'Grüße',
  'naïve',
  '👋',
  '🎉',
  'okay',
  'see',
  'you',
  'at',
  '7',
  'the',
  'new',
  'place',
  '"Luigi\'s"',
  'sounds',
  'good',
  'send',
  'me',
  'the',
  'link',
  'thanks!',
  'let me check\n',
  '日本',
  'привет',
  'tomorrow',
  'works',
  '😂',
  'meeting',
  'moved',
  'to',
  '3pm',
]
const FIRST_NAMES = ['Ana', 'José', 'Zoë', 'Søren', 'Mia', 'Noah', 'Aiko']
const LAST_NAMES = ['García', 'Müller', 'Smith', 'Kowalski', 'Nguyen', 'Rossi']

const CHAT_SCHEMA = [
  'CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT NOT NULL, avatar_url TEXT) STRICT',
  'CREATE TABLE conversations (id INTEGER PRIMARY KEY, title TEXT NOT NULL, last_message_id TEXT, unread_count INTEGER NOT NULL, updated_at INTEGER NOT NULL) STRICT',
  'CREATE TABLE messages (id TEXT PRIMARY KEY, conversation_id INTEGER NOT NULL, author_id INTEGER NOT NULL, body TEXT NOT NULL, sent_at INTEGER NOT NULL, edited_at INTEGER, reactions TEXT) STRICT',
  'CREATE INDEX messages_by_conversation ON messages (conversation_id, sent_at)',
  'CREATE INDEX conversations_by_activity ON conversations (updated_at)',
  'CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL) STRICT',
  `PRAGMA user_version = ${SCHEMA_VERSION}`,
]

export type ChatMessage = {
  id: string
  conversationId: number
  authorId: number
  body: string
  sentAt: number
  editedAt: number | null
  reactions: string | null
}
export type InboxRow = {
  id: number
  title: string
  unreadCount: number
  lastBody: string | null
  lastSentAt: number | null
  lastAuthor: string | null
}
export type MessageRow = {
  id: string
  authorName: string
  body: string
  sentAt: number
  editedAt: number | null
  reactions: string | null
}
export type SyncPayload = {
  messages: ChatMessage[]
  conversations: {
    id: number
    lastMessageId: string
    updatedAt: number
    newMessages: number
  }[]
}

export async function createChatDatabase(
  name: string,
): Promise<NitroSQLiteConnection> {
  const db = createAppDatabase(name, CHAT_SCHEMA)
  try {
    await db.executeBatchAsync([
      {
        query: 'INSERT INTO users VALUES (?, ?, ?)',
        params: Array.from({ length: USERS }, (_, i) => [
          i + 1,
          userName(i + 1),
          `https://cdn.example.com/avatars/${i + 1}.jpg`,
        ]),
      },
      {
        query: 'INSERT INTO conversations VALUES (?, ?, ?, ?, ?)',
        params: Array.from({ length: CONVERSATIONS }, (_, i) =>
          conversationParams(i + 1),
        ),
      },
      {
        query: 'INSERT INTO messages VALUES (?, ?, ?, ?, ?, ?, ?)',
        params: Array.from({ length: SEEDED_MESSAGES }, (_, i) =>
          messageParams(seededMessage(i)),
        ),
      },
      {
        query: 'INSERT INTO settings VALUES (?, ?)',
        params: Array.from({ length: SETTINGS }, (_, i) => [
          `setting.${i}`,
          JSON.stringify({ enabled: i % 2 === 0, value: `option-${i}` }),
        ]),
      },
    ])
    return db
  } catch (error) {
    disposeBenchmarkDatabase(db)
    throw error
  }
}

// 400 new messages spread over all conversations, plus 100 edits.
export function syncPayload(): SyncPayload {
  const created = Array.from({ length: NEW_MESSAGES }, (_, i) =>
    seededMessage(SEEDED_MESSAGES + i),
  )
  const edited = editedIndices().map((index) => {
    const message = seededMessage(index)
    return {
      ...message,
      body: `${message.body} (edited)`,
      editedAt: message.sentAt + 60000,
    }
  })
  const conversations = Array.from({ length: CONVERSATIONS }, (_, i) => {
    const latest = seededMessage(
      SEEDED_MESSAGES + NEW_MESSAGES - CONVERSATIONS + i,
    )
    return {
      id: latest.conversationId,
      lastMessageId: latest.id,
      updatedAt: latest.sentAt,
      newMessages: NEW_MESSAGES / CONVERSATIONS,
    }
  })
  return { messages: [...edited, ...created], conversations }
}

export function restoreSeedCommands(payload: SyncPayload): BatchQueryCommand[] {
  return [
    {
      query: 'DELETE FROM messages WHERE sent_at >= ?',
      params: [seededMessage(SEEDED_MESSAGES).sentAt],
    },
    {
      query: 'UPDATE messages SET body = ?, edited_at = NULL WHERE id = ?',
      params: editedIndices().map((index) => {
        const message = seededMessage(index)
        return [message.body, message.id]
      }),
    },
    {
      query:
        'UPDATE conversations SET last_message_id = ?, unread_count = ?, updated_at = ? WHERE id = ?',
      params: payload.conversations.map(({ id }) => {
        const [, , lastMessageId, unreadCount, updatedAt] =
          conversationParams(id)
        return [lastMessageId, unreadCount, updatedAt, id]
      }),
    },
  ]
}

export function expectedBrowse(): { rows: number; checksum: number } {
  let rows = 0
  let checksum = 0
  // The inbox lists the most recently active conversations first.
  for (let id = CONVERSATIONS; id > CONVERSATIONS - INBOX_SIZE; id--) {
    const last = seededMessage(latestSeededIndex(id))
    rows++
    checksum += inboxChecksum({
      id,
      title: conversationTitle(id),
      unreadCount: 0,
      lastBody: last.body,
      lastSentAt: last.sentAt,
      lastAuthor: userName(last.authorId),
    })
  }
  for (let position = 0; position < OPENED_CONVERSATIONS; position++) {
    const id = CONVERSATIONS - position
    const count = PAGE_SIZE * (position === 0 ? 1 + SCROLLED_PAGES : 1)
    for (let k = 0; k < count; k++) {
      const message = seededMessage(latestSeededIndex(id) - k * CONVERSATIONS)
      rows++
      checksum += messageChecksum({
        ...message,
        authorName: userName(message.authorId),
      })
    }
  }
  return { rows, checksum }
}

export function seededUnreadCount(): number {
  let total = 0
  for (let id = 1; id <= CONVERSATIONS; id++) total += id % 7
  return total
}

export function inboxChecksum(row: InboxRow): number {
  return (
    row.id +
    row.title.length +
    (row.lastBody?.length ?? 0) +
    (row.lastAuthor?.length ?? 0)
  )
}

export function messageChecksum(row: MessageRow): number {
  return row.body.length + row.authorName.length + (row.reactions?.length ?? 0)
}

export function messageParams(message: ChatMessage): SQLiteQueryParams {
  return [
    message.id,
    message.conversationId,
    message.authorId,
    message.body,
    message.sentAt,
    message.editedAt,
    message.reactions,
  ]
}

function conversationParams(id: number): SQLiteQueryParams {
  const last = seededMessage(latestSeededIndex(id))
  return [id, conversationTitle(id), last.id, id % 7, last.sentAt]
}

function editedIndices(): number[] {
  return Array.from(
    { length: EDITED_MESSAGES },
    (_, i) => SEEDED_MESSAGES - 1 - i * 97,
  )
}

// Messages alternate between conversations, so each conversation's newest
// seeded message is among the last CONVERSATIONS indices.
function latestSeededIndex(conversationId: number): number {
  return SEEDED_MESSAGES - CONVERSATIONS + conversationId - 1
}

function seededMessage(index: number): ChatMessage {
  return {
    id: `00000000-0000-4000-8000-${index.toString(16).padStart(12, '0')}`,
    conversationId: (index % CONVERSATIONS) + 1,
    authorId: ((index * 7) % USERS) + 1,
    body: messageBody(index),
    sentAt: START_TIME + index * 1000,
    editedAt: null,
    reactions:
      index % 5 === 0
        ? JSON.stringify({ '👍': [`u${index % USERS}`], '❤️': ['u1', 'u2'] })
        : null,
  }
}

function messageBody(index: number): string {
  const words: string[] = []
  const count = 3 + ((index * 7) % 28)
  for (let k = 0; k < count; k++) {
    words.push(WORDS[(index * 31 + k * 17) % WORDS.length] ?? '')
  }
  return words.join(' ')
}

function conversationTitle(id: number): string {
  return id % 3 === 0
    ? `Group ${id} · ${WORDS[id % WORDS.length]}`
    : userName(id + 1)
}

function userName(id: number): string {
  return `${FIRST_NAMES[id % FIRST_NAMES.length]} ${LAST_NAMES[(id * 5) % LAST_NAMES.length]}`
}
