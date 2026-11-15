# SnipScript

SnipScript is a small desktop app that turns words on your screen into editable text. Press the shortcut, select a screen area, and the app recognises and copies the text on your computer.

## Features

- Start selecting text with `Ctrl + Shift + X` or the button.
- Select a rectangle on the primary screen. Press `Escape` to cancel.
- Read English text locally using Tesseract.js.
- Edit, copy, retry, clear, or save the result as a text file.
- Save up to 300 results in local history. Reopen, delete, or clear them.
- Change the keyboard shortcut in Settings.

The current version supports English and the primary display. Hindi and additional monitor support can be added later. OCR quality depends on how clear the text is.

## Install and run

Install Node.js, open a terminal in this folder, then run:

```bash
npm install
npm start
```

The English OCR model is installed with the dependencies. After installation, OCR works offline. On macOS, allow screen recording in System Settings if capture is blocked.

## Build

```bash
npm run pack
npm run dist
```

The Windows build is configured to make an NSIS installer. Build and check it on Windows 10/11 for the best results.

## Main files

| File | What it does |
| --- | --- |
| `main.js` | Opens windows, captures the screen, runs OCR, and saves local data. |
| `preload.js` | Safely passes a few app actions to the page. |
| `index.html` | Holds the dashboard, history, settings, result, and selection screen. |
| `renderer.js` | Handles clicks, selection, and page updates. |
| `style.css` | Sets the colours, spacing, and layout. |
| `package.json` | Lists libraries and run/build commands. |

## How the code works

1. The global shortcut opens a screen-selection window.
2. The user drags over the text they want.
3. The page crops that rectangle and sends its image to `main.js`.
4. Tesseract.js reads the image on this computer.
5. SnipScript copies the text and saves it to local history.

Settings and history are stored as JSON in Electron's `userData` folder. SnipScript does not save screen images or upload data.

## Check after running

| Action | Expected result | Actual result |
| --- | --- | --- |
| Start the app | Dashboard appears | Fill in after running it on your computer |
| Press the shortcut | Screen selection opens | Fill in after running it on your computer |
| Select clear English text | Text is copied and shown | Fill in after running it on your computer |
| Save as TXT | A text file is created | Fill in after running it on your computer |
| Open history | Earlier results appear | Fill in after running it on your computer |

The local English OCR worker was checked during development. The full desktop window and Windows installer still need to be checked on your computer.

## Future improvements

Add Hindi and other languages, support more monitors, improve blurry-text recognition, and test the Windows installer.
# Snipscript
