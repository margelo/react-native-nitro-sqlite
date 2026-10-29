import { createMDX } from 'fumadocs-mdx/next'

const withMDX = createMDX()

/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  turbopack: { root: process.cwd() },
  async redirects() {
    return [
      {
        source: '/docs/configuration/common',
        destination: '/docs/configuration',
        permanent: true,
      },
      {
        source: '/docs/concepts/connection-ordering',
        destination: '/docs/concepts/isolation-and-concurrency',
        permanent: true,
      },
      {
        source: '/docs/api',
        destination: '/api',
        permanent: true,
      },
      {
        source: '/docs/api/connection',
        destination: '/docs/guides/database-lifecycle',
        permanent: true,
      },
      {
        source: '/docs/api/queries-and-results',
        destination: '/docs/guides/parameters-and-results',
        permanent: true,
      },
      {
        source: '/docs/api/transactions-and-batches',
        destination: '/docs/guides/transactions',
        permanent: true,
      },
      {
        source: '/docs/api/types-and-errors',
        destination: '/docs/guides/parameters-and-results#errors',
        permanent: true,
      },
      {
        source: '/docs/api/native',
        destination:
          '/docs/guides/sync-and-async#global-helpers-and-native-access',
        permanent: true,
      },
      {
        source: '/api/react-native-nitro-sqlite/interfaces/NitroSQLiteNative',
        destination:
          '/api/react-native-nitro-sqlite/hybrid-objects/NativeSQLite',
        permanent: true,
      },
      {
        source:
          '/api/react-native-nitro-sqlite/hybrid-objects/NitroSQLiteQueryResult',
        destination:
          '/api/react-native-nitro-sqlite/interfaces/NativeQueryResult',
        permanent: true,
      },
      ...[
        ['interfaces/NitroSQLiteConnection', 'interfaces/Connection'],
        [
          'interfaces/NitroSQLiteConnectionOptions',
          'interfaces/ConnectionOptions',
        ],
        ['classes/NitroSQLiteError', 'classes/SQLiteError'],
        ['hybrid-objects/NitroSQLiteNative', 'hybrid-objects/NativeSQLite'],
        [
          'hybrid-objects/NitroSQLitePreparedStatement',
          'hybrid-objects/NativePreparedStatement',
        ],
        ['interfaces/NitroSQLiteQueryResult', 'interfaces/NativeQueryResult'],
        [
          'interfaces/TypeOrmNitroSQLiteConnection',
          'interfaces/TypeOrmConnection',
        ],
        [
          'type-aliases/NitroSQLiteQueryColumnMetadata',
          'type-aliases/QueryColumnMetadata',
        ],
        [
          'type-aliases/NitroSQLiteQueryResultRows',
          'type-aliases/QueryResultRows',
        ],
        ['type-aliases/NitroSQLiteQueryRows', 'type-aliases/NativeQueryRows'],
        ['variables/NitroSQLiteExceptionType', 'variables/SQLiteExceptionType'],
        [
          'type-aliases/NitroSQLiteExceptionType',
          'type-aliases/SQLiteExceptionType',
        ],
      ].map(([source, destination]) => ({
        source: `/api/react-native-nitro-sqlite/${source}`,
        destination: `/api/react-native-nitro-sqlite/${destination}`,
        permanent: true,
      })),
    ]
  },
}

export default withMDX(config)
