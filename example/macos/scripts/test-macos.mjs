import { spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { access } from 'node:fs/promises'
import { createServer } from 'node:http'
import path from 'node:path'
import process from 'node:process'
import { setTimeout as delay } from 'node:timers/promises'

const testTimeoutMs = Number(process.env.MACOS_TEST_TIMEOUT_MS ?? 300_000)
const appPath = path.resolve(
  process.env.MACOS_APP_PATH ??
    'build/Build/Products/Debug/NitroSQLiteExample.app',
)
const appExecutable = path.join(
  appPath,
  'Contents',
  'MacOS',
  'NitroSQLiteExample',
)

function formatError(error) {
  return error instanceof Error ? error.message : String(error)
}

function captureOutput(child) {
  let output = ''
  const append = (chunk) => {
    output = `${output}${chunk}`.slice(-16_000)
  }

  child.stdout?.on('data', append)
  child.stderr?.on('data', append)
  return () => output
}

async function getAvailablePort() {
  return new Promise((resolve, reject) => {
    const server = createServer()
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      if (address == null || typeof address === 'string') {
        server.close(() =>
          reject(new Error('Could not determine an available Metro port')),
        )
        return
      }

      server.close(() => resolve(address.port))
    })
  })
}

async function waitForMetro(metro, metroPort, getMetroOutput) {
  const deadline = Date.now() + 60_000
  const metroStatusUrl = `http://127.0.0.1:${metroPort}/status`

  while (Date.now() < deadline) {
    if (metro.exitCode != null) {
      throw new Error(
        `Metro exited before becoming ready.\n${getMetroOutput()}`,
      )
    }

    try {
      const response = await fetch(metroStatusUrl)
      if (
        response.ok &&
        (await response.text()).includes('packager-status:running')
      ) {
        return
      }
    } catch {
      // Metro has not started listening yet.
    }

    await delay(250)
  }

  throw new Error(`Timed out waiting for Metro.\n${getMetroOutput()}`)
}

async function createResultServer() {
  let resolveReport
  const report = new Promise((resolve) => {
    resolveReport = resolve
  })
  const reportPath = `/report/${randomUUID()}`
  const server = createServer((request, response) => {
    if (request.method !== 'POST' || request.url !== reportPath) {
      response.writeHead(404).end()
      return
    }

    let body = ''
    request.setEncoding('utf8')
    request.on('data', (chunk) => {
      body += chunk
      if (body.length > 1_000_000) {
        response.writeHead(413).end()
        request.destroy()
      }
    })
    request.on('end', () => {
      try {
        const parsed = JSON.parse(body)
        response.writeHead(204, { Connection: 'close' }).end()
        resolveReport(parsed)
      } catch {
        response.writeHead(400).end()
      }
    })
  })

  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })

  const address = server.address()
  if (address == null || typeof address === 'string') {
    throw new Error('Could not determine the macOS test result server address')
  }

  return {
    report,
    reportUrl: `http://127.0.0.1:${address.port}${reportPath}`,
    server,
  }
}

function watchProcessFailure(child, name, getOutput) {
  let rejectFailure
  const onError = (error) => {
    rejectFailure(new Error(`${name} could not start: ${formatError(error)}`))
  }
  const onExit = (code, signal) => {
    const reason = signal == null ? `exit code ${code}` : `signal ${signal}`
    const output = getOutput()
    rejectFailure(
      new Error(
        `${name} exited before the macOS test report was received (${reason}).${
          output.length > 0 ? `\n${output}` : ''
        }`,
      ),
    )
  }

  const failure = new Promise((_, reject) => {
    rejectFailure = reject
  })

  child.once('error', onError)
  child.once('exit', onExit)

  if (child.exitCode != null || child.signalCode != null) {
    onExit(child.exitCode, child.signalCode)
  }

  return {
    failure,
    stopWatching() {
      child.removeListener('error', onError)
      child.removeListener('exit', onExit)
    },
  }
}

