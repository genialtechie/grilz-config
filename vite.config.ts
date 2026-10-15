import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

// Serves /api/render during `npm run dev` with the same handler Vercel uses,
// so the AI render works locally when FLUX_API_KEY is set in .env.local.
const devRenderApi = (env: Record<string, string>): Plugin => ({
  name: 'dev-render-api',
  configureServer(server) {
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
