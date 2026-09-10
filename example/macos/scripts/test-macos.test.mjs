import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { chmod, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { after, before, test } from 'node:test'
import { fileURLToPath } from 'node:url'

const runnerPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'test-macos.mjs',
)

let fixtureRoot
let appPath

before(async () => {
  fixtureRoot = await mkdtemp(path.join(os.tmpdir(), 'nitro-sqlite-macos-'))
  appPath = path.join(fixtureRoot, 'Fake.app')

  await mkdir(path.join(fixtureRoot, 'scripts'), { recursive: true })
  await mkdir(path.join(appPath, 'Contents', 'MacOS'), { recursive: true })
  await writeFile(
    path.join(fixtureRoot, 'scripts', 'react-native-macos.js'),
    fakeMetroSource,
  )

  const appExecutable = path.join(
    appPath,
    'Contents',
    'MacOS',
    'NitroSQLiteExample',
  )
  await writeFile(appExecutable, fakeAppSource)
  await chmod(appExecutable, 0o755)
})

after(async () => {
  await rm(fixtureRoot, { recursive: true, force: true })
})

test('completes after receiving a passing report', async () => {
  const result = await runRunner({ appScenario: 'success' })

  assert.equal(result.code, 0, result.output)
  assert.match(result.output, /macOS tests: 1 passed, 0 failed/)
})

test('fails when the app reports a failed test', async () => {
  const result = await runRunner({ appScenario: 'test-failure' })

  assert.equal(result.code, 1, result.output)
  assert.match(result.output, /macOS tests: 1 passed, 1 failed/)
  assert.match(result.output, /query fails: Expected one row/)
})

test('times out when the app does not report results', async () => {
  const result = await runRunner({
    appScenario: 'no-report',
    testTimeoutMs: 100,
  })

  assert.equal(result.code, 1, result.output)
  assert.match(
    result.output,
    /Timed out waiting for macOS test results after 100ms/,
  )
})

test('fails promptly when Metro exits during startup', async () => {
  const result = await runRunner({
    appScenario: 'success',
    metroScenario: 'early-exit',
  })

  assert.equal(result.code, 1, result.output)
  assert.match(result.output, /Metro exited/)
  assert.match(result.output, /fake Metro failed/)
})

test('fails when the app exits before reporting results', async () => {
  const result = await runRunner({ appScenario: 'early-exit' })

  assert.equal(result.code, 1, result.output)
  assert.match(
    result.output,
    /The macOS app exited before the macOS test report was received \(exit code 23\)/,
  )
  assert.match(result.output, /fake app failed/)
})

async function runRunner({
  appScenario,
  metroScenario = 'ready',
  testTimeoutMs = 1_000,
}) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [runnerPath], {
      cwd: fixtureRoot,
      env: {
        ...process.env,
        FAKE_APP_SCENARIO: appScenario,
        FAKE_METRO_SCENARIO: metroScenario,
        MACOS_APP_PATH: appPath,
        MACOS_TEST_TIMEOUT_MS: String(testTimeoutMs),
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let output = ''

    child.stdout.on('data', (chunk) => {
      output += chunk
    })
    child.stderr.on('data', (chunk) => {
      output += chunk
    })
    child.once('error', reject)
    child.once('close', (code, signal) => {
      resolve({ code, output, signal })
    })
  })
}

const fakeMetroSource = `
import { createServer } from 'node:http'

if (process.env.FAKE_METRO_SCENARIO === 'early-exit') {
  console.error('fake Metro failed')
  process.exit(17)
}

const portFlag = process.argv.indexOf('--port')
const port = Number(process.argv[portFlag + 1])
const server = createServer((_request, response) => {
  response.writeHead(200, { 'Content-Type': 'text/plain' })
  response.end('packager-status:running')
})

server.listen(port, '127.0.0.1')
process.on('SIGTERM', () => server.close(() => process.exit(0)))
`

const fakeAppSource = `#!/usr/bin/env node
if (process.env.FAKE_APP_SCENARIO === 'early-exit') {
  console.error('fake app failed')
  process.exit(23)
}

if (process.env.FAKE_APP_SCENARIO !== 'no-report') {
  const results = process.env.FAKE_APP_SCENARIO === 'test-failure'
    ? [
        { type: 'correct', description: 'query succeeds' },
        {
          type: 'incorrect',
          description: 'query fails',
          errorMsg: 'Expected one row',
        },
      ]
    : [
        { type: 'correct', description: 'query succeeds' },
        { type: 'pending', description: 'query is skipped' },
      ]

  const response = await fetch(process.env.NITRO_SQLITE_TEST_REPORT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ results }),
  })

  if (!response.ok) {
    throw new Error(\`Could not submit fake report: \${response.status}\`)
  }
}

setInterval(() => {}, 1_000)
`
