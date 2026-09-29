/**
 * Adapted from the Onyx SQLite mock originally authored by Hubert Sosinski.
 * https://github.com/Expensify/react-native-onyx/blob/main/tests/unit/mocks/sqliteMock.ts
 * See THIRD_PARTY_NOTICES.md for the original MIT license notice.
 */
import BetterSqlite3 from 'better-sqlite3'
import type {
  BatchQueryCommand,
  NitroSQLiteConnection,
  QueryResult,
  QueryResultRow,
  SQLiteQueryParams,
  SQLiteValue,
} from './types'

type MockConnection = Pick<
  NitroSQLiteConnection,
  | 'close'
  | 'delete'
  | 'execute'
  | 'executeAsync'
  | 'executeBatch'
  | 'executeBatchAsync'
>
type Database = InstanceType<typeof BetterSqlite3>
type BoundValue = string | number | Buffer | null
type ExpandedBatchCommand = { query: string; params?: SQLiteQueryParams }

const databases = new Map<string, Database>()

/** Open a named in-memory database for Node tests. */
export function open({ name }: { name: string }): MockConnection {
  if (databases.has(name)) {
    throw new Error(`Database ${name} is already open.`)
  }

  const database = new BetterSqlite3(':memory:')
  databases.set(name, database)

  const close = () => {
    database.close()
    databases.delete(name)
  }

  const executeBatch: MockConnection['executeBatch'] = (commands) => {
    const expandedCommands = expandBatchCommands(commands)
    if (expandedCommands.length === 0) {
      throw new Error('No SQL batch commands provided')
    }

    let rowsAffected = 0
    database
      .transaction(() => {
        for (const command of expandedCommands) {
          const { statement, bindings } = prepareAndBind(
            database,
            command.query,
            command.params,
          )
          if (statement.reader) {
            statement.all(...bindings)
          } else {
            statement.run(...bindings)
          }
          if (!statement.readonly) {
            rowsAffected += getChangeCount(database)
          }
        }
      })
      .exclusive()

    return { rowsAffected }
  }

  return {
    close,
    delete: close,
    execute: (query, params) => executeQuery(database, query, params),
    executeAsync: async (query, params) =>
      executeQuery(database, query, params),
    executeBatch,
    executeBatchAsync: async (commands) => executeBatch(commands),
  }
}

export const NitroSQLite = { open }

/** Close all databases so each test can start with empty storage. */
export function resetAllDatabases(): void {
  for (const database of databases.values()) {
    database.close()
  }
  databases.clear()
}

function executeQuery<Row extends QueryResultRow>(
  database: Database,
  query: string,
  params?: SQLiteQueryParams,
): QueryResult<Row> {
  const { statement, bindings } = prepareAndBind(database, query, params)
  const results: QueryResultRow[] = []
  if (statement.reader) {
    results.push(...statement.all(...bindings).map(normalizeRow))
  } else {
    statement.run(...bindings)
  }
  const { rowsAffected, insertId } = getDatabaseChanges(database)

  // Native results are HybridObjects. The mock supplies their public data only.
  return {
    results,
    rowsAffected,
    insertId,
    rows: {
      _array: results,
      length: results.length,
      item: (index: number) => results[index],
    },
  } as QueryResult<Row>
}

function prepareAndBind(
  database: Database,
  query: string,
  params?: SQLiteQueryParams,
) {
  const statement = database.prepare<unknown[], Record<string, unknown>>(query)
  const names = extractNamedParameterOrder(query)
  if (names.length === 0) {
    return { statement, bindings: params?.map(toBoundValue) ?? [] }
  }

  const values: Record<string, BoundValue> = {}
  for (const [index, name] of names.entries()) {
    values[name] = toBoundValue(params?.[index] ?? null)
  }
  return { statement, bindings: [values] }
}

function extractNamedParameterOrder(query: string): string[] {
  const names = new Set<string>()
  let quote: string | undefined
  let lineComment = false
  let blockComment = false

  for (let index = 0; index < query.length; index++) {
    const char = query[index]
    const next = query[index + 1]

    if (lineComment) {
      if (char === '\n') lineComment = false
      continue
    }
    if (blockComment) {
      if (char === '*' && next === '/') {
        blockComment = false
        index++
      }
      continue
    }
    if (quote) {
      if (char === quote) {
        if (next === quote) index++
        else quote = undefined
      }
      continue
    }
    if (char === '-' && next === '-') {
      lineComment = true
      index++
      continue
    }
    if (char === '/' && next === '*') {
      blockComment = true
      index++
      continue
    }
    if (char === "'" || char === '"' || char === '`' || char === '[') {
      quote = char === '[' ? ']' : char
      continue
    }
    if (!char || !':@$'.includes(char) || !/[A-Za-z_]/.test(next ?? '')) {
      continue
    }

    const start = index + 1
    index = start
    while (/[A-Za-z0-9_]/.test(query[index + 1] ?? '')) {
      index++
    }
    names.add(query.slice(start, index + 1))
  }
  return [...names]
}

function expandBatchCommands(
  commands: BatchQueryCommand[],
): ExpandedBatchCommand[] {
  const expanded: ExpandedBatchCommand[] = []
  for (const { query, params } of commands) {
    if (params && isNestedParams(params)) {
      for (const rowParams of params) {
        expanded.push({ query, params: rowParams })
      }
    } else {
      expanded.push({ query, params })
    }
  }
  return expanded
}

function isNestedParams(
  params: SQLiteQueryParams | SQLiteQueryParams[],
): params is SQLiteQueryParams[] {
  return params.length > 0 && params.every(Array.isArray)
}

function toBoundValue(value: SQLiteValue): BoundValue {
  if (value === undefined) {
    return null
  }
  if (typeof value === 'boolean') {
    return Number(value)
  }
  if (value instanceof ArrayBuffer) {
    return Buffer.from(value)
  }
  return value
}

function normalizeRow(row: Record<string, unknown>): QueryResultRow {
  const result: QueryResultRow = {}
  for (const [key, value] of Object.entries(row)) {
    if (Buffer.isBuffer(value)) {
      const bytes = new ArrayBuffer(value.byteLength)
      new Uint8Array(bytes).set(value)
      result[key] = bytes
    } else if (
      value === null ||
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean'
    ) {
      result[key] = value
    } else {
      throw new Error(`Unsupported SQLite value in column ${key}.`)
    }
  }
  return result
}

function getChangeCount(database: Database): number {
  return getDatabaseChanges(database).rowsAffected
}

function getDatabaseChanges(database: Database): {
  rowsAffected: number
  insertId: number
} {
  const statement = database.prepare<
    [],
    { rowsAffected: number; insertId: number }
  >('SELECT changes() AS rowsAffected, last_insert_rowid() AS insertId')
  return statement.get() ?? { rowsAffected: 0, insertId: 0 }
}
