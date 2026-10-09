import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  // ⚠️ Change '/la-eats/' to match your actual GitHub repository name
  // e.g. if your repo is github.com/username/food-safety → base: '/food-safety/'
  base: '/la-eats/'
})
