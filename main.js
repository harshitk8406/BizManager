const { app, BrowserWindow } = require('electron');
const path = require('path');

let mainWindow;

// Start the Node.js Express backend inline
function startBackend() {
  // Pass environment variables to the backend
  process.env.NODE_ENV = 'production';
  process.env.PORT = '5000';

  console.log('Starting backend server inline...');
  try {
    // Require the backend server directly
    require('./backend/server.js');
  } catch (err) {
    console.error('Failed to start backend server:', err);
  }
}

// Create the Electron Window
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    },
    title: "BizManager"
  });

  const url = 'http://localhost:5000';

  const loadApp = () => {
    if (!mainWindow) return;
    mainWindow.loadURL(url).catch((err) => {
      console.log('Failed to connect, retrying in 500ms...', err.message);
      setTimeout(loadApp, 500);
    });
  };

  // Listen for fail-load and retry (handles server not being fully ready yet)
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    console.log(`Failed to load: ${errorDescription} (${errorCode}). Retrying in 1s...`);
    setTimeout(loadApp, 1000);
  });

  loadApp();

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// App Lifecycle Events
app.on('ready', () => {
  startBackend();
  createWindow();
});

// Clean up processes on exit
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('will-quit', () => {
  console.log('Stopping background services...');
});
