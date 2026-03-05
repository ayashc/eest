// Головний процес Electron — тут живе "бекенд" нашого плеєра.
// Main process of Electron — this is where the "backend" of our player lives.

const { app, BrowserWindow, ipcMain, dialog } = require('electron')
const path = require('path')
const fs   = require('fs')
const os   = require('os')
const mm   = require('music-metadata')

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

ipcMain.handle('open-folder-dialog', async () => {
  const result = await dialog.showOpenDialog(mainWindow, { properties: ['openDirectory'] })
  return result.canceled ? null : result.filePaths[0]
})
ipcMain.handle('scan-folder', async (event, folderPath) => {
  const files = scanDir(folderPath), tracks = []
  for (const f of files) { const t = await parseTrack(f); if (t) tracks.push(t) }
  return tracks
})
ipcMain.handle('save-config',  (_, config) => { saveConfig(config); return true })
ipcMain.handle('load-config',  () => loadConfig())
ipcMain.handle('scan-saved-folders', async (_, folders) => {
  const all = []
  for (const folder of folders) {
    if (!fs.existsSync(folder)) continue
    for (const f of scanDir(folder)) { const t = await parseTrack(f); if (t) all.push(t) }
  }
  return all
})
ipcMain.on('window-minimize', () => mainWindow.minimize())
ipcMain.on('window-maximize', () => mainWindow.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize())
ipcMain.on('window-close',    () => mainWindow.close())

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

app.whenReady().then(createWindow)
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })