# Nitro SQLite documentation

This directory contains the Next.js and Fumadocs site for Nitro SQLite. It is part of the repository's Bun workspace, and a full checkout uses the root lockfile for dependency installation. The lockfile in this directory also supports deployments that install only the documentation directory.

## Local development

Use the package manager version pinned by the repository and Node.js 22.13 or newer. Install the documentation workspace dependencies from the repository root. Then run its scripts from the repository root:

```sh
bun docs dev
bun docs build
```

| Script | Purpose |
| --- | --- |
| `dev` | Generate the MDX source and start the local development server. |
| `typecheck` | Generate the MDX source and route types, then check TypeScript. |
| `build` | Generate the MDX source and build the production site. |
| `start` | Serve a completed production build. |

Documentation pages are in `content/docs/`. Each `.mdx` page has `title` and `description` frontmatter. The `meta.json` files set section names and navigation order. Add or move a page in both its directory and the corresponding `meta.json`. The landing page and search route live in `src/app/`; shared site data lives in `src/lib/`.

## Deployment

The intended Vercel project is [Margelo's react-native-nitro-sqlite project](https://vercel.com/margelo/react-native-nitro-sqlite). Configure its root directory as `docs/` and its framework preset as Next.js. Production deployments should follow `main`, with preview deployments for pull requests. Point `sqlite.margelo.com` at the production deployment. Check those project settings in Vercel before relying on them; this repository does not set the domain or branch policy.
