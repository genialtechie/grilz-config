import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

// Serves /api/render and /api/tenant during `npm run dev` with the same handlers Vercel uses,
// so the AI render works locally when FLUX_API_KEY is set in .env.local.
const devRenderApi = (env: Record<string, string>): Plugin => ({
  name: 'dev-render-api',
  configureServer(server) {
    server.middlewares.use('/api/tenant/', async (req, res) => {
      const [path, query = ''] = (req.url ?? '').replace(/^\//, '').split('?')
      const slug = decodeURIComponent(path).toLowerCase()
      const preview = new URLSearchParams(query).get('preview')
      const token = req.headers.authorization?.replace(/^Bearer\s+/i, '') ?? null
      const { handleTenant } = await server.ssrLoadModule('/server/tenantApi.ts')
      const { handlePreview } = await server.ssrLoadModule('/server/preview.ts')
      const { status, body, headers } = preview ? await handlePreview(slug, Number(preview), token, env) : await handleTenant(slug, env)
      res.statusCode = status
      Object.entries(headers as Record<string, string>).forEach(([key, value]) => res.setHeader(key, value))
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify(body))
    })
    server.middlewares.use('/api/dashboard/', async (req, res) => {
      if (req.method !== 'POST') {
        res.statusCode = 405
        res.end()
        return
      }
      const action = (req.url ?? '').replace(/^\//, '').split('?')[0]
      const chunks: Buffer[] = []
      for await (const chunk of req) chunks.push(chunk as Buffer)
      let payload: unknown = null
      try {
        payload = JSON.parse(Buffer.concat(chunks).toString('utf8'))
      } catch {
        // handled by handleDashboard as an invalid request
      }
      const token = req.headers.authorization?.replace(/^Bearer\s+/i, '') ?? null
      const { handleDashboard } = await server.ssrLoadModule('/server/dashboard.ts')
      const { status, body, headers } = await handleDashboard(action, payload, token, env)
      res.statusCode = status
      Object.entries(headers as Record<string, string>).forEach(([key, value]) => res.setHeader(key, value))
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify(body))
    })
    server.middlewares.use('/api/signup', async (req, res) => {
      const { handleSignup, slugAvailable } = await server.ssrLoadModule('/server/signup.ts')
      let result
      if (req.method === 'GET') {
        result = await slugAvailable(new URLSearchParams((req.url ?? '').split('?')[1] ?? '').get('slug') ?? '', env)
      } else {
        const chunks: Buffer[] = []
        for await (const chunk of req) chunks.push(chunk as Buffer)
        let payload: unknown = null
        try {
          payload = JSON.parse(Buffer.concat(chunks).toString('utf8'))
        } catch {
          // handled by handleSignup as invalid input
        }
        result = await handleSignup(payload, req.socket.remoteAddress ?? 'local', env)
      }
      res.statusCode = result.status
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify(result.body))
    })
    server.middlewares.use('/api/leads', async (req, res) => {
      if (req.method !== 'POST') {
        res.statusCode = 405
        res.end()
        return
      }
      const chunks: Buffer[] = []
      for await (const chunk of req) chunks.push(chunk as Buffer)
      let payload: unknown = null
      try {
        payload = JSON.parse(Buffer.concat(chunks).toString('utf8'))
      } catch {
        // handled by handleLead as an invalid request
      }
      const { handleLead } = await server.ssrLoadModule('/server/leads.ts')
      const { status, body } = await handleLead(payload, req.socket.remoteAddress ?? 'local', env, (work: Promise<unknown>) => void work)
      res.statusCode = status
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify(body))
    })
    server.middlewares.use('/api/render', async (req, res) => {
      if (req.method !== 'POST') {
        res.statusCode = 405
        res.end()
        return
      }
      const chunks: Buffer[] = []
      for await (const chunk of req) chunks.push(chunk as Buffer)
      let payload: unknown = null
      try {
        payload = JSON.parse(Buffer.concat(chunks).toString('utf8'))
      } catch {
        // handled by handleRender as an invalid request
      }
      const { handleRender } = await server.ssrLoadModule('/server/render.ts')
      const { status, body } = await handleRender(payload, req.socket.remoteAddress ?? 'local', env)
      res.statusCode = status
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify(body))
    })
  },
})

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react(), devRenderApi(env)],
  }
})
