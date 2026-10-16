import type BetterSqlite3 from 'better-sqlite3'
import type { NitroSQLiteRawQueryResult } from '../specs/NitroSQLiteQueryResult.nitro'
import type {
  BatchQueryCommand,
  QueryResult,
  QueryResultRow,
  SQLiteQueryParams,
  SQLiteValue,
} from '../types'

type Database = InstanceType<typeof BetterSqlite3>
type Statement = BetterSqlite3.Statement<unknown[], Record<string, unknown>>
type RawStatement = BetterSqlite3.Statement<unknown[], unknown[]>
type BoundValue = string | number | Buffer | null
type ExpandedBatchCommand = { query: string; params?: SQLiteQueryParams }

/** @internal Execute an already prepared statement with fresh parameter bindings. */
export function executePrepared<Row extends QueryResultRow = QueryResultRow>(
  database: Database,
  statement: Statement,
  params?: SQLiteQueryParams,
): QueryResult<Row> {
  const bindings = getBindings(statement.source, params)
  const results: QueryResultRow[] = []
  if (statement.reader)
    results.push(...statement.all(...bindings).map(normalizeRow))
  else statement.run(...bindings)
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

/** @internal Execute an already prepared statement, returning rows as arrays of column values. */
export function executePreparedRaw(
  database: Database,
  statement: Statement,
  params?: SQLiteQueryParams,
): NitroSQLiteRawQueryResult {
  const bindings = getBindings(statement.source, params)
  let columnNames: string[] = []
  let rows: SQLiteValue[][] = []
  if (statement.reader) {
    columnNames = statement.columns().map((column) => column.name)
    try {
      // better-sqlite3's types keep the object row type after raw(true).
      const rawStatement = statement.raw(true) as unknown as RawStatement
      rows = rawStatement
        .all(...bindings)
        .map((row) =>
          row.map((value, index) => normalizeValue(value, columnNames[index]!)),
        )
    } finally {
      // Raw mode stays on the statement, and prepared statements also serve execute().
      statement.raw(false)
    }
  } else statement.run(...bindings)
  const { rowsAffected, insertId } = getDatabaseChanges(database)
  return {
    rowsAffected,
    insertId,
    columnNames,
    rows,
  } as NitroSQLiteRawQueryResult
}

/** @internal Execute one SQL statement and return rows as arrays of column values. */
export function executeRawQuery(
  database: Database,
  query: string,
  params?: SQLiteQueryParams,
): NitroSQLiteRawQueryResult {
  return executePreparedRaw(database, database.prepare(query), params)
}

/** @internal Execute one SQL statement and return Nitro-shaped data. */
export function executeQuery<Row extends QueryResultRow = QueryResultRow>(
  database: Database,
  query: string,
  params?: SQLiteQueryParams,
): QueryResult<Row> {
  return executePrepared<Row>(database, database.prepare(query), params)
}

/** @internal Execute a batch atomically and count affected rows. */
export function executeBatch(
  database: Database,
  commands: BatchQueryCommand[],
) {
  const expanded = expandBatchCommands(commands)
  if (expanded.length === 0) throw new Error('No SQL batch commands provided')
  let rowsAffected = 0
  database
    .transaction(() => {
      for (const { query, params } of expanded) {
        const statement = database.prepare<unknown[], Record<string, unknown>>(
          query,
        )
        executePrepared(database, statement, params)
        if (!statement.readonly) rowsAffected += getChangeCount(database)
      }
    })
    .exclusive()
  return { rowsAffected }
}

function getBindings(query: string, params?: SQLiteQueryParams) {
  const { names, positionalCount } = extractParameters(query)
  if (names.length === 0) {
    const values = params?.map(toBoundValue) ?? []
    while (values.length < positionalCount) values.push(null)
    return values
  }
  const values: Record<string, BoundValue> = {}
  for (const [index, name] of names.entries()) {
    values[name] = toBoundValue(params?.[index] ?? null)
  }
  return [values]
}

function extractParameters(query: string) {
  const names = new Set<string>()
  let positionalCount = 0
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
    if (char === '?') positionalCount++
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
  return { names: [...names], positionalCount }
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
    result[key] = normalizeValue(value, key)
  }
  return result
}

function normalizeValue(value: unknown, column: string): SQLiteValue {
  if (Buffer.isBuffer(value)) {
    const bytes = new ArrayBuffer(value.byteLength)
    new Uint8Array(bytes).set(value)
    return bytes
  }
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return value
  }
  throw new Error(`Unsupported SQLite value in column ${column}.`)
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
