import { defineConfig } from 'vite'
import path from 'path'
import fs from 'fs'
import crypto from 'crypto'
import { execFile } from 'child_process'
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

// ─── Versions de fichiers ──────────────────────────────────────────────────
// Chaque lecture renvoie une empreinte du fichier ; chaque écriture doit fournir
// l'empreinte qu'elle a lue. Si le fichier a changé entre-temps (traduction, édition
// manuelle, autre onglet), l'écriture est refusée au lieu d'écraser le contenu.

const PROJECTS_DIR = path.resolve(__dirname, 'src/data/projects')
const LANDING_FILE = path.resolve(__dirname, 'src/data/landing.json')

function versionOf(filePath: string): string | null {
  if (!fs.existsSync(filePath)) return null
  return crypto.createHash('sha1').update(fs.readFileSync(filePath)).digest('hex')
}

function projectFile(id: unknown): string {
  if (typeof id !== 'string' || !/^[a-z0-9-]+$/.test(id)) throw new Error(`Identifiant de projet invalide : ${String(id)}`)
  return path.join(PROJECTS_DIR, `${id}.json`)
}

function conflict(res: Connect.ServerResponse, currentVersion: string | null) {
  json(res, { error: 'conflict', currentVersion }, 409)
}

// ─── Conversion WebP ───────────────────────────────────────────────────────
// Les PNG et JPG envoyés depuis l'éditeur sont convertis en WebP : seul le .webp est écrit.

const TO_WEBP = /\.(png|jpe?g)$/i
const WEBP_QUALITY = 85
const WEBP_MAX_SIDE = 2560 // largeur ou hauteur max ; jamais d'agrandissement

async function toWebp(input: Buffer): Promise<{ data: Buffer; width: number; height: number }> {
  const { default: sharp } = await import('sharp') // chargé seulement par l'éditeur local, jamais par le build du site
  const { data, info } = await sharp(input)
    .rotate() // respecte l'orientation des photos
    .resize({ width: WEBP_MAX_SIDE, height: WEBP_MAX_SIDE, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: WEBP_QUALITY })
    .toBuffer({ resolveWithObject: true })
  return { data, width: info.width, height: info.height }
}

// ─── Publication (git) ─────────────────────────────────────────────────────
// Ne publie que le contenu : textes des projets, page d'accueil, images, vidéos et CV.

const CONTENT_PATHS = ['src/data', 'public/projects']
const OUTSIDE_CONTENT = ['.', ...CONTENT_PATHS.map((p) => `:(exclude)${p}`)]
const MAX_FILE_MB = 95 // GitHub refuse les fichiers de plus de 100 Mo
const HEAVY_FILE_MB = 15

function git(args: string[], timeout = 60_000): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile('git', args, { cwd: __dirname, timeout, maxBuffer: 10 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) reject(new Error((stderr || err.message).trim()))
      else resolve(stdout)
    })
  })
}

type ChangedFile = { path: string; status: 'added' | 'modified' | 'deleted'; sizeMB: number | null }

async function contentChanges(): Promise<ChangedFile[]> {
  const out = await git(['status', '--porcelain=v1', '-z', '--untracked-files=all', '--', ...CONTENT_PATHS])
  const parts = out.split('\0').filter(Boolean)
  const files: ChangedFile[] = []
  for (let i = 0; i < parts.length; i++) {
    const code = parts[i].slice(0, 2)
    const file = parts[i].slice(3)
    if (code.includes('R') || code.includes('C')) i++ // le chemin d'origine suit
    const status = code.includes('D') ? 'deleted' : code === '??' || code.includes('A') ? 'added' : 'modified'
    const abs = path.join(__dirname, file)
    const sizeMB = status !== 'deleted' && fs.existsSync(abs) ? fs.statSync(abs).size / 1024 / 1024 : null
    files.push({ path: file, status, sizeMB })
  }
  return files
}

async function outsideChanges(): Promise<string[]> {
  const out = await git(['status', '--porcelain=v1', '--untracked-files=normal', '--', ...OUTSIDE_CONTENT])
  return out.split('\n').filter(Boolean).map((l) => l.slice(3))
}

function projectTitle(file: string): string | null {
  const m = file.match(/^src\/data\/projects\/([^/]+)\.json$/)
  if (!m) return null
  try {
    const p = JSON.parse(fs.readFileSync(path.join(__dirname, file), 'utf-8'))
    const title = typeof p.title === 'string' ? p.title : p.title?.fr || p.title?.en
    return title || m[1]
  } catch {
    return m[1]
  }
}

