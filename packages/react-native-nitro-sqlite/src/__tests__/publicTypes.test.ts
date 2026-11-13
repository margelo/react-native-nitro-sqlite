import { join } from 'node:path'
import ts from 'typescript'

it('preserves legacy constructor types and interface augmentation', () => {
  const packageDirectory = join(__dirname, '../..')
  const fixturePath = join(__dirname, 'publicTypes.fixture.ts')
  const fixture = `
    import type {
      NitroSQLiteNative,
      NitroSQLitePreparedStatement,
      Connection,
      ConnectionOptions,
      NativeQueryResult,
      TypeOrmConnection,
    } from '../index'

    type RootArguments = ConstructorParameters<typeof NitroSQLiteNative>
    type PreparedPrototype = typeof NitroSQLitePreparedStatement.prototype

    declare module '../index' {
      interface NitroSQLiteConnection { legacyConnectionTag?: string }
      interface NitroSQLiteConnectionOptions { legacyOptionsTag?: string }
      interface NitroSQLiteQueryResult { legacyResultTag?: string }
      interface TypeOrmNitroSQLiteConnection { legacyTypeOrmTag?: string }
    }

    declare const connection: Connection
    const connectionTag: string | undefined = connection.legacyConnectionTag
    declare const options: ConnectionOptions
    const optionsTag: string | undefined = options.legacyOptionsTag
    declare const result: NativeQueryResult
    const resultTag: string | undefined = result.legacyResultTag
    declare const orm: TypeOrmConnection
    const ormTag: string | undefined = orm.legacyTypeOrmTag
  `
  const config = ts.readConfigFile(
    join(packageDirectory, 'tsconfig.json'),
    ts.sys.readFile,
  )
  const parsed = ts.parseJsonConfigFileContent(
    config.config,
    ts.sys,
    packageDirectory,
  )
  const options: ts.CompilerOptions = {
    ...parsed.options,
    noEmit: true,
    emitDeclarationOnly: false,
    composite: false,
    incremental: false,
    noUnusedLocals: false,
    noUnusedParameters: false,
  }
  const host = ts.createCompilerHost(options)
  const getSourceFile = host.getSourceFile.bind(host)
  host.getSourceFile = (fileName, languageVersion, onError, createNew) =>
    fileName === fixturePath
      ? ts.createSourceFile(fixturePath, fixture, languageVersion, true)
      : getSourceFile(fileName, languageVersion, onError, createNew)

  const program = ts.createProgram([fixturePath], options, host)
  const errors = ts
    .getPreEmitDiagnostics(program)
    .filter((diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error)
    .map((diagnostic) =>
      ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'),
    )
  expect(errors).toEqual([])
})
