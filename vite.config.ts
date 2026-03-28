import {resolve} from "node:path";
import {defineConfig} from "vite";

export default defineConfig({
    build: {
        lib: {
            entry: {
                index: resolve(__dirname, "src/index.ts"),
            },
            formats: ["es", "cjs"],
            fileName: (format, entryName) => `${entryName}.${format}.js`
        },
        rollupOptions: {
            output: {
                exports: "named",
            }
        },
        emptyOutDir: true,
        sourcemap: true,
        target: "node18"
    }
});
