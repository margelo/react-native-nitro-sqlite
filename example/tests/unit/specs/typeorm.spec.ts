import { expect } from '@tests/unit/common'
import { afterAll, beforeAll, beforeEach, describe, it } from '@tests/TestApi'
import type { Repository } from 'typeorm'
import { DataSource } from 'typeorm'
import { typeORMDriver } from 'react-native-nitro-sqlite'
import { User } from '@/model/User'
import { Book } from '@/model/Book'

let dataSource: DataSource
let userRepository: Repository<User>
let bookRepository: Repository<Book>

export default function registerTypeORMUnitTests() {
  describe('Typeorm tests', () => {
    beforeAll(async () => {
      dataSource = new DataSource({
        type: 'react-native',
        database: 'typeormDb.sqlite',
        location: 'default',
        driver: typeORMDriver,
        entities: [User, Book],
        synchronize: true,
      })

      try {
        await dataSource.initialize()
      } catch (e) {
        console.error('error initializing typeORM datasource', e)
        throw e
      }

      userRepository = dataSource.getRepository(User)
      bookRepository = dataSource.getRepository(Book)
    })

    beforeEach(async () => {
      await userRepository.clear()
      await bookRepository.clear()
    })

    afterAll(async () => {
      if (dataSource?.isInitialized) {
        await dataSource.destroy()
      }
    })

    it('inserts and reads entities', async () => {
      const user = userRepository.create({
        name: 'Test User',
        age: 42,
        networth: 1234.5,
        metadata: { nickname: 'tester' },
        avatar: new Uint8Array([1, 2, 3]).buffer,
      })
      const book = bookRepository.create({
        title: 'Test Book',
      })

      await userRepository.save(user)
      await bookRepository.save(book)

      const users = await userRepository.find()
      const books = await bookRepository.find()

      expect(users).toHaveLength(1)
      expect(users[0]?.name).toBe('Test User')
      expect(users[0]?.metadata).toEqual({ nickname: 'tester' })
      expect(books).toHaveLength(1)
      expect(books[0]?.title).toBe('Test Book')
    })
  })
}
