/**
 * Converts assets/icon.png → assets/icon.ico using sharp + manual ICO encoding
 * Run: node convert-icon.js
 */
const fs = require('fs');
const path = require('path');

async function convertToIco() {
  let sharp;
  try {
    sharp = require('sharp');
  } catch (e) {
    console.log('sharp not found, installing...');
    require('child_process').execSync('npm install sharp --save-dev', { stdio: 'inherit', cwd: __dirname });
    sharp = require('sharp');
  }

  const inputPath  = path.join(__dirname, 'assets', 'icon.png');
  const outputPath = path.join(__dirname, 'assets', 'icon.ico');

  // ICO requires multiple sizes: 16, 24, 32, 48, 64, 128, 256
  const sizes = [16, 24, 32, 48, 64, 128, 256];
  const pngBuffers = await Promise.all(
    sizes.map(size =>
      sharp(inputPath)
        .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png()
        .toBuffer()
    )
  );

  // Build ICO file manually
  // ICO header: 6 bytes
  // ICONDIRENTRY: 16 bytes per image
  // Image data follows
  const numImages = sizes.length;
  const headerSize = 6;
  const dirEntrySize = 16 * numImages;
  let dataOffset = headerSize + dirEntrySize;

  // ICO Header
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);        // Reserved, must be 0
  header.writeUInt16LE(1, 2);        // Type: 1 = ICO
  header.writeUInt16LE(numImages, 4); // Number of images

  const dirEntries = [];
  const imageDataParts = [];

  for (let i = 0; i < sizes.length; i++) {
    const size = sizes[i];
    const pngData = pngBuffers[i];
    const entry = Buffer.alloc(16);
    entry.writeUInt8(size === 256 ? 0 : size, 0);  // Width (0 = 256)
    entry.writeUInt8(size === 256 ? 0 : size, 1);  // Height (0 = 256)
    entry.writeUInt8(0, 2);                          // Color count (0 = >256 colors)
    entry.writeUInt8(0, 3);                          // Reserved
    entry.writeUInt16LE(1, 4);                       // Color planes
    entry.writeUInt16LE(32, 6);                      // Bits per pixel
    entry.writeUInt32LE(pngData.length, 8);          // Size of image data
    entry.writeUInt32LE(dataOffset, 12);             // Offset of image data
    dirEntries.push(entry);
    imageDataParts.push(pngData);
    dataOffset += pngData.length;
  }

  const icoBuffer = Buffer.concat([header, ...dirEntries, ...imageDataParts]);
  fs.writeFileSync(outputPath, icoBuffer);

  console.log(`✅ ICO created: ${outputPath} (${(icoBuffer.length / 1024).toFixed(1)} KB)`);
  console.log(`   Sizes: ${sizes.join(', ')} px`);
}

convertToIco().catch(console.error);
