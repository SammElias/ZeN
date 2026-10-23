import {defineConfig} from 'vitest/config';
// Reference checkouts are data, not part of ZEN's executable test suite.
export default defineConfig({test:{include:['tests/**/*.{test,spec}.{ts,tsx}']}});
