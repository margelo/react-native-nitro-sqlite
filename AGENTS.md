# Documentation requirements

- Document every public-facing API when adding or changing it. Add TypeDoc-compatible JSDoc to exported TypeScript functions, types, interfaces, and Nitro specs. Document native declarations that users encounter directly or through generated references.
- Explain behavior, parameters, return values, lifecycle, and relevant errors in the source comments. Treat indirectly exposed types and methods as public when users can reach them.
- Update the Fumadocs guides or concepts in `docs/content/docs` for new features and behavior changes. Explain the underlying SQLite concept before showing Nitro SQLite usage.
- The API reference is generated from source comments. Run the docs build to check the generated pages; do not edit generated API pages by hand.
