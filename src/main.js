const { app, BrowserWindow, ipcMain, dialog } = require('electron')
const path = require('path')
const fs = require('fs')
const os = require('os')
const mm = require('music-metadata')

let mainWindow

const AUDIO_EXTS = new Set([
  '.mp3', '.flac', '.wav', '.ogg', '.aac', '.m4a', '.opus', '.wma',
  '.dsf', '.dff', '.ape', '.aiff', '.aif', '.wv', '.alac'
])

const CONFIG_PATH = path.join(app.getPath('userData'), 'eest-config.json')
const DEFAULT_CONFIG = {
  folders: [],
  mixtape: [],
  ambience: { enabled: false, mode: 'off', intensity: 0.18, runout: '60s' },
  stats: { plays: {}, albumPlays: {}, trackTime: {}, totalSeconds: 0, lastPlayed: [] }
}

function log(level, ...args) {
  const ts = new Date().toISOString()
  console[level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log'](`[${ts}] [${level.toUpperCase()}]`, ...args)
}

function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const raw = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'))
      return {
        ...DEFAULT_CONFIG,
        ...raw,
        ambience: { ...DEFAULT_CONFIG.ambience, ...(raw.ambience || {}) },
        stats: { ...DEFAULT_CONFIG.stats, ...(raw.stats || {}) }
      }
    }
  } catch (e) {
    log('warn', 'Failed to load config:', e.message)
  }
  return { ...DEFAULT_CONFIG }
}

function saveConfig(config) {
  try {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8')
    return true
  } catch (e) {
    log('warn', 'Failed to save config:', e.message)
    return false
  }
}

function scanDir(dirPath) {
  let files = []
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true })
    for (const entry of entries) {
      const full = path.join(dirPath, entry.name)
      if (entry.isDirectory()) files = files.concat(scanDir(full))
      else if (AUDIO_EXTS.has(path.extname(entry.name).toLowerCase()) && !entry.name.startsWith('._')) files.push(full)
    }
  } catch (e) {
    log('warn', 'scanDir failed for', dirPath, e.message)
  }
  return files
}

async function parseTrack(filePath) {
  try {
    const { common, format } = await mm.parseFile(filePath, { duration: true, skipCovers: false })
    let cover = null
    if (common.picture?.length) {
      const pic = common.picture[0]
      const fmt = pic.format?.includes('/') ? pic.format : `image/${pic.format || 'jpeg'}`
      cover = `data:${fmt};base64,${Buffer.from(pic.data).toString('base64')}`
    }
    return {
      path: filePath,
      title: common.title || path.basename(filePath, path.extname(filePath)),
      artist: common.artist || common.albumartist || 'Unknown Artist',
      albumArtist: common.albumartist || common.artist || 'Unknown Artist',
      album: common.album || 'Unknown Album',
      year: common.year || null,
      trackNo: common.track?.no || 0,
      trackTotal: common.track?.of || 0,
      disc: common.disk?.no || 1,
      discTotal: common.disk?.of || 1,
      duration: format.duration || 0,
      genre: common.genre || [],
      bpm: common.bpm || null,
      key: common.key || null,
      cover,
      quality: {
        container: format.container || null,
        codec: format.codec || null,
        bitrate: format.bitrate || null,
        sampleRate: format.sampleRate || null,
        bitsPerSample: format.bitsPerSample || null,
      }
    }
  } catch (e) {
    log('warn', 'parseTrack failed for', filePath, e.message)
    return null
  }
}

async function parseAll(files, concurrency = 8) {
  const out = []
  let i = 0
  async function worker() {
    while (i < files.length) {
      const idx = i++
      const t = await parseTrack(files[idx])
      if (t) out.push(t)
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, files.length || 1) }, worker))
  return out
}

ipcMain.handle('open-folder-dialog', async () => {
  const result = await dialog.showOpenDialog(mainWindow, { properties: ['openDirectory'] })
  return result.canceled ? null : result.filePaths[0]
})
ipcMain.handle('save-config', (_, config) => saveConfig(config))
ipcMain.handle('load-config', () => loadConfig())
ipcMain.handle('scan-saved-folders', async (_, folders) => {
  const files = []
  for (const folder of folders || []) {
    if (!folder || !fs.existsSync(folder)) continue
    files.push(...scanDir(folder))
  }
  log('info', 'Scanning', files.length, 'audio files')
  return parseAll(files, 8)
})
ipcMain.on('window-minimize', () => mainWindow?.minimize())
ipcMain.on('window-maximize', () => mainWindow?.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize())
ipcMain.on('window-close', () => mainWindow?.close())

function createWindow() {
  const build = parseInt(os.release().split('.')[2] || '0', 10)
  const isWin11 = process.platform === 'win32' && build >= 22000
  mainWindow = new BrowserWindow({
    width: 1320,
    height: 860,
    minWidth: 1040,
    minHeight: 680,
    frame: false,
    transparent: isWin11,
    backgroundColor: isWin11 ? '#00000000' : '#0b0b10',
    backgroundMaterial: isWin11 ? 'acrylic' : undefined,
    webPreferences: { nodeIntegration: true, contextIsolation: false }
  })
  mainWindow.loadFile(path.join(__dirname, 'index.html'))
}

app.whenReady().then(() => {
  log('info', 'App starting')
  createWindow()
})
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
