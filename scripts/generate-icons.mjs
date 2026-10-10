// Generates PNG app icons from the SVG source. Run: npm run icons
import sharp from 'sharp';
import { readFileSync } from 'node:fs';
const svg = readFileSync('public/icons/favicon.svg');
const maskable = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" fill="#0b1324"/><g transform="translate(76 76) scale(0.703)"><path d="M120 300 L200 220 L270 280 L392 158" fill="none" stroke="#2fc6ad" stroke-width="44" stroke-linecap="round" stroke-linejoin="round"/><circle cx="392" cy="158" r="30" fill="#fff"/><rect x="120" y="360" width="272" height="30" rx="15" fill="#344e78"/></g></svg>`);
await sharp(svg).resize(192, 192).png().toFile('public/icons/icon-192.png');
await sharp(svg).resize(512, 512).png().toFile('public/icons/icon-512.png');
await sharp(svg).resize(180, 180).png().toFile('public/icons/apple-touch-icon.png');
await sharp(maskable).resize(512, 512).png().toFile('public/icons/maskable-512.png');
console.log('icons generated');