async function publishState(doFetch: boolean) {
  const blockers: string[] = []
  const warnings: string[] = []

  const branch = (await git(['rev-parse', '--abbrev-ref', 'HEAD'])).trim()
  if (branch !== 'main') blockers.push(`Le projet est sur la branche « ${branch} » et non « main ».`)

  const gitDir = path.join(__dirname, '.git')
  if (['rebase-merge', 'rebase-apply', 'MERGE_HEAD'].some((f) => fs.existsSync(path.join(gitDir, f)))) {
    blockers.push('Une fusion de versions est en cours dans git. Il faut la terminer avant de publier.')
  }

  let offline = false
  if (doFetch) {
    try {
      await git(['fetch', 'origin', 'main'], 20_000)
    } catch {
      offline = true
      warnings.push('Impossible de joindre GitHub (pas de connexion ?). La publication échouera tant que la connexion n’est pas revenue.')
    }
  }

  let behind = 0
  let ahead = 0
  try {
    const [b, a] = (await git(['rev-list', '--left-right', '--count', 'origin/main...HEAD'])).trim().split(/\s+/).map(Number)
    behind = b
    ahead = a
  } catch { /* pas encore de branche distante */ }
  if (behind > 0) warnings.push(`GitHub a ${behind} version(s) plus récente(s). Elles seront récupérées automatiquement avant la publication.`)

  // Des modifications du code déjà enregistrées mais pas en ligne partiraient avec la publication : on bloque.
  const unpublishedCode = (await git(['log', 'origin/main..HEAD', '--format=%h %s', '--', ...OUTSIDE_CONTENT])).split('\n').filter(Boolean)
  if (unpublishedCode.length) {
    blockers.push('Des modifications du code du site sont enregistrées mais pas encore en ligne. Elles doivent être publiées séparément, pas depuis l’éditeur.')
  }
  const unpublishedContent = (await git(['log', 'origin/main..HEAD', '--format=%s', '--', ...CONTENT_PATHS])).split('\n').filter(Boolean)

  const files = await contentChanges()
  for (const f of files) {
    if (f.sizeMB !== null && f.sizeMB > MAX_FILE_MB) blockers.push(`${f.path} pèse ${f.sizeMB.toFixed(0)} Mo : GitHub refuse les fichiers de plus de 100 Mo. Compresse-le avant de publier.`)
    else if (f.sizeMB !== null && f.sizeMB > HEAVY_FILE_MB) warnings.push(`${f.path} pèse ${f.sizeMB.toFixed(0)} Mo : il ralentira le chargement du site, surtout sur mobile.`)
  }

  let lastPublished: string | null = null
  try {
    lastPublished = (await git(['log', '-1', '--format=%cI', 'origin/main'])).trim() || null
  } catch { /* rien */ }

  return {
    files: files.map((f) => ({ ...f, title: projectTitle(f.path) })),
    unpublishedContent,
    outside: await outsideChanges(),
    ahead,
    behind,
    offline,
    blockers,
    warnings,
    lastPublished,
  }
}

