import { createMDX } from 'fumadocs-mdx/next'

const withMDX = createMDX()

/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  turbopack: { root: process.cwd() },
  async redirects() {
    return [
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
          '/api/react-native-nitro-sqlite/hybrid-objects/NitroSQLiteNative',
        permanent: true,
      },
      {
        source:
          '/api/react-native-nitro-sqlite/interfaces/NitroSQLiteQueryResult',
        destination:
          '/api/react-native-nitro-sqlite/hybrid-objects/NitroSQLiteQueryResult',
        permanent: true,
      },
    ]
  },
}

export default withMDX(config)
