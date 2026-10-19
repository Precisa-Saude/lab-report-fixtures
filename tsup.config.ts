import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/cli.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  target: 'node22',
  clean: true,
  sourcemap: true,
  splitting: false,
  external: ['@napi-rs/canvas'],
  shims: true,
});
