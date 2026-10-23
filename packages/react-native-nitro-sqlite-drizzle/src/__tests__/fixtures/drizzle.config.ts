import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  schema: './src/__tests__/fixtures/schema.ts',
  out: './src/__tests__/fixtures/drizzle',
  dialect: 'sqlite',
  driver: 'expo',
})
