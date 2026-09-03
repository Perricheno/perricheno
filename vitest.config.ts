import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
    plugins: [tsconfigPaths()],
    test: {
        environment: "node",
        globals: false,
        include: ["tests/**/*.test.ts"],
        testTimeout: 20000,
        hookTimeout: 30000,
        // Money/session/DB tests hit a real Postgres and mutate shared tables -
        // run them one at a time, not in parallel, to avoid cross-test races.
        fileParallelism: false,
        setupFiles: ["./tests/setup.ts"],
    },
});
