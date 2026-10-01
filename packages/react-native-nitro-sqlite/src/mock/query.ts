import type BetterSqlite3 from 'better-sqlite3'
import type {
  BatchQueryCommand,
  QueryResult,
  QueryResultRow,
  SQLiteQueryParams,
  SQLiteValue,
} from '../types'

type Database = InstanceType<typeof BetterSqlite3>
type Statement = BetterSqlite3.Statement<unknown[], Record<string, unknown>>
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
