const { app, BrowserWindow } = require('electron');
const path = require('path');

let mainWindow;

// Start the Node.js Express backend inline
function startBackend() {
  // Pass environment variables to the backend
  process.env.NODE_ENV = 'production';
  process.env.PORT = '5000';
  // Pass the app root path so backend can resolve frontend/dist correctly
  // even when running from inside an ASAR archive
  process.env.APP_PATH = app.getAppPath();

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

  // Load the frontend HTML file directly — no HTTP serving needed.
  // app.getAppPath() returns the real resources/app directory (asar:false).
  // API calls (http://localhost:5000/api) still go through Express.
  const indexPath = path.join(app.getAppPath(), 'frontend', 'dist', 'index.html');
  console.log('Loading frontend from:', indexPath);
  mainWindow.loadFile(indexPath);

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
