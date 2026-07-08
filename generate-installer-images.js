/**
 * Generates installer header (150x57px) and uninstaller sidebar (164x314px) 
 * using sharp + SVG rendering. Run after convert-icon.js
 * node generate-installer-images.js
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const assetsDir = path.join(__dirname, 'assets');

async function generateInstallerHeader() {
  // 150x57 NSIS header image - white bg with green accent
  const svg = `
<svg width="150" height="57" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="100%" stop-color="#f0fdf4"/>
    </linearGradient>
  </defs>
  
  <!-- Background -->
  <rect width="150" height="57" fill="url(#bg)"/>
  
  <!-- Left green accent bar -->
  <rect width="4" height="57" fill="#16a34a"/>
  
  <!-- B icon circle -->
  <circle cx="25" cy="28" r="16" fill="#0f4c2a"/>
  <text x="25" y="34" font-family="Arial, sans-serif" font-weight="900" font-size="18" fill="white" text-anchor="middle">B</text>
  
  <!-- App name -->
  <text x="48" y="24" font-family="Arial, sans-serif" font-weight="700" font-size="13" fill="#0f172a">BizManager</text>
  
  <!-- Subtitle -->
  <text x="48" y="38" font-family="Arial, sans-serif" font-weight="400" font-size="7.5" fill="#64748b">Business Management Solution</text>
  
  <!-- Bottom accent line -->
  <rect y="54" width="150" height="3" fill="#16a34a"/>
</svg>`;

  await sharp(Buffer.from(svg))
    .resize(150, 57)
    .png()
    .toFile(path.join(assetsDir, 'installer-header.png'));

  console.log('✅ installer-header.png created (150x57)');
}

async function generateUninstallerHeader() {
  // Same header used for uninstaller
  const svg = `
<svg width="150" height="57" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg2" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="100%" stop-color="#fef2f2"/>
    </linearGradient>
  </defs>
  <rect width="150" height="57" fill="url(#bg2)"/>
  <rect width="4" height="57" fill="#dc2626"/>
  <circle cx="25" cy="28" r="16" fill="#7f1d1d"/>
  <text x="25" y="34" font-family="Arial, sans-serif" font-weight="900" font-size="18" fill="white" text-anchor="middle">B</text>
  <text x="48" y="24" font-family="Arial, sans-serif" font-weight="700" font-size="13" fill="#0f172a">BizManager</text>
  <text x="48" y="38" font-family="Arial, sans-serif" font-weight="400" font-size="7.5" fill="#64748b">Uninstall</text>
  <rect y="54" width="150" height="3" fill="#dc2626"/>
</svg>`;

  await sharp(Buffer.from(svg))
    .resize(150, 57)
    .png()
    .toFile(path.join(assetsDir, 'uninstaller-header.png'));

  console.log('✅ uninstaller-header.png created (150x57)');
}

async function resizeSidebar() {
  // Resize the AI-generated sidebar to exact 164x314
  const sidebarSrc = path.join(assetsDir, 'installer-sidebar.png');
  if (fs.existsSync(sidebarSrc)) {
    await sharp(sidebarSrc)
      .resize(164, 314, { fit: 'cover', position: 'center' })
      .png()
      .toFile(path.join(assetsDir, 'installer-sidebar-164.png'));
    console.log('✅ installer-sidebar-164.png created (164x314)');

    // Copy as uninstaller sidebar too
    await sharp(sidebarSrc)
      .resize(164, 314, { fit: 'cover', position: 'center' })
      .png()
      .toFile(path.join(assetsDir, 'uninstaller-sidebar-164.png'));
    console.log('✅ uninstaller-sidebar-164.png created (164x314)');
  }
}

async function main() {
  await generateInstallerHeader();
  await generateUninstallerHeader();
  await resizeSidebar();
  console.log('\nAll installer images generated!');
}

main().catch(console.error);
