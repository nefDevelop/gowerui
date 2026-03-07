import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { svelteTesting } from '@testing-library/svelte/vite';
import path from 'path';

export default defineConfig({
    plugins: [
        svelte({ hot: !process.env.VITEST }),
        svelteTesting()
    ],
    test: {
        environment: 'jsdom',
        globals: true,
        setupFiles: ['./src/test/setup.js'],
        alias: {
            '$lib': path.resolve(__dirname, './src/lib')
        }
    },
});
