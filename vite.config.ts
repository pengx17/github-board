import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "node:path";
import "dotenv/config";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      { find: "@", replacement: path.resolve(__dirname, "./") },
      {
        find: "node-fetch",
        replacement: "isomorphic-fetch",
      },
    ],
  },
  define: {
    "process.env.GITHUB_ACCESS_TOKEN": JSON.stringify(
      process.env.GITHUB_ACCESS_TOKEN
    ),
    global: {},
  },
});
