const { spawnSync } = require('child_process');
const electronPath = require('electron');
const path = require('path');

const scriptPath = path.join(__dirname, 'protect-backend.js');

console.log(`[run-protect] Launching protection with Electron V8 runtime: ${electronPath}`);

const result = spawnSync(electronPath, [scriptPath], {
  stdio: 'inherit',
  env: {
    ...process.env,
    ELECTRON_RUN_AS_NODE: '1'
  }
});

if (result.status !== 0) {
  console.error(`[run-protect] Protection script failed with code ${result.status}`);
  process.exit(result.status || 1);
}

console.log('[run-protect] Backend protection completed successfully.');
