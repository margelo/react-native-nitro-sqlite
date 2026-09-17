import Link from 'next/link'

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col items-center justify-center px-6 text-center">
      <span className="font-mono text-sm text-fd-muted-foreground">404</span>
      <h1 className="mt-4 text-3xl font-semibold tracking-tight">Page not found</h1>
      <p className="mt-3 text-fd-muted-foreground">This page does not exist in the NitroSQLite docs.</p>
      <Link href="/docs" className="mt-7 rounded-full bg-fd-primary px-5 py-2.5 text-sm font-medium text-fd-primary-foreground">
        Browse the docs
      </Link>
    </main>
  )
}
