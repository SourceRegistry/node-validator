import {resolve} from "node:path";
import {defineConfig} from "vite";
import dts from "vite-plugin-dts";

export default defineConfig({
    plugins: [
        dts({
            include: ["src"],
            outDir: "dist"
        })
    ],
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
