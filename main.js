// Main process: opens windows and uses Electron's desktop features.
const {
  app,
  BrowserWindow,
  clipboard,
  desktopCapturer,
  dialog,
  globalShortcut,
  ipcMain,
  screen
} = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { createWorker } = require('tesseract.js');

const DEFAULT_SHORTCUT = 'CommandOrControl+Shift+X';
const DATA_FOLDER = app.getPath('userData');
const SETTINGS_FILE = path.join(DATA_FOLDER, 'settings.json');
const HISTORY_FILE = path.join(DATA_FOLDER, 'history.json');

let mainWindow;
let overlayWindow;
let lastImage;
let ocrWorker;

// Read a JSON file. If it does not exist yet, use the given starting value.
function readJson(file, startingValue) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return startingValue;
  }
}

function saveJson(file, value) {
  fs.mkdirSync(DATA_FOLDER, { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2), 'utf8');
}

function getShortcut() {
  const settings = readJson(SETTINGS_FILE, {});
  return settings.shortcut || DEFAULT_SHORTCUT;
}

function getHistory() {
  const history = readJson(HISTORY_FILE, []);
  return Array.isArray(history) ? history : [];
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 720,
    minWidth: 780,
    minHeight: 600,
    title: 'SnipScript',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));
}

// Take a picture of the primary monitor and show the selection window.
async function startSelection() {
  if (overlayWindow) return;

  try {
    const display = screen.getPrimaryDisplay();
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width: 4096, height: 4096 }
    });
    let source = sources[0];
    for (let i = 0; i < sources.length; i += 1) {
      if (sources[i].display_id === String(display.id)) {
        source = sources[i];
        break;
      }
    }

    if (!source || source.thumbnail.isEmpty()) {
      throw new Error('The screen could not be captured. Check screen permissions.');
    }

    overlayWindow = new BrowserWindow({
      x: display.bounds.x,
      y: display.bounds.y,
      width: display.bounds.width,
      height: display.bounds.height,
      frame: false,
      transparent: true,
      fullscreen: true,
      alwaysOnTop: true,
      skipTaskbar: true,
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true
      }
    });

    overlayWindow.setAlwaysOnTop(true, 'screen-saver');
    overlayWindow.loadFile(path.join(__dirname, 'index.html'), {
      query: { mode: 'select' }
    });
    overlayWindow.webContents.once('did-finish-load', function () {
      overlayWindow.webContents.send('screen-picture', source.thumbnail.toDataURL());
    });
    overlayWindow.on('closed', function () {
      overlayWindow = null;
    });
  } catch (error) {
    overlayWindow = null;
    mainWindow.webContents.send('show-error', error.message);
  }
}

// Create the OCR worker the first time the user selects text.
async function readText(image) {
  if (!ocrWorker) {
    const languageFolder = path.join(
      __dirname,
      'node_modules',
      '@tesseract.js-data',
      'eng',
      '4.0.0_best_int'
    );

    ocrWorker = await createWorker('eng', 1, {
      langPath: languageFolder,
      cachePath: path.join(DATA_FOLDER, 'tessdata'),
      gzip: true
    });
  }

  const result = await ocrWorker.recognize(image);
  return result.data.text.trim();
}

function addToHistory(text) {
  const item = {
    id: Date.now().toString(),
    text,
    date: new Date().toISOString()
  };
  const history = [item, ...getHistory()].slice(0, 300);
  saveJson(HISTORY_FILE, history);
  return item;
}

async function finishOcr(image) {
  const text = await readText(image);
  const result = text ? addToHistory(text) : {
    id: Date.now().toString(),
    text: '',
    date: new Date().toISOString()
  };

  if (text) clipboard.writeText(text);
  mainWindow.show();
  mainWindow.webContents.send('text-ready', result);
  return result;
}

function setShortcut(newShortcut) {
  const oldShortcut = getShortcut();
  if (typeof newShortcut !== 'string' || newShortcut.length === 0 || newShortcut.length > 60) {
    throw new Error('Please enter a valid shortcut.');
  }

  globalShortcut.unregister(oldShortcut);
  let registered = false;

  try {
    registered = globalShortcut.register(newShortcut, startSelection);
  } catch {
    registered = false;
  }

  if (!registered) {
    globalShortcut.register(oldShortcut, startSelection);
    throw new Error('That shortcut is not available. Try another one.');
  }

  saveJson(SETTINGS_FILE, { shortcut: newShortcut });
  return newShortcut;
}

function registerActions() {
  ipcMain.handle('start-selection', startSelection);
  ipcMain.handle('cancel-selection', function () {
    if (overlayWindow) overlayWindow.close();
  });
  ipcMain.handle('finish-selection', async function (_event, image) {
    if (typeof image !== 'string' || !image.startsWith('data:image/png;base64,')) {
      throw new Error('The selected image is not valid.');
    }

    if (overlayWindow) overlayWindow.close();
    lastImage = image;

    try {
      return await finishOcr(image);
    } catch (error) {
      mainWindow.webContents.send('show-error', `OCR error: ${error.message}`);
      throw error;
    }
  });
  ipcMain.handle('retry-ocr', function () {
    if (!lastImage) throw new Error('Select a screen area first.');
    return finishOcr(lastImage);
  });
  ipcMain.handle('get-history', function () {
    return getHistory();
  });
  ipcMain.handle('delete-history-item', function (_event, id) {
    const oldHistory = getHistory();
    const newHistory = [];
    for (let i = 0; i < oldHistory.length; i += 1) {
      if (oldHistory[i].id !== id) newHistory.push(oldHistory[i]);
    }
    saveJson(HISTORY_FILE, newHistory);
  });
  ipcMain.handle('clear-history', function () {
    saveJson(HISTORY_FILE, []);
  });
  ipcMain.handle('get-shortcut', function () {
    return getShortcut();
  });
  ipcMain.handle('save-shortcut', function (_event, shortcut) {
    return setShortcut(shortcut);
  });
  ipcMain.handle('copy-text', function (_event, text) {
    clipboard.writeText(String(text).slice(0, 1000000));
  });
  ipcMain.handle('save-text-file', async function (_event, text) {
    const file = await dialog.showSaveDialog(mainWindow, {
      defaultPath: 'snipscript-text.txt',
      filters: [{ name: 'Text file', extensions: ['txt'] }]
    });

    if (!file.canceled && file.filePath) {
      fs.writeFileSync(file.filePath, text, 'utf8');
    }
    return !file.canceled;
  });
}

app.whenReady().then(function () {
  createWindow();
  registerActions();

  const shortcut = getShortcut();
  if (!globalShortcut.register(shortcut, startSelection)) {
    mainWindow.webContents.once('did-finish-load', function () {
      mainWindow.webContents.send('show-error', `Could not register ${shortcut}.`);
    });
  }
});

app.on('will-quit', function () {
  globalShortcut.unregisterAll();
  if (ocrWorker) ocrWorker.terminate();
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});
