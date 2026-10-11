const fs = require('fs');
const path = require('path');
const JavaScriptObfuscator = require('javascript-obfuscator');
const bytenode = require('bytenode');

const projectRoot = path.resolve(__dirname, '..');
const backendSrcDir = path.join(projectRoot, 'backend');
const backendBuildDir = path.join(projectRoot, 'build-backend');

console.log('[protect] Starting backend obfuscation and bytecode compilation...');
console.log(`[protect] Source: ${backendSrcDir}`);
console.log(`[protect] Target: ${backendBuildDir}`);

// 1. Clean and prepare build-backend directory
if (fs.existsSync(backendBuildDir)) {
  fs.rmSync(backendBuildDir, { recursive: true, force: true });
}
fs.mkdirSync(backendBuildDir, { recursive: true });

// 2. Helper to copy folder recursively
function copyDirRecursive(src, dest, ignoreList = []) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    if (ignoreList.includes(entry.name)) continue;
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath, ignoreList);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

// Copy runtime files
const ignoreFiles = [
  'node_modules',
  'migrate.js',
  'sync-db.js',
  'sync-indexes.js',
  'update-gstin.js',
  'update-username.js',
  'package-lock.json'
];

copyDirRecursive(backendSrcDir, backendBuildDir, ignoreFiles);
console.log('[protect] Backend source files copied to build-backend.');

// 3. Collect all .js files
function getAllJsFiles(dir, fileList = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      getAllJsFiles(fullPath, fileList);
    } else if (entry.isFile() && entry.name.endsWith('.js')) {
      fileList.push(fullPath);
    }
  }
  return fileList;
}

const jsFiles = getAllJsFiles(backendBuildDir);
console.log(`[protect] Found ${jsFiles.length} JavaScript files to protect.`);

// Obfuscator options
const obfuscatorOptions = {
  compact: true,
  controlFlowFlattening: true,
  controlFlowFlatteningThreshold: 0.75,
  deadCodeInjection: false,
  debugProtection: false,
  disableConsoleOutput: false,
  identifierNamesGenerator: 'hexadecimal',
  log: false,
  numbersToExpressions: true,
  renameGlobals: false,
  rotateStringArray: true,
  selfDefending: false,
  simplify: true,
  splitStrings: true,
  splitStringsChunkLength: 10,
  stringArray: true,
  stringArrayEncoding: ['base64'],
  stringArrayThreshold: 0.8,
  transformObjectKeys: true,
  unicodeEscapeSequence: false
};

async function protectAll() {
  const serverJsPath = path.join(backendBuildDir, 'server.js');

  for (const file of jsFiles) {
    const relativePath = path.relative(backendBuildDir, file);
    process.stdout.write(`[protect] Processing ${relativePath}... `);

    // Read original code
    const originalCode = fs.readFileSync(file, 'utf-8');

    // Step A: Obfuscate
    const obfuscated = JavaScriptObfuscator.obfuscate(originalCode, obfuscatorOptions).getObfuscatedCode();
    fs.writeFileSync(file, obfuscated, 'utf-8');

    // Step B: Compile to V8 Bytecode (.jsc)
    const jscFile = file.replace(/\.js$/, '.jsc');
    await bytenode.compileFile({
      filename: file,
      output: jscFile
    });

    // Step C: If this is server.js, replace it with a tiny loader.
    // Otherwise, remove the .js file completely so only .jsc remains.
    if (path.resolve(file) === path.resolve(serverJsPath)) {
      const loaderCode = `const path = require('path');\nrequire('dotenv').config({ path: path.join(__dirname, '.env') });\nrequire('bytenode');\nrequire('./server.jsc');\n`;
      fs.writeFileSync(file, loaderCode, 'utf-8');
      console.log(`compiled & created loader.`);
    } else {
      fs.unlinkSync(file);
      console.log(`compiled to .jsc and removed .js.`);
    }
  }

  console.log('[protect] All backend files successfully obfuscated and converted to V8 bytecode (.jsc)!');
}

protectAll().catch(err => {
  console.error('[protect] Error protecting backend files:', err);
  process.exit(1);
});
