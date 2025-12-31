import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [
    vue({
      template: {
        compilerOptions: {
          isCustomElement: (tag) => tag.startsWith('base-') || tag === 'theme-toggle',
        }
      }
    })
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src/frontend'),
    },
  },
  root: './src/frontend',
  publicDir: '../../public',
  build: {
    outDir: '../../dist/frontend',
    emptyOutDir: true,
  },
  server: {
    port: 3000,
    // No proxy needed in development - API calls will go directly to macconnachie.com via same-origin
    // OR if you want to proxy for local development, you can uncomment below:
    // proxy: {
    //   '^/api/(?!.*\\.ts$)': {  // Don't proxy .ts files
    //     target: 'http://localhost:8000',  // Your local API Gateway
    //     changeOrigin: true,
    //   },
    // },
  },
})
