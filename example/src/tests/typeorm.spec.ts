import type { Repository } from 'typeorm'
import { DataSource } from 'typeorm'
import { beforeAll, it, describe, beforeEachAsync } from './MochaRNAdapter'
import { typeORMDriver } from 'react-native-nitro-sqlite'
import { User } from '../model/User'
import { Book } from '../model/Book'
import chai from 'chai'

const expect = chai.expect

let dataSource: DataSource
let userRepository: Repository<User>
let bookRepository: Repository<Book>

export function registerTypeORMTests() {
  describe('Typeorm tests', () => {
    beforeAll((done) => {
      dataSource = new DataSource({
        type: 'react-native',
        database: 'typeormDb.sqlite',
        location: 'default',
        driver: typeORMDriver,
        entities: [User, Book],
        synchronize: true,
      })

      dataSource
        .initialize()
        .then(() => {
          userRepository = dataSource.getRepository(User)
          bookRepository = dataSource.getRepository(Book)
          done()
        })
        .catch((e) => {
          console.error('error initializing typeORM datasource', e)
          throw e
        })
    })

    beforeEachAsync(async () => {
      await userRepository.clear()
      await bookRepository.clear()
    })

    it('basic test', () => {
      expect(1).to.equal(2)
    })
  })
}
