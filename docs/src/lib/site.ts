export const site = {
  name: 'NitroSQLite',
  description: 'Fast SQLite for React Native, powered by Nitro Modules and maintained by Margelo.',
  url: 'https://sqlite.margelo.com',
  repositoryUrl: 'https://github.com/margelo/react-native-nitro-sqlite',
} as const

export function absoluteUrl(path: string): string {
  return new URL(path, site.url).toString()
}
