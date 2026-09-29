type ApiSymbolHeaderProps = {
  title: string
  languages: string
}

export function ApiSymbolHeader({ title, languages }: ApiSymbolHeaderProps) {
  return (
    <header className="api-symbol-header">
      <h1>{title}</h1>
      <span
        className="api-language-badges"
        aria-label={`Languages: ${languages.split(',').join(', ')}`}
      >
        {languages.split(',').map((language) => (
          <span
            className="api-language-badge"
            key={language}
          >
            {language}
          </span>
        ))}
      </span>
    </header>
  )
}
