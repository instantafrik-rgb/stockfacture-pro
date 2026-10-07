import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

const publicDir = path.resolve('public');
const svgPath = path.join(publicDir, 'icon.svg');
const pngSourcePath = path.join(publicDir, 'icon.png');

async function generate() {
  const sourcePath = fs.existsSync(pngSourcePath) ? pngSourcePath : svgPath;
  if (!fs.existsSync(sourcePath)) {
    console.error('Source icon not found in public folder');
    return;
  }

  console.log(`Generating PWA icons from ${sourcePath}...`);
  const inputBuffer = fs.readFileSync(sourcePath);

  // 192x192 standard icon
  await sharp(inputBuffer)
    .resize(192, 192)
    .png()
    .toFile(path.join(publicDir, 'pwa-192x192.png'));

  // 512x512 standard icon
  await sharp(inputBuffer)
    .resize(512, 512)
    .png()
    .toFile(path.join(publicDir, 'pwa-512x512.png'));

  // 512x512 maskable icon (with safe 10% padding for Android adaptive icon)
  await sharp(inputBuffer)
    .resize(410, 410)
    .extend({
      top: 51,
      bottom: 51,
      left: 51,
      right: 51,
      background: '#0f172a',
    })
    .png()
    .toFile(path.join(publicDir, 'pwa-512x512-maskable.png'));

  // 180x180 Apple touch icon
  await sharp(inputBuffer)
    .resize(180, 180)
    .png()
    .toFile(path.join(publicDir, 'apple-touch-icon.png'));

  // Favicons
  await sharp(inputBuffer)
    .resize(32, 32)
    .png()
    .toFile(path.join(publicDir, 'favicon-32x32.png'));

  await sharp(inputBuffer)
    .resize(16, 16)
    .png()
    .toFile(path.join(publicDir, 'favicon-16x16.png'));

  console.log('PWA icons successfully generated.');
}

generate().catch(console.error);
