import Link from 'next/link'

export default function HomePage() {
  return (
    <main className="home-main">
      <div className="home-grid" aria-hidden="true" />
      <section className="hero" aria-labelledby="hero-title">
        <div className="hero-copy">
          <p className="eyebrow"><span className="eyebrow-dot" /> Native SQLite for React Native</p>
          <h1 id="hero-title">Fast SQLite.<br /><span>Inside your app.</span></h1>
          <p className="hero-description">
            Open a SQLite database and run queries through Nitro Modules. Use a direct synchronous call or an asynchronous one when your app needs it.
          </p>
          <div className="hero-actions">
            <Link className="button button-primary" href="/docs">Get started <ArrowIcon /></Link>
            <Link className="button button-secondary" href="/docs/api">API reference <ArrowIcon /></Link>
          </div>
          <div className="hero-note">
            <span className="note-line" />
            <span>Local data, standard SQL, React Native.</span>
          </div>
        </div>
        <QueryIllustration />
      </section>
      <section className="home-links" aria-label="Explore NitroSQLite">
        <Link href="/docs/getting-started/first-database" className="home-link">
          <span className="home-link-number">01 / Open</span>
          <span className="home-link-title">Start with a database <ArrowIcon /></span>
          <span className="home-link-description">Create a connection to a local SQLite file.</span>
        </Link>
        <Link href="/docs/guides/parameters-and-results" className="home-link">
          <span className="home-link-number">02 / Query</span>
          <span className="home-link-title">Work with SQL <ArrowIcon /></span>
          <span className="home-link-description">Execute statements and read typed results.</span>
        </Link>
        <Link href="/docs/guides/transactions" className="home-link">
          <span className="home-link-number">03 / Group</span>
          <span className="home-link-title">Keep operations together <ArrowIcon /></span>
          <span className="home-link-description">Use transactions or batches for related work.</span>
        </Link>
      </section>
    </main>
  )
}

function QueryIllustration() {
  return (
    <div className="query-scene" role="img" aria-label="Illustration of a SQL lookup returning a row">
      <div className="scene-glow" aria-hidden="true" />
      <div className="scene-frame">
        <div className="scene-header">
          <div className="scene-header-left"><span className="scene-status" /> app.db <span className="scene-divider">/</span> query</div>
          <span className="scene-header-right">SQLite</span>
        </div>
        <div className="scene-query">
          <span className="scene-gutter">01</span>
          <code><span className="sql-keyword">SELECT</span> id, name <span className="sql-keyword">FROM</span> notes</code>
          <span className="scene-gutter">02</span>
          <code><span className="sql-keyword">WHERE</span> id = <span className="sql-param">?</span>;</code>
        </div>
        <div className="scene-parameter"><span>parameter</span><code>[42]</code></div>
        <div className="scene-path" aria-hidden="true">
          <span className="path-label">indexed lookup</span>
          <span className="path-line"><span className="path-pulse" /></span>
          <span className="path-arrow">↓</span>
        </div>
        <div className="scene-result">
          <div className="result-title"><span className="result-mark">↳</span> Result row <span className="result-success">found</span></div>
          <div className="result-grid" role="table" aria-label="Illustrative SQL result">
            <div className="result-row result-head" role="row"><span role="columnheader">id</span><span role="columnheader">name</span></div>
            <div className="result-row result-data" role="row"><span role="cell">42</span><span role="cell">Release notes</span></div>
          </div>
        </div>
      </div>
      <div className="scene-caption"><span className="caption-bracket">[</span> write SQL, read rows <span className="caption-bracket">]</span></div>
    </div>
  )
}

function ArrowIcon() {
  return <svg aria-hidden="true" viewBox="0 0 20 20" fill="none"><path d="M4 10h11m-4-4 4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
}
