import fs from 'node:fs/promises'
import path from 'node:path'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

function sanitizeFileName(fileName: string) {
  const safeChars = [...fileName].map((char) => {
    const isReserved = '<>:"/\\|?*'.includes(char)
    return isReserved || char.charCodeAt(0) < 32 ? '_' : char
  })
  return safeChars.join('').replace(/\s+/g, ' ').trim() || 'uploaded-image'
}

function localUploadPlugin(): Plugin {
  return {
    name: 'allergy-lens-local-upload',
    configureServer(server) {
      server.middlewares.use('/api/local-upload', async (req, res) => {
        if (req.method !== 'GET') {
          res.statusCode = 405
          res.end(JSON.stringify({ error: 'Method not allowed' }))
          return
        }

        try {
          const requestedName = decodeURIComponent(req.url?.replace(/^\/+/, '') ?? '')
          const safeName = path.basename(requestedName)
          if (!safeName) {
            res.statusCode = 400
            res.end(JSON.stringify({ error: 'Missing file name' }))
            return
          }

          const uploadDir = path.resolve(server.config.root, 'local-uploads')
          const filePath = path.join(uploadDir, safeName)
          const image = await fs.readFile(filePath)
          res.setHeader('Content-Type', 'image/jpeg')
          res.setHeader('Cache-Control', 'no-store')
          res.end(image)
        } catch {
          res.statusCode = 404
          res.end(JSON.stringify({ error: 'Image not found' }))
        }
      })

      server.middlewares.use('/api/save-upload', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.end(JSON.stringify({ error: 'Method not allowed' }))
          return
        }

        let body = ''
        req.on('data', (chunk) => {
          body += chunk
        })
        req.on('end', async () => {
          try {
            const payload = JSON.parse(body) as { imageData?: string; sourceName?: string }
            const match = payload.imageData?.match(/^data:image\/(?:jpeg|jpg|png|webp);base64,(.+)$/)
            if (!match?.[1]) {
              res.statusCode = 400
              res.end(JSON.stringify({ error: 'Invalid image payload' }))
              return
            }

            const uploadDir = path.resolve(server.config.root, 'local-uploads')
            await fs.mkdir(uploadDir, { recursive: true })

            const baseName = sanitizeFileName(payload.sourceName ?? 'uploaded-image').replace(/\.[^.]+$/, '')
            const savedName = `${new Date().toISOString().replace(/[:.]/g, '-')}_${baseName}.jpg`
            const savedPath = path.join(uploadDir, savedName)
            await fs.writeFile(savedPath, Buffer.from(match[1], 'base64'))

            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ ok: true, fileName: savedName, path: savedPath }))
          } catch (error) {
            res.statusCode = 500
            res.end(JSON.stringify({ error: error instanceof Error ? error.message : 'Failed to save image' }))
          }
        })
      })
    },
  }
}

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  plugins: [react(), tailwindcss(), localUploadPlugin()],
})
