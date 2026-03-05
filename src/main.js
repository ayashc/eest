// Головний процес Electron — тут живе "бекенд" нашого плеєра.
// Main process of Electron — this is where the "backend" of our player lives.

const { app, BrowserWindow, ipcMain, dialog } = require('electron')
const path = require('path')
const fs   = require('fs')
const os   = require('os')
const mm   = require('music-metadata')

// ─── Логи ─────────────────────────────────────────────────────
// Пишемо логи в файл (userData/eest.log) + у консоль.
// Write logs to file (userData/eest.log) + console.
function logPath() {
  try { return path.join(app.getPath('userData'), 'eest.log') } catch (_) { return null }
}
function mlog(level, ...args) {
  const ts = new Date().toISOString()
  const msg = args.map(a => typeof a === 'string' ? a : (() => { try { return JSON.stringify(a) } catch { return String(a) } })()).join(' ')
  const line = `[${ts}] [${String(level).toUpperCase()}] ${msg}\n`
  try {
    const p = logPath()
    if (p) fs.appendFileSync(p, line, 'utf-8')
  } catch (_) {}

  // І в stdout/stderr теж — корисно коли запускаєш з терміналу
  // Also to stdout/stderr — useful when running from terminal
  if (level === 'error') console.error(line.trim())
  else if (level === 'warn') console.warn(line.trim())
  else console.log(line.trim())
}

// Ловимо падіння main процесу, щоб не було "просто закрився" без слідів.
// Catch main process crashes so we have traces.
process.on('uncaughtException', (err) => {
  mlog('error', 'uncaughtException', err?.stack || err?.message || String(err))
})
process.on('unhandledRejection', (reason) => {
  mlog('error', 'unhandledRejection', reason?.stack || reason?.message || String(reason))
})


let mainWindow

const AUDIO_EXTS = new Set([
  '.mp3', '.flac', '.wav', '.ogg', '.aac',
  '.m4a', '.opus', '.wma', '.dsf', '.dff',
  '.ape', '.aiff', '.aif', '.wv', '.alac'
])

const CONFIG_PATH = path.join(app.getPath('userData'), 'eest-config.json')

function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_PATH))
      return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'))
  } catch (e) {}
  return { folders: [] }
}

function saveConfig(config) {
  try {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8')
  } catch (e) {}
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
        !entry.name.startsWith('._')
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
      trackNo:     common.track?.no   || 0,
      disc:        common.disk?.no    || 1,
      duration:    format.duration    || 0,
      genre:       common.genre       || [],
      bpm:         common.bpm        || null,
      key:         common.key        || null,
      cover,
      quality: {
        container:     format.container     || null,
        codec:         format.codec         || null,
        bitrate:       format.bitrate       || null,
        sampleRate:    format.sampleRate    || null,
        bitsPerSample: format.bitsPerSample || null,
      }
    }
  } catch (e) { return null }
}


async function parseAll(files, concurrency = 6) {
  // Паралельний парсинг з лімітом — швидше сканування на великих бібліотеках.
  // Parallel parsing with a limit — faster scanning for big libraries.
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

ipcMain.handle('open-folder-dialog', async () => {
  const result = await dialog.showOpenDialog(mainWindow, { properties: ['openDirectory'] })
  return result.canceled ? null : result.filePaths[0]
})
ipcMain.handle('scan-folder', async (event, folderPath) => {
  mlog('info', 'scan-folder', folderPath)
  const files = scanDir(folderPath)
  mlog('info', `scan-folder found ${files.length} files`)
  const tracks = await parseAll(files, 6)
  mlog('info', `scan-folder parsed ${tracks.length} tracks`)
  return tracks
})
ipcMain.handle('save-config',  (_, config) => { saveConfig(config); return true })
ipcMain.handle('load-config',  () => loadConfig())
ipcMain.handle('scan-saved-folders', async (_, folders) => {
  mlog('info', 'scan-saved-folders', folders)
  const allFiles = []
  for (const folder of folders) {
    if (!fs.existsSync(folder)) continue
    allFiles.push(...scanDir(folder))
  }
  return await parseAll(allFiles, 6)
})
ipcMain.on('window-minimize', () => mainWindow.minimize())
ipcMain.on('window-maximize', () => mainWindow.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize())
ipcMain.on('window-close',    () => mainWindow.close())

// Логи з рендерера (index.html) — пишемо в той самий eest.log
// Logs from renderer (index.html) — append to same eest.log
ipcMain.on('renderer-log', (_, payload) => {
  if (!payload) return
  mlog(payload.level || 'info', payload.message || '')
})

mlog('info', 'App starting')

function createWindow() {
  // Перевіряємо чи Win11 (build 22000+) — тільки там підтримується acrylic з прозорістю
  // Check if Win11 (build 22000+) — only there acrylic transparency is supported properly
  const build   = parseInt(os.release().split('.')[2] || '0')
  const isWin11 = process.platform === 'win32' && build >= 22000

  mainWindow = new BrowserWindow({
    width: 1300, height: 840, minWidth: 960, minHeight: 600,
    frame: false,
    // Win11: справжнє скло з розмитим робочим столом / Win11: real glass with blurred desktop
    // Win10: темний непрозорий фон як fallback / Win10: dark opaque background as fallback
    transparent:        isWin11,
    backgroundColor:    isWin11 ? '#00000000' : '#0d0d10',
    backgroundMaterial: isWin11 ? 'acrylic'   : undefined,
    webPreferences: { nodeIntegration: true, contextIsolation: false }
  })
  mainWindow.loadFile('src/index.html')
}

app.whenReady().then(() => {
  mlog('info', 'Log file:', logPath())
  createWindow()
})
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })