<a href="https://sqlite.margelo.com/docs">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="./assets/img/banner-dark.png" />
    <source media="(prefers-color-scheme: light)" srcset="./assets/img/banner-light.png" />
    <img alt="Nitro SQLite" src="./assets/img/banner-light.png" />
  </picture>
</a>

<br />

Nitro SQLite is a SQLite library for React Native on iOS and Android, built with [Nitro Modules](https://nitro.margelo.com/). It provides synchronous and asynchronous queries, transactions, and batch operations.

**[Read the documentation](https://sqlite.margelo.com/docs)** for setup, guides, integrations, and the API reference.

## Installation

Requires React Native 0.75 or newer and `react-native-nitro-modules` 0.37.1 or newer.

```sh
npm install react-native-nitro-sqlite react-native-nitro-modules
```

Rebuild the native app after installing. Expo projects need a development build; Expo Go cannot load this native module. See [Getting Started](https://sqlite.margelo.com/docs) for details.

## Example

```ts
import { open } from 'react-native-nitro-sqlite'

const db = open({ name: 'app.sqlite' })
db.execute('CREATE TABLE IF NOT EXISTS notes (id INTEGER PRIMARY KEY, body TEXT)')
db.execute('INSERT INTO notes (body) VALUES (?)', ['Hello'])

const { rows } = db.execute<{ id: number; body: string }>(
  'SELECT id, body FROM notes',
)
console.log(rows._array)

db.close()
```

## Migrating from Quick SQLite

`react-native-quick-sqlite` 8.x was succeeded by `react-native-nitro-sqlite` 9.x. Follow the [migration guide](https://sqlite.margelo.com/docs/guides/migrate-from-quick-sqlite) before updating an app with existing database files.

## Community and contributing

Join the [Margelo Community Discord](https://discord.gg/6CSHz2qAvA). Contributions are welcome through [issues](https://github.com/margelo/react-native-nitro-sqlite/issues) and pull requests.

## License

MIT.
