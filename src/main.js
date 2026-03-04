// Головний процес Electron — тут живе "бекенд" нашого плеєра.
// Main process of Electron — this is where the "backend" of our player lives.

const { app, BrowserWindow, ipcMain, dialog } = require('electron')
const path = require('path')
const fs   = require('fs')
const mm   = require('music-metadata')

let mainWindow

// Список форматів які ми вміємо грати (майже все що існує)
// List of audio formats we support (basically everything that exists)
const AUDIO_EXTS = new Set([
  '.mp3', '.flac', '.wav', '.ogg', '.aac',
  '.m4a', '.opus', '.wma', '.dsf', '.dff',
  '.ape', '.aiff', '.aif', '.wv', '.alac'
])

// Файл конфіга — зберігаємо тут налаштування між сесіями
// Config file — we store settings here between sessions
const CONFIG_PATH = path.join(app.getPath('userData'), 'eest-config.json')

function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_PATH))
      return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'))
  } catch (e) {
    // якщо файл битий — просто починаємо з нуля
    // if the config file is corrupted — start fresh
  }
  return { folders: [] }
}

function saveConfig(config) {
  try {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8')
  } catch (e) {
    console.error('Не вдалось зберегти конфіг / Could not save config:', e)
  }
}

// Рекурсивно обходимо папку і збираємо всі аудіофайли
// Recursively walk a directory and collect all audio files
function scanDir(dirPath) {
  let files = []
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name)
      if (entry.isDirectory()) {
        files = files.concat(scanDir(fullPath))
      } else if (AUDIO_EXTS.has(path.extname(entry.name).toLowerCase())) {
        files.push(fullPath)
      }
    }
  } catch (e) {
    // немає прав або битий шлях — тихо пропускаємо
    // no permissions or broken path — skip silently
  }
  return files
}

// Витягуємо метадані з одного файлу
// Extract metadata from a single audio file
async function parseTrack(filePath) {
  try {
    const { common, format } = await mm.parseFile(filePath, {
      duration: true,
      skipCovers: false
    })

    // Обкладинку конвертуємо в base64 щоб можна показати в HTML без file:// проблем
    // Convert cover art to base64 so it works in HTML without file:// issues
    let cover = null
    if (common.picture && common.picture.length > 0) {
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
      cover
    }
  } catch (e) {
    return null // файл нечитабельний — повертаємо null / unreadable file — return null
  }
}

// ─── IPC — зв'язок між main і renderer (інтерфейсом) ─────────
// ─── IPC — communication between main process and renderer ───

ipcMain.handle('open-folder-dialog', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory']
  })
  return result.canceled ? null : result.filePaths[0]
})

// Сканування однієї папки — повертає масив треків
// Scan one folder — returns array of tracks
ipcMain.handle('scan-folder', async (event, folderPath) => {
  const files  = scanDir(folderPath)
  const tracks = []
  for (const filePath of files) {
    const track = await parseTrack(filePath)
    if (track) tracks.push(track)
  }
  return tracks
})

// Зберегти список папок в конфіг
// Save folder list to config
ipcMain.handle('save-config', (event, config) => {
  saveConfig(config)
  return true
})

// Прочитати конфіг при запуску — щоб знати які папки вже були додані
// Read config on startup — so we know which folders were already added
ipcMain.handle('load-config', () => loadConfig())

// При старті сканує всі збережені папки одразу
// On startup — scans all previously saved folders at once
ipcMain.handle('scan-saved-folders', async (event, folders) => {
  const allTracks = []
  for (const folder of folders) {
    if (!fs.existsSync(folder)) continue // папка зникла (диск від'єднано і тп) / folder is gone (drive disconnected etc)
    const files = scanDir(folder)
    for (const filePath of files) {
      const track = await parseTrack(filePath)
      if (track) allTracks.push(track)
    }
  }
  return allTracks
})

// Стандартні кнопки вікна — мінімізація, повноекранний, закрити
// Standard window buttons — minimize, maximize, close
ipcMain.on('window-minimize', () => mainWindow.minimize())
ipcMain.on('window-maximize', () => {
  mainWindow.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize()
})
ipcMain.on('window-close',    () => mainWindow.close())

// ─── Вікно ────────────────────────────────────────────────────
// ─── Window ───────────────────────────────────────────────────
function createWindow() {
  mainWindow = new BrowserWindow({
    width:     1300,
    height:    840,
    minWidth:  960,
    minHeight: 600,
    frame:     false, // прибираємо стандартний тайтлбар Windows / remove default Windows titlebar
    webPreferences: {
      nodeIntegration:  true,
      contextIsolation: false
    },
    backgroundColor: '#09090b'
  })
  mainWindow.loadFile('src/index.html')
}

app.whenReady().then(createWindow)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})