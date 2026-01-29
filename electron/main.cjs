const { app, BrowserWindow, BrowserView, ipcMain, dialog } = require('electron')
const path = require('path')
const fs = require('fs')
const { autoUpdater } = require('electron-updater')
const { createClient } = require('@supabase/supabase-js')

const isDev = !app.isPackaged

const APP_URL = process.env.BA9ALINO_APP_URL || 'https://ba9alino.netlify.app/'
const DEV_URL = process.env.ELECTRON_RENDERER_URL || 'http://localhost:5173'

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY

let mainWindow = null
let view = null

function getStorePath(filename) {
  return path.join(app.getPath('userData'), filename)
}

function readJson(file, fallback) {
  try {
    const p = getStorePath(file)
    if (!fs.existsSync(p)) return fallback
    const txt = fs.readFileSync(p, 'utf8')
    return JSON.parse(txt)
  } catch {
    return fallback
  }
}

function writeJson(file, value) {
  const p = getStorePath(file)
  fs.writeFileSync(p, JSON.stringify(value, null, 2), 'utf8')
}

function getSupabase() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error('Missing SUPABASE_URL / SUPABASE_ANON_KEY env vars')
  }
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  })
}

function sendToRenderer(channel, payload) {
  if (mainWindow && mainWindow.webContents) {
    mainWindow.webContents.send(channel, payload)
  }
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    backgroundColor: '#0b1220',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })

  mainWindow.on('closed', () => {
    mainWindow = null
    view = null
  })

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'))

  // BrowserView for the deployed web app
  view = new BrowserView({
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })

  mainWindow.setBrowserView(view)

  const resize = () => {
    const bounds = mainWindow.getContentBounds()
    const toolbarHeight = 56
    view.setBounds({ x: 0, y: toolbarHeight, width: bounds.width, height: bounds.height - toolbarHeight })
    view.setAutoResize({ width: true, height: true })
  }

  mainWindow.on('resize', resize)
  mainWindow.on('maximize', resize)
  mainWindow.on('unmaximize', resize)
  resize()

  const targetUrl = isDev ? DEV_URL : APP_URL
  view.webContents.loadURL(targetUrl)

  if (isDev) {
    view.webContents.openDevTools({ mode: 'detach' })
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  }
}

function setupAutoUpdater() {
  autoUpdater.setFeedURL({
    provider: 'github',
    owner: 'essaihi04',
    repo: 'ba9alino',
    releaseType: 'release'
  })

  autoUpdater.autoDownload = false

  autoUpdater.on('checking-for-update', () => sendToRenderer('updater:status', { status: 'checking' }))
  autoUpdater.on('update-available', (info) => sendToRenderer('updater:status', { status: 'available', info }))
  autoUpdater.on('update-not-available', (info) => sendToRenderer('updater:status', { status: 'not-available', info }))
  autoUpdater.on('download-progress', (progress) => sendToRenderer('updater:download-progress', progress))
  autoUpdater.on('update-downloaded', (info) => sendToRenderer('updater:status', { status: 'downloaded', info }))
  autoUpdater.on('error', (err) => sendToRenderer('updater:status', { status: 'error', error: String(err?.message || err) }))
}

function setupIpc() {
  ipcMain.handle('app:getVersion', async () => app.getVersion())
  ipcMain.handle('app:getTargetUrl', async () => (isDev ? DEV_URL : APP_URL))

  // Updater
  ipcMain.handle('updater:check', async () => {
    try {
      await autoUpdater.checkForUpdates()
      return { ok: true }
    } catch (e) {
      return { ok: false, error: String(e?.message || e) }
    }
  })

  ipcMain.handle('updater:download', async () => {
    try {
      await autoUpdater.downloadUpdate()
      return { ok: true }
    } catch (e) {
      return { ok: false, error: String(e?.message || e) }
    }
  })

  ipcMain.handle('updater:quitAndInstall', async () => {
    autoUpdater.quitAndInstall()
    return { ok: true }
  })

  // Supabase auth/session store (local)
  ipcMain.handle('supabase:getSession', async () => {
    return readJson('supabase_session.json', null)
  })

  ipcMain.handle('supabase:signOut', async () => {
    writeJson('supabase_session.json', null)
    return { ok: true }
  })

  ipcMain.handle('supabase:signInWithPassword', async (_evt, { email, password }) => {
    const supabase = getSupabase()
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) return { ok: false, error: error.message }
    writeJson('supabase_session.json', data.session)
    return { ok: true, session: data.session, user: data.user }
  })

  ipcMain.handle('supabase:products:list', async () => {
    const supabase = getSupabase()
    const session = readJson('supabase_session.json', null)

    // If you require auth for this query, you can enforce session here.
    // For now, we query with anon key and rely on Supabase RLS.
    if (session?.access_token) {
      supabase.auth.setSession({
        access_token: session.access_token,
        refresh_token: session.refresh_token
      }).catch(() => {})
    }

    const { data, error } = await supabase
      .from('products')
      .select('id, name_ar, sku, barcode, price_a, price_b, price_c, price_d, price_e, stock, category_id, image_url')
      .eq('is_active', true)
      .limit(200)

    if (error) return { ok: false, error: error.message }

    // Local cache
    writeJson('products_cache.json', { updated_at: new Date().toISOString(), data })
    return { ok: true, data }
  })

  ipcMain.handle('supabase:products:cache', async () => {
    return readJson('products_cache.json', { updated_at: null, data: [] })
  })

  ipcMain.handle('supabase:sales:sync', async (_evt, payload) => {
    // Placeholder: implement your sales sync here.
    // Store unsent payload locally to allow offline mode.
    const queue = readJson('sales_queue.json', [])
    queue.push({ id: Date.now(), created_at: new Date().toISOString(), payload })
    writeJson('sales_queue.json', queue)
    return { ok: true, queued: true, size: queue.length }
  })

  ipcMain.handle('supabase:sales:queue', async () => {
    return readJson('sales_queue.json', [])
  })

  ipcMain.handle('dialog:showError', async (_evt, { title, message }) => {
    await dialog.showMessageBox({ type: 'error', title: title || 'Error', message: message || 'Unknown error' })
    return { ok: true }
  })
}

app.whenReady().then(() => {
  createMainWindow()
  setupAutoUpdater()
  setupIpc()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