let publishing = false

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
            const original = Buffer.from(data, 'base64')

            if (TO_WEBP.test(filename)) {
              const webpName = filename.replace(TO_WEBP, '.webp')
              const { data: webp, width, height } = await toWebp(original)
              fs.writeFileSync(path.join(dir, webpName), webp)
              return json(res, {
                path: `/projects/${projectId}/${webpName}`,
                converted: { from: filename, originalSize: original.length, size: webp.length, width, height },
              })
            }

            fs.writeFileSync(path.join(dir, filename), original)
            json(res, { path: `/projects/${projectId}/${filename}` })
          } catch (e) {
            json(res, { error: String(e) }, 500)
          }
        })

        // POST /api/save-project — { project, expectedVersion, force? } → src/data/projects/[id].json
        server.middlewares.use('/api/save-project', async (req, res, next) => {
          if (req.method !== 'POST') return next()
          try {
            const { project, expectedVersion, force } = JSON.parse(await readBody(req))
            const filePath = projectFile(project?.id)
            const current = versionOf(filePath)
            if (!force && current !== (expectedVersion ?? null)) return conflict(res, current)
            fs.mkdirSync(PROJECTS_DIR, { recursive: true })
            fs.writeFileSync(filePath, JSON.stringify(project, null, 2))
            json(res, { ok: true, version: versionOf(filePath) })
          } catch (e) {
            json(res, { error: String(e) }, 500)
          }
        })

        // DELETE /api/delete-project — { id, expectedVersion, force? }
        server.middlewares.use('/api/delete-project', async (req, res, next) => {
          if (req.method !== 'DELETE') return next()
          try {
            const { id, expectedVersion, force } = JSON.parse(await readBody(req))
            const filePath = projectFile(id)
            const current = versionOf(filePath)
            if (!force && current !== null && current !== (expectedVersion ?? null)) return conflict(res, current)
            if (current !== null) fs.unlinkSync(filePath)
            json(res, { ok: true })
          } catch (e) {
            json(res, { error: String(e) }, 500)
          }
        })

        // GET /api/list-projects — [{ project, version }]
        server.middlewares.use('/api/list-projects', async (req, res, next) => {
          if (req.method !== 'GET') return next()
          try {
            const files = fs.existsSync(PROJECTS_DIR)
              ? fs.readdirSync(PROJECTS_DIR).filter(f => f.endsWith('.json'))
              : []
            const data = files.map(f => {
              const filePath = path.join(PROJECTS_DIR, f)
              return { project: JSON.parse(fs.readFileSync(filePath, 'utf-8')), version: versionOf(filePath) }
            })
            json(res, data)
          } catch (e) {
            json(res, { error: String(e) }, 500)
          }
        })

        // GET /api/get-landing — { landing, version }
        server.middlewares.use('/api/get-landing', async (req, res, next) => {
          if (req.method !== 'GET') return next()
          try {
            json(res, { landing: JSON.parse(fs.readFileSync(LANDING_FILE, 'utf-8')), version: versionOf(LANDING_FILE) })
          } catch (e) {
            json(res, { error: String(e) }, 500)
          }
        })

        // POST /api/save-landing — { landing, expectedVersion, force? }
        server.middlewares.use('/api/save-landing', async (req, res, next) => {
          if (req.method !== 'POST') return next()
          try {
            const { landing, expectedVersion, force } = JSON.parse(await readBody(req))
            const current = versionOf(LANDING_FILE)
            if (!force && current !== (expectedVersion ?? null)) return conflict(res, current)
            fs.writeFileSync(LANDING_FILE, JSON.stringify(landing, null, 2))
            json(res, { ok: true, version: versionOf(LANDING_FILE) })
          } catch (e) {
            json(res, { error: String(e) }, 500)
          }
        })

        // GET /api/publish-status?fetch=1 — ce qui partirait en ligne, et ce qui bloque
        server.middlewares.use('/api/publish-status', async (req, res, next) => {
          if (req.method !== 'GET') return next()
          try {
            const doFetch = new URL(req.url ?? '', 'http://localhost').searchParams.get('fetch') === '1'
            json(res, await publishState(doFetch))
          } catch (e) {
            json(res, { error: String(e) }, 500)
          }
        })

        // POST /api/publish — { message } : enregistre le contenu dans git et l'envoie sur GitHub
        server.middlewares.use('/api/publish', async (req, res, next) => {
          if (req.method !== 'POST') return next()
          if (publishing) return json(res, { error: 'Une publication est déjà en cours.' }, 409)
          publishing = true
          try {
            const { message } = JSON.parse(await readBody(req))
            const text = typeof message === 'string' ? message.trim() : ''
            if (!text) return json(res, { error: 'Ajoute une courte description de la mise à jour.' }, 400)

            const state = await publishState(true)
            if (state.offline) return json(res, { error: 'Impossible de joindre GitHub. Vérifie ta connexion et réessaie. Rien n’a été mis en ligne.' }, 503)
            if (state.blockers.length) return json(res, { error: state.blockers.join('\n') }, 409)
            if (!state.files.length && !state.ahead) return json(res, { error: 'Rien à publier : le site est déjà à jour.' }, 400)

            // 1. Enregistrer uniquement le contenu (le code du site n'est jamais inclus)
            if (state.files.length) {
              await git(['add', '-A', '--', ...CONTENT_PATHS])
              await git(['commit', '-m', text.slice(0, 200), '--', ...CONTENT_PATHS])
            }

            // 2. Récupérer les versions plus récentes de GitHub, s'il y en a
            if (state.behind > 0) {
              try {
                await git(['rebase', '--autostash', 'origin/main'])
              } catch {
                await git(['rebase', '--abort']).catch(() => {})
                return json(res, {
                  error: 'La version en ligne contient des changements qui touchent les mêmes fichiers. Rien n’a été mis en ligne. Ta mise à jour est gardée sur ton Mac : demande de l’aide pour combiner les deux versions.',
                }, 409)
              }
            }

            // 3. Envoyer sur GitHub (Vercel met ensuite le site à jour)
            try {
              await git(['push', 'origin', 'HEAD:main'], 120_000)
            } catch {
              return json(res, {
                error: 'GitHub a refusé l’envoi ou la connexion a coupé. Rien n’a été mis en ligne. Ta mise à jour est gardée sur ton Mac : clique à nouveau sur Publier pour réessayer.',
              }, 502)
            }

            const commit = (await git(['rev-parse', '--short', 'HEAD'])).trim()
            json(res, { ok: true, commit, lastPublished: new Date().toISOString() })
          } catch (e) {
            json(res, { error: String(e) }, 500)
          } finally {
            publishing = false
          }
        })
      }
    }
  ],
})
