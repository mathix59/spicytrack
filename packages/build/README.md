# `@spicytrack/build`

Automatic release creation and source-map uploads for SpicyTrack. The runtime application keeps
using its existing Sentry SDK; this package runs only during production builds.

## One-command setup

Create a Personal Access Token in **Account → API tokens**, then run:

```bash
npx @spicytrack/build init
```

`init` detects Next.js, Nuxt, SvelteKit, Angular, Vite, Webpack, Rollup or esbuild, writes a safe
`.spicytrack.json`, adds the package, and wraps the existing `build` script. The token is never
written to disk.

```bash
export SPICYTRACK_AUTH_TOKEN=pat_...
npm install
npm run build
```

A successful build now creates a release using the CI commit SHA (or local Git SHA), preserves the
framework's public artifact paths and uploads JavaScript bundles plus Source Map v3 files.

## Configuration

```json
{
  "url": "https://errors.example.com",
  "organization": "acme",
  "project": "storefront",
  "framework": "nextjs",
  "roots": [".next"]
}
```

Environment variables override the file:

- `SPICYTRACK_AUTH_TOKEN` (required and secret)
- `SPICYTRACK_URL`, `SPICYTRACK_ORG`, `SPICYTRACK_PROJECT`
- `SPICYTRACK_RELEASE` (otherwise Vercel/GitHub/GitLab/Cloudflare/Netlify/Git is detected)

Run `spicytrack doctor` to verify the token, project, release and generated maps. Existing pipelines
can use `spicytrack upload`, or `spicytrack build -- <command>` to upload only after a successful
build.

## Direct bundler plugins

For applications which prefer configuration over a wrapped build command:

```js
import { spicyTrackVitePlugin } from "@spicytrack/build/vite";

export default {
  plugins: [spicyTrackVitePlugin()],
};
```

Equivalent exports exist at `/next`, `/webpack`, `/rollup`, and `/esbuild`. They enable hidden or
external source maps and upload them after a successful production compilation.

The release passed to the Sentry SDK must match the uploaded release. The `build` wrapper exports
`SENTRY_RELEASE`, `NEXT_PUBLIC_SENTRY_RELEASE`, `VITE_SENTRY_RELEASE`, and
`NUXT_PUBLIC_SENTRY_RELEASE` while the framework compiles.
