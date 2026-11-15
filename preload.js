// Give the page only the app actions it needs.
const electron = require('electron');

function listen(channel, callback) {
  electron.ipcRenderer.on(channel, function (_event, value) {
    callback(value);
  });
}

function startSelection() {
  return electron.ipcRenderer.invoke('start-selection');
}

function cancelSelection() {
  return electron.ipcRenderer.invoke('cancel-selection');
}

function finishSelection(image) {
  return electron.ipcRenderer.invoke('finish-selection', image);
}

function getHistory() {
  return electron.ipcRenderer.invoke('get-history');
}

function deleteHistoryItem(id) {
  return electron.ipcRenderer.invoke('delete-history-item', id);
}

function clearHistory() {
  return electron.ipcRenderer.invoke('clear-history');
}

function getShortcut() {
  return electron.ipcRenderer.invoke('get-shortcut');
}

function saveShortcut(shortcut) {
  return electron.ipcRenderer.invoke('save-shortcut', shortcut);
}

function copyText(text) {
  return electron.ipcRenderer.invoke('copy-text', text);
}

function saveTextFile(text) {
  return electron.ipcRenderer.invoke('save-text-file', text);
}

electron.contextBridge.exposeInMainWorld('snipscript', {
  startSelection: startSelection,
  cancelSelection: cancelSelection,
  finishSelection: finishSelection,
  retryOcr: function () {
    return electron.ipcRenderer.invoke('retry-ocr');
  },
  getHistory: getHistory,
  deleteHistoryItem: deleteHistoryItem,
  clearHistory: clearHistory,
  getShortcut: getShortcut,
  saveShortcut: saveShortcut,
  copyText: copyText,
  saveTextFile: saveTextFile,
  onScreenPicture: function (callback) {
    listen('screen-picture', callback);
  },
  onTextReady: function (callback) {
    listen('text-ready', callback);
  },
  onError: function (callback) {
    listen('show-error', callback);
  }
});
