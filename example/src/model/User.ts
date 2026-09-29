// import { Book } from './Book'
import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm/browser'

@Entity('user')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column('text')
  name!: string

  @Column('int')
  age!: number

  @Column('float')
  networth!: number

  // @OneToOne(type => Book)
  // @JoinColumn()
  // favoriteBook!: Book;

  @Column('simple-json')
  metadata: { nickname: string } | undefined

  @Column('blob')
  avatar: ArrayBuffer | undefined
}
