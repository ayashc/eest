// Eest — main process (Electron backend)
// Українською + English comments, по-людськи.

const { app, BrowserWindow, ipcMain, dialog } = require('electron')
const path = require('path')
const fs   = require('fs')
const os   = require('os')
const mm   = require('music-metadata')

// ──────────────────────────────────────────────────────────────
// Logging
// Пишемо логи в файл (userData/eest.log) + в консоль.
// Write logs to file (userData/eest.log) + to console.
function logPath() {
  try { return path.join(app.getPath('userData'), 'eest.log') } catch (_) { return null }
}

function mlog(level, ...args) {
  const ts = new Date().toISOString()
  const msg = args
    .map(a => (typeof a === 'string') ? a : (() => { try { return JSON.stringify(a) } catch { return String(a) } })())
    .join(' ')
  const line = `[${ts}] [${String(level).toUpperCase()}] ${msg}\n`

  try {
    const p = logPath()
    if (p) fs.appendFileSync(p, line, 'utf-8')
  } catch (_) {}

  if (level === 'error') console.error(line.trim())
  else if (level === 'warn') console.warn(line.trim())
  else console.log(line.trim())
}

process.on('uncaughtException', (err) => {
  mlog('error', 'uncaughtException', err?.stack || err?.message || String(err))
})
process.on('unhandledRejection', (reason) => {
  mlog('error', 'unhandledRejection', reason?.stack || reason?.message || String(reason))
})

// ──────────────────────────────────────────────────────────────
// App state
let mainWindow

const AUDIO_EXTS = new Set([
  '.mp3', '.flac', '.wav', '.ogg', '.aac',
  '.m4a', '.opus', '.wma', '.dsf', '.dff',
  '.ape', '.aiff', '.aif', '.wv', '.alac'
])

const CONFIG_PATH = path.join(app.getPath('userData'), 'eest-config.json')

function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_PATH)) return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'))
  } catch (e) {
    mlog('warn', 'loadConfig failed', e?.message || String(e))
  }
  // folders — звідки сканимо
  // mixtape — масив шляхів (path) у порядку користувача
  // ambience — налаштування шумів (опціонально)
  // stats — слухацька статистика
  return {
    folders: [],
    mixtape: [],
    ambience: { enabled: false, mode: 'auto', intensity: 0.18, runout: '60s' },
    stats: { totalSeconds: 0, tracks: {}, albums: {} }
  }
}

function saveConfig(config) {
  try {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8')
  } catch (e) {
    mlog('warn', 'saveConfig failed', e?.message || String(e))
  }
}

function scanDir(dirPath) {
  let files = []
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name)
      if (entry.isDirectory()) {
        files = files.concat(scanDir(fullPath))
      } else if (
        AUDIO_EXTS.has(path.extname(entry.name).toLowerCase()) &&
        !entry.name.startsWith('._') // macOS “._” junk
      ) {
        files.push(fullPath)
      }
    }
  } catch (e) {}
  return files
}

async function parseTrack(filePath) {
  try {
    const { common, format } = await mm.parseFile(filePath, { duration: true, skipCovers: false })

    let cover = null
    if (common.picture?.length > 0) {
      const pic = common.picture[0]
      const fmt = pic.format.includes('/') ? pic.format : `image/${pic.format}`
      cover = `data:${fmt};base64,${Buffer.from(pic.data).toString('base64')}`
    }

    return {
      path:        filePath,
      title:       common.title       || path.basename(filePath, path.extname(filePath)),
      artist:      common.artist      || common.albumartist || 'Unknown Artist',
      albumArtist: common.albumartist || common.artist      || 'Unknown Artist',
      album:       common.album       || 'Unknown Album',
      year:        common.year        || null,

      // Для “повний альбом чи фрагменти”
      // For “full album vs fragments”
      trackNo:     common.track?.no   || 0,
      trackTotal:  common.track?.of   || 0,
      disc:        common.disk?.no    || 1,
      discTotal:   common.disk?.of    || 0,

      duration:    format.duration    || 0,
      genre:       common.genre       || [],
      bpm:         common.bpm         || null,
      key:         common.key         || null,
      cover,

      quality: {
        container:     format.container     || null,
        codec:         format.codec         || null,
        bitrate:       format.bitrate       || null,
        sampleRate:    format.sampleRate    || null,
        bitsPerSample: format.bitsPerSample || null,
      }
    }
  } catch (e) {
    return null
  }
}

async function parseAll(files, concurrency = 6) {
  const out = []
  let i = 0
  async function worker() {
    while (i < files.length) {
      const f = files[i++]
      const t = await parseTrack(f)
      if (t) out.push(t)
    }
  }
  const n = Math.max(1, Math.min(concurrency, files.length))
  await Promise.all(Array.from({ length: n }, worker))
  return out
}

// ──────────────────────────────────────────────────────────────
// IPC handlers
ipcMain.handle('open-folder-dialog', async () => {
  const result = await dialog.showOpenDialog(mainWindow, { properties: ['openDirectory'] })
  return result.canceled ? null : result.filePaths[0]
})

ipcMain.handle('scan-folder', async (_, folderPath) => {
  mlog('info', 'scan-folder', folderPath)
  const files = scanDir(folderPath)
  mlog('info', `scan-folder found ${files.length} files`)
  const tracks = await parseAll(files, 6)
  mlog('info', `scan-folder parsed ${tracks.length} tracks`)
  return tracks
})

ipcMain.handle('scan-saved-folders', async (_, folders) => {
  mlog('info', 'scan-saved-folders', folders)
  const allFiles = []
  for (const folder of folders || []) {
    if (!folder || !fs.existsSync(folder)) continue
    allFiles.push(...scanDir(folder))
  }
  const tracks = await parseAll(allFiles, 6)
  mlog('info', `scan-saved-folders parsed ${tracks.length} tracks`)
  return tracks
})

ipcMain.handle('load-config', () => loadConfig())
ipcMain.handle('save-config', (_, config) => { saveConfig(config); return true })

ipcMain.on('renderer-log', (_, payload) => {
  if (!payload) return
  mlog(payload.level || 'info', payload.message || '')
})

ipcMain.on('window-minimize', () => mainWindow?.minimize())
ipcMain.on('window-maximize', () => mainWindow?.isMaximized() ? mainWindow.unmaximize() : mainWindow?.maximize())
ipcMain.on('window-close',    () => mainWindow?.close())

// ──────────────────────────────────────────────────────────────
// Window
mlog('info', 'App starting')

function createWindow() {
  const build   = parseInt(os.release().split('.')[2] || '0')
  const isWin11 = process.platform === 'win32' && build >= 22000

  mainWindow = new BrowserWindow({
    width: 1300,
    height: 840,
    minWidth: 980,
    minHeight: 620,
    frame: false,
    transparent:        isWin11,
    backgroundColor:    isWin11 ? '#00000000' : '#0d0d10',
    backgroundMaterial: isWin11 ? 'acrylic' : undefined,
    webPreferences: { nodeIntegration: true, contextIsolation: false }
  })

  mainWindow.loadFile(path.join(__dirname, 'index.html'))
}

app.whenReady().then(() => {
  mlog('info', 'Log file:', logPath())
  createWindow()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})