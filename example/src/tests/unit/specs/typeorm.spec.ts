import { expect } from '../common'
import { beforeAll, beforeEach, describe, it } from 'react-native-harness'
import type { Repository } from 'typeorm'
import { DataSource } from 'typeorm'
import { typeORMDriver } from 'react-native-nitro-sqlite'
import { User } from '../../../model/User'
import { Book } from '../../../model/Book'

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

    it('basic test', () => {
      expect(1).toBe(1)
    })
  })
}
