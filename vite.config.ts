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
      const { claimStatus, handleClaim } = await server.ssrLoadModule('/server/claims.ts')
      let result
      if (req.method === 'GET') {
        const params = new URLSearchParams((req.url ?? '').split('?')[1] ?? '')
        result = params.has('claim') ? await claimStatus(params.get('claim') ?? '', env) : await slugAvailable(params.get('slug') ?? '', env)
      } else {
        const chunks: Buffer[] = []
        for await (const chunk of req) chunks.push(chunk as Buffer)
        let payload: unknown = null
        try {
          payload = JSON.parse(Buffer.concat(chunks).toString('utf8'))
        } catch {
          // handled by handleSignup as invalid input
        }
        const claim = payload && typeof payload === 'object' && 'claim' in payload
        result = claim ? await handleClaim(payload, req.socket.remoteAddress ?? 'local', env) : await handleSignup(payload, req.socket.remoteAddress ?? 'local', env)
      }
      res.statusCode = result.status
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify(result.body))
    })
    server.middlewares.use('/api/deposit', async (req, res) => {
      const chunks: Buffer[] = []
      for await (const chunk of req) chunks.push(chunk as Buffer)
      let payload: unknown = null
      try {
        payload = JSON.parse(Buffer.concat(chunks).toString('utf8'))
      } catch {
        // handled as invalid
      }
      const { handleDeposit } = await server.ssrLoadModule('/server/billing.ts')
      const result = await handleDeposit(payload, env)
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
    server.middlewares.use('/api/promo', async (req, res) => {
      const chunks: Buffer[] = []
      for await (const chunk of req) chunks.push(chunk as Buffer)
      let payload: unknown = null
      try {
        payload = JSON.parse(Buffer.concat(chunks).toString('utf8'))
      } catch {
        // handled by handlePromo as an unknown code
      }
      const { handlePromo } = await server.ssrLoadModule('/server/promos.ts')
      const { status, body } = await handlePromo(payload, req.socket.remoteAddress ?? 'local', env)
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

// The builder's code and 3D model are lazy-loaded, so a shop page used to fetch
// them one after another: app code, then the shop's config, then the builder
// chunk, then the model. This puts a small script at the top of the page that,
// on builder routes only (the landing page stays light), starts all of them at
// once while the app code is still downloading:
//   - <link rel="modulepreload"> for the builder's chunks (names known at build time);
//   - a preload for the 3D model (low priority: the code that draws it is needed first);
//   - the shop's config request, picked up later by loadTenant().
const builderPreload = (): Plugin => ({
  name: 'builder-preload',
  transformIndexHtml: {
    order: 'post',
    handler(_html, ctx) {
      const chunks = Object.values(ctx.bundle ?? {}).filter((item) => item.type === 'chunk')
      const entry = chunks.find((chunk) => chunk.isEntry)
      // What the page's own script already loads; everything else the builder needs is fetched early.
      const loaded = new Set<string>()
      const collect = (fileName: string, into: Set<string>) => {
        if (into.has(fileName) || loaded.has(fileName)) return
        into.add(fileName)
        chunks.find((chunk) => chunk.fileName === fileName)?.imports.forEach((name) => collect(name, into))
      }
      if (entry) collect(entry.fileName, loaded)
      const wanted = new Set<string>()
      chunks
        .filter((chunk) => /\/src\/components\/(Configurator|ShopPage)\.tsx$/.test(chunk.facadeModuleId ?? ''))
        .forEach((chunk) => collect(chunk.fileName, wanted))
      const files = [...wanted].map((fileName) => `/${fileName}`)
      const script = `(function(){try{var d=document,p=location.pathname,m=p.match(/^\\/b\\/([^/]+)/),c=d.querySelector('meta[name="vvs-shop"]'),s=m?decodeURIComponent(m[1]).toLowerCase():(c&&p==='/'?c.content:null);if(!s&&p!=='/configurator')return;var a=function(r,h,f){var l=d.createElement('link');l.rel=r;l.href=h;if(f){l.as='fetch';l.crossOrigin='anonymous';l.fetchPriority='low'}d.head.appendChild(l)};${JSON.stringify(files)}.forEach(function(h){a('modulepreload',h)});a('preload','/assets/teeth_final.glb',1);if(s&&!/[?&]preview=/.test(location.search))window.__vvsTenant={slug:s,response:fetch('/api/tenant/'+encodeURIComponent(s),{headers:{accept:'application/json'}})}}catch(e){}})();`
      return [{ tag: 'script', children: script, injectTo: 'body-prepend' }]
    },
  },
})

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react(), devRenderApi(env), builderPreload()],
  }
})
