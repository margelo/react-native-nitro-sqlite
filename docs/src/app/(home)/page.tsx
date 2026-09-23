import Link from 'next/link'
import { DatabaseIllustration } from './DatabaseIllustration'

export default function HomePage() {
  return (
    <main className="home-main">
      <div className="home-grid" aria-hidden="true" />
      <section className="hero" aria-labelledby="hero-title">
        <div className="hero-copy">
          <p className="eyebrow">NitroSQLite by Margelo</p>
          <h1 id="hero-title">Fast SQLite for<br /><span>React Native.</span></h1>
          <p className="hero-description">
            Nitro Modules provides low-overhead native bindings to SQLite on iOS and Android. Run synchronous queries for immediate results or asynchronous queries to keep longer work off the JavaScript thread. Built and maintained by Margelo.
          </p>
          <div className="hero-actions">
            <Link className="button button-primary" href="/docs">Get started <ArrowIcon /></Link>
            <Link className="button button-secondary" href="/api">API reference <ArrowIcon /></Link>
          </div>
        </div>
        <DatabaseIllustration />
      </section>
      <section className="home-links" aria-label="Explore NitroSQLite">
        <Link href="/docs" className="home-link">
          <span className="home-link-number">Getting started</span>
          <span className="home-link-title">Install and run a query <ArrowIcon /></span>
          <span className="home-link-description">Set up the native package and make your first SQLite call.</span>
        </Link>
        <Link href="/docs/guides/performance" className="home-link">
          <span className="home-link-number">Performance</span>
          <span className="home-link-title">Keep queries responsive <ArrowIcon /></span>
          <span className="home-link-description">Choose sync or async work, batch writes, and tune SQL.</span>
        </Link>
        <Link href="/api" className="home-link">
          <span className="home-link-number">API reference</span>
          <span className="home-link-title">Explore the full API <ArrowIcon /></span>
          <span className="home-link-description">Find connection methods, transactions, options, and types.</span>
        </Link>
      </section>
    </main>
  )
}

function ArrowIcon() {
  return <svg aria-hidden="true" viewBox="0 0 20 20" fill="none"><path d="M4 10h11m-4-4 4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
}
