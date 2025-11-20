import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    open: true,
  },
  build: {
    target: 'esnext',
    minify: 'terser',
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks: {
          // Vendor chunks
          'vendor-react': ['react', 'react-dom'],
          'vendor-viem': ['viem'],
          'vendor-metamask': ['@metamask/smart-accounts-kit'],

          // Core app chunks
          'components': [
            './src/components/MetaMaskConnect.tsx',
            './src/components/EIP7702Demo.tsx',
            './src/components/MetaMaskSmartAccount.tsx',
          ],
        },
      },
    },
  },
  optimizeDeps: {
    include: [
      'viem',
      '@metamask/smart-accounts-kit',
      'react',
      'react-dom',
    ],
  },
})
