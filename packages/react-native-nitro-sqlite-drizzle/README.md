# react-native-nitro-sqlite-drizzle

[Drizzle ORM](https://orm.drizzle.team) driver for [`react-native-nitro-sqlite`](https://github.com/margelo/react-native-nitro-sqlite).

## Installation

```bash
npm install react-native-nitro-sqlite react-native-nitro-sqlite-drizzle drizzle-orm
```

## Usage

```ts
import { sqliteTable, integer, text } from 'drizzle-orm/sqlite-core'
import { open } from 'react-native-nitro-sqlite'
import { drizzle } from 'react-native-nitro-sqlite-drizzle'

const users = sqliteTable('users', {
  id: integer('id').primaryKey(),
  name: text('name').notNull(),
})

const db = drizzle(open({ name: 'app.sqlite' }))

await db.insert(users).values({ id: 1, name: 'Ada' })
const rows = await db.select().from(users)
```

Every query is asynchronous. Inside `db.transaction()`, run queries through `tx`: a query awaited through `db` waits for the transaction and never completes.

See the [Drizzle ORM guide](https://sqlite.margelo.com/docs/integrations/drizzle) for migrations with Drizzle Kit, `useMigrations`, and transactions.
