export const HybridNitroSQLite = {
  open: jest.fn(),
  close: jest.fn(),
  drop: jest.fn(),
  attach: jest.fn(),
  detach: jest.fn(),
  execute: jest.fn(),
  executeAsync: jest.fn(),
  prepare: jest.fn(),
  executeBatch: jest.fn(),
  executeBatchAsync: jest.fn(),
  loadFile: jest.fn(),
  loadFileAsync: jest.fn(),
}