async function waitForReport(report, failures) {
  let timeout
  try {
    return await Promise.race([
      report,
      ...failures,
      new Promise((_, reject) => {
        timeout = setTimeout(
          () =>
            reject(
              new Error(
                `Timed out waiting for macOS test results after ${testTimeoutMs}ms`,
              ),
            ),
          testTimeoutMs,
        )
      }),
    ])
  } finally {
    clearTimeout(timeout)
  }
}

function validateReport(report) {
  if (report == null || typeof report !== 'object') {
    throw new Error('The macOS app returned an invalid test report')
  }

  if (typeof report.error === 'string' && report.error.length > 0) {
    throw new Error(`The macOS test runner failed: ${report.error}`)
  }

  if (!Array.isArray(report.results) || report.results.length === 0) {
    throw new Error('The macOS app returned no test results')
  }

  const passed = report.results.filter((result) => result.type === 'correct')
  const failures = report.results.filter(
    (result) => result.type === 'incorrect',
  )
  console.log(`macOS tests: ${passed.length} passed, ${failures.length} failed`)

  if (passed.length === 0) {
    throw new Error('The macOS app did not run any passing tests')
  }

  if (failures.length > 0) {
    const details = failures
      .map(
        (failure) =>
          `- ${failure.description}: ${failure.errorMsg ?? 'Unknown failure'}`,
      )
      .join('\n')
    throw new Error(`macOS tests failed:\n${details}`)
  }
}

async function stopProcess(child) {
  if (child == null || child.pid == null) return

  const signalProcessGroup = (signal) => {
    try {
      process.kill(-child.pid, signal)
    } catch (error) {
      if (error.code !== 'ESRCH') throw error
    }
  }

  signalProcessGroup('SIGTERM')
  await delay(1_000)
  signalProcessGroup('SIGKILL')
}

async function closeResultServer(server) {
  server.closeAllConnections?.()

  await new Promise((resolve, reject) => {
    server.close((error) => {
      if (error != null) reject(error)
      else resolve()
    })
  })
}

async function main() {
  await access(appExecutable)

  const resultServer = await createResultServer()
  const metroPort = await getAvailablePort()
  let metro
  let app
  let metroFailure
  let appFailure

  try {
    metro = spawn('bun', ['run', 'start', '--', '--port', String(metroPort)], {
      cwd: process.cwd(),
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    const getMetroOutput = captureOutput(metro)
    await waitForMetro(metro, metroPort, getMetroOutput)
    metroFailure = watchProcessFailure(metro, 'Metro', getMetroOutput)

    app = spawn(appExecutable, [], {
      detached: true,
      env: {
        ...process.env,
        NITRO_SQLITE_TEST_METRO_PORT: String(metroPort),
        NITRO_SQLITE_TEST_REPORT_URL: resultServer.reportUrl,
        NO_PROXY: '127.0.0.1,localhost',
        no_proxy: '127.0.0.1,localhost',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    const getAppOutput = captureOutput(app)
    const getAppAndMetroOutput = () => {
      const appOutput = getAppOutput()
      const metroOutput = getMetroOutput()

      return [
        appOutput.length > 0 && `App output:\n${appOutput}`,
        metroOutput.length > 0 && `Metro output:\n${metroOutput}`,
      ]
        .filter(Boolean)
        .join('\n\n')
    }
    appFailure = watchProcessFailure(app, 'The macOS app', getAppAndMetroOutput)
    const result = await waitForReport(resultServer.report, [
      appFailure.failure,
      metroFailure.failure,
    ])
    appFailure.stopWatching()
    appFailure = undefined
    metroFailure.stopWatching()
    metroFailure = undefined
    validateReport(result)
  } finally {
    appFailure?.stopWatching()
    metroFailure?.stopWatching()
    await stopProcess(app)
    await stopProcess(metro)
    await closeResultServer(resultServer.server)
  }
}

main().catch((error) => {
  console.error(formatError(error))
  process.exitCode = 1
})
