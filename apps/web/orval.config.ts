import { defineConfig } from 'orval';

export default defineConfig({
  spicytrack: {
    input: {
      target: './openapi/spicytrack.json',
    },
    output: {
      target: './src/generated/api.ts',
      client: 'react-query',
      httpClient: 'fetch',
      mode: 'single',
      override: {
        mutator: {
          path: './src/lib/orval-fetch.ts',
          name: 'orvalFetch',
        },
      },
    },
  },
});
