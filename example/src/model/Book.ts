import 'reflect-metadata';
import {Entity, Column, PrimaryGeneratedColumn} from 'typeorm/browser';
import {BaseEntity} from 'typeorm';

@Entity()
export class Book extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  title!: string;
}
