import path from "node:path";
import { defineConfig } from "vitest/config";

const sharedResolve = {
  alias: { "@": path.resolve(__dirname, "./src") },
};

// Two projects:
//   - `unit`        : jsdom environment for client-side / pure helpers
//   - `integration` : node environment for route handler tests that hit the
//                     test database. Filename pattern *.itest.ts keeps them
//                     out of the unit run by default.
//
// Run all:        npm test
// Unit only:      npx vitest --project unit
// Integration:    npx vitest --project integration
export default defineConfig({
  resolve: sharedResolve,
  test: {
    projects: [
      {
        resolve: sharedResolve,
        test: {
          name: "unit",
          environment: "jsdom",
          globals: true,
          setupFiles: ["./src/test/setup.ts"],
          include: ["src/**/*.test.{ts,tsx}"],
          exclude: ["src/**/*.itest.ts"],
        },
      },
      {
        resolve: sharedResolve,
        test: {
          name: "integration",
          environment: "node",
          globals: true,
          include: ["src/**/*.itest.ts"],
          setupFiles: ["./src/test/integration-setup.ts"],
          // Integration tests share a DB so we can't run them in parallel
          // without coordinating; serialise for now.
          pool: "forks",
          poolOptions: { forks: { singleFork: true } },
          testTimeout: 20_000,
        },
      },
    ],
  },
});
