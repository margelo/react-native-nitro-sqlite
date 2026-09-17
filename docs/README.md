# Nitro SQLite documentation

This directory is the standalone documentation site for Nitro SQLite. It uses Next.js and Fumadocs, with its own `package.json` and `bun.lock`. Install dependencies from this directory so documentation work does not change the repository's React Native workspace lockfile.

## Local development

Use the package manager version pinned in `docs/package.json` and Node.js 22.13 or newer. Install the dependencies in `docs/`, then use its scripts:

| Script | Purpose |
| --- | --- |
| `dev` | Generate the MDX source and start the local development server. |
| `typecheck` | Generate the MDX source and route types, then check TypeScript. |
| `build` | Generate the MDX source and build the production site. |
| `start` | Serve a completed production build. |

Documentation pages are in `content/docs/`. Each `.mdx` page has `title` and `description` frontmatter. The `meta.json` files set section names and navigation order. Add or move a page in both its directory and the corresponding `meta.json`. The landing page and search route live in `src/app/`; shared site data lives in `src/lib/`.

## Deployment

The intended Vercel project is [Margelo's react-native-nitro-sqlite project](https://vercel.com/margelo/react-native-nitro-sqlite). Configure its root directory as `docs/` and its framework preset as Next.js. Production deployments should follow `main`, with preview deployments for pull requests. Point `sqlite.margelo.com` at the production deployment. Check those project settings in Vercel before relying on them; this repository does not set the domain or branch policy.
