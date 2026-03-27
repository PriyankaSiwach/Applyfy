<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Cursor Cloud specific instructions

This is a single Next.js 16 application (App Router, React 19, Tailwind CSS v4, TypeScript). No databases, Docker, or external services are required.

### Key commands

| Task | Command |
|------|---------|
| Install deps | `npm install` |
| Dev server | `npm run dev` (port 3000) |
| Build | `npm run build` |
| Lint | `npm run lint` (ESLint 9) |

### Notes

- The lockfile is `package-lock.json` — always use `npm`, not `pnpm`/`yarn`.
- Next.js 16.2.1 uses Turbopack by default for both dev and build. No special flags needed.
- There are no automated tests configured yet (no test script in `package.json`).
