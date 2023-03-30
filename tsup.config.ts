import { defineConfig } from 'tsup';

export default defineConfig({
    clean: true,
    entry: [
        'src/sync.ts'
    ],
    format: ['esm'],
    dts: true,
    sourcemap: true,
    minify: true
});
