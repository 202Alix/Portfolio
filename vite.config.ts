import { defineConfig } from 'vite'
import path from 'path'
import fs from 'fs'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import type { Connect } from 'vite'

function readBody(req: Connect.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (c: Buffer) => chunks.push(c))
    req.on('end', () => resolve(Buffer.concat(chunks).toString()))
    req.on('error', reject)
  })
}

function json(res: Connect.ServerResponse, data: unknown, status = 200) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(data))
}

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    {
      name: 'editor-api',
      configureServer(server) {
        // POST /api/upload — save image to public/projects/[id]/[filename]
        server.middlewares.use('/api/upload', async (req, res, next) => {
          if (req.method !== 'POST') return next()
          try {
            const body = JSON.parse(await readBody(req))
            const { projectId, filename, data } = body as {
              projectId: string; filename: string; data: string
            }
            const dir = path.resolve(__dirname, 'public/projects', projectId)
            fs.mkdirSync(dir, { recursive: true })
            fs.writeFileSync(path.join(dir, filename), Buffer.from(data, 'base64'))
            json(res, { path: `/projects/${projectId}/${filename}` })
          } catch (e) {
            json(res, { error: String(e) }, 500)
          }
        })

        // POST /api/save-project — write project JSON to src/data/projects/[id].json
        server.middlewares.use('/api/save-project', async (req, res, next) => {
          if (req.method !== 'POST') return next()
          try {
            const project = JSON.parse(await readBody(req))
            const dir = path.resolve(__dirname, 'src/data/projects')
            fs.mkdirSync(dir, { recursive: true })
            fs.writeFileSync(
              path.join(dir, `${project.id}.json`),
              JSON.stringify(project, null, 2)
            )
            json(res, { ok: true })
          } catch (e) {
            json(res, { error: String(e) }, 500)
          }
        })

        // DELETE /api/delete-project — remove src/data/projects/[id].json
        server.middlewares.use('/api/delete-project', async (req, res, next) => {
          if (req.method !== 'DELETE') return next()
          try {
            const { id } = JSON.parse(await readBody(req))
            const filePath = path.resolve(__dirname, 'src/data/projects', `${id}.json`)
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
            json(res, { ok: true })
          } catch (e) {
            json(res, { error: String(e) }, 500)
          }
        })

        // GET /api/list-projects — returns all project ids from src/data/projects/
        server.middlewares.use('/api/list-projects', async (req, res, next) => {
          if (req.method !== 'GET') return next()
          try {
            const dir = path.resolve(__dirname, 'src/data/projects')
            const files = fs.existsSync(dir)
              ? fs.readdirSync(dir).filter(f => f.endsWith('.json'))
              : []
            const data = files.map(f => {
              const content = fs.readFileSync(path.join(dir, f), 'utf-8')
              return JSON.parse(content)
            })
            json(res, data)
          } catch (e) {
            json(res, { error: String(e) }, 500)
          }
        })

        // GET /api/get-landing — returns src/data/landing.json
        server.middlewares.use('/api/get-landing', async (req, res, next) => {
          if (req.method !== 'GET') return next()
          try {
            const filePath = path.resolve(__dirname, 'src/data/landing.json')
            const content = fs.readFileSync(filePath, 'utf-8')
            json(res, JSON.parse(content))
          } catch (e) {
            json(res, { error: String(e) }, 500)
          }
        })

        // POST /api/save-landing — write src/data/landing.json
        server.middlewares.use('/api/save-landing', async (req, res, next) => {
          if (req.method !== 'POST') return next()
          try {
            const landing = JSON.parse(await readBody(req))
            const filePath = path.resolve(__dirname, 'src/data/landing.json')
            fs.writeFileSync(filePath, JSON.stringify(landing, null, 2))
            json(res, { ok: true })
          } catch (e) {
            json(res, { error: String(e) }, 500)
          }
        })
      }
    }
  ],
})
