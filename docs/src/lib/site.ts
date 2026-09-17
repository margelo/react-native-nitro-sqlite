export const site = {
  name: 'NitroSQLite',
  description: 'SQLite for React Native, with synchronous and asynchronous APIs powered by Nitro Modules.',
  url: 'https://sqlite.margelo.com',
  repositoryUrl: 'https://github.com/margelo/react-native-nitro-sqlite',
} as const

export function absoluteUrl(path: string): string {
  return new URL(path, site.url).toString()
}
