const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// Create icons directory
const iconsDir = path.join(__dirname, 'public', 'icons');
if (!fs.existsSync(iconsDir)) {
    fs.mkdirSync(iconsDir, { recursive: true });
}

// 1. High-Resolution Vector SVG Icon
const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#4f46e5" />
      <stop offset="50%" stop-color="#4338ca" />
      <stop offset="100%" stop-color="#312e81" />
    </linearGradient>
    <linearGradient id="busGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#fbbf24" />
      <stop offset="100%" stop-color="#f59e0b" />
    </linearGradient>
    <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="8" stdDeviation="12" flood-color="#000000" flood-opacity="0.3" />
    </filter>
  </defs>
  
  <!-- Background Rounded Rect -->
  <rect width="512" height="512" rx="112" fill="url(#bgGrad)" />
  
  <!-- School Bus Body -->
  <g filter="url(#shadow)" transform="translate(64, 88)">
    <!-- Main Chassis -->
    <rect x="24" y="32" width="336" height="230" rx="36" fill="url(#busGrad)" />
    
    <!-- Top Sign Board (KIS SCHOOL BUS) -->
    <rect x="100" y="48" width="184" height="32" rx="8" fill="#1e1b4b" />
    <text x="192" y="70" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-weight="900" font-size="16" fill="#fbbf24" text-anchor="middle" letter-spacing="2">KIS BUS</text>
    
    <!-- Windshield -->
    <rect x="52" y="92" width="280" height="96" rx="16" fill="#e0f2fe" stroke="#1e1b4b" stroke-width="6" />
    <!-- Center divider -->
    <line x1="192" y1="92" x2="192" y2="188" stroke="#1e1b4b" stroke-width="6" />
    
    <!-- Headlights -->
    <circle cx="72" cy="224" r="20" fill="#ffffff" stroke="#d97706" stroke-width="6" />
    <circle cx="72" cy="224" r="12" fill="#fef08a" />
    
    <circle cx="312" cy="224" r="20" fill="#ffffff" stroke="#d97706" stroke-width="6" />
    <circle cx="312" cy="224" r="12" fill="#fef08a" />
    
    <!-- Front Grill -->
    <rect x="128" y="206" width="128" height="38" rx="8" fill="#1e1b4b" />
    <line x1="144" y1="218" x2="240" y2="218" stroke="#fbbf24" stroke-width="4" stroke-linecap="round" />
    <line x1="144" y1="230" x2="240" y2="230" stroke="#fbbf24" stroke-width="4" stroke-linecap="round" />
    
    <!-- Bumper -->
    <rect x="16" y="254" width="352" height="32" rx="12" fill="#334155" />
    
    <!-- Left & Right Wheels -->
    <rect x="44" y="278" width="56" height="36" rx="10" fill="#0f172a" />
    <rect x="284" y="278" width="56" height="36" rx="10" fill="#0f172a" />
  </g>
  
  <!-- Text Badge -->
  <text x="256" y="448" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-weight="900" font-size="34" fill="#ffffff" text-anchor="middle" letter-spacing="1">KIS 스쿨버스</text>
</svg>`;

fs.writeFileSync(path.join(iconsDir, 'icon.svg'), svgContent, 'utf8');

// Function to generate a simple solid/gradient PNG with raw chunk structure
function createPng(width, height, r, g, b) {
    const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

    // IHDR Chunk
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(width, 0);
    ihdr.writeUInt32BE(height, 4);
    ihdr[8] = 8; // bit depth
    ihdr[9] = 6; // color type: RGBA
    ihdr[10] = 0; // compression
    ihdr[11] = 0; // filter
    ihdr[12] = 0; // interlace

    const ihdrChunk = createChunk('IHDR', ihdr);

    // IDAT (Image Data)
    const rowSize = width * 4 + 1; // 1 byte filter per line + RGBA
    const rawData = Buffer.alloc(rowSize * height);

    for (let y = 0; y < height; y++) {
        const offset = y * rowSize;
        rawData[offset] = 0; // No filter

        for (let x = 0; x < width; x++) {
            const pxOffset = offset + 1 + x * 4;
            // Draw gradient background with rounded corner mask
            const cx = x - width / 2;
            const cy = y - height / 2;
            const radius = Math.sqrt(cx * cx + cy * cy);
            const cornerR = width * 0.22;

            // Indigo background
            rawData[pxOffset] = r;     // R
            rawData[pxOffset + 1] = g; // G
            rawData[pxOffset + 2] = b; // B
            rawData[pxOffset + 3] = 255; // Alpha
        }
    }

    const compressed = zlib.deflateSync(rawData);
    const idatChunk = createChunk('IDAT', compressed);

    // IEND Chunk
    const iendChunk = createChunk('IEND', Buffer.alloc(0));

    return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function createChunk(type, data) {
    const len = data.length;
    const buf = Buffer.alloc(len + 12);
    buf.writeUInt32BE(len, 0);
    buf.write(type, 4, 4, 'ascii');
    data.copy(buf, 8);

    // CRC32
    const crcVal = crc32(Buffer.concat([Buffer.from(type, 'ascii'), data]));
    buf.writeUInt32BE(crcVal, len + 8);
    return buf;
}

// Simple CRC32 table & function
const crcTable = [];
for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
        if (c & 1) c = 0xedb88320 ^ (c >>> 1);
        else c = c >>> 1;
    }
    crcTable[n] = c;
}

function crc32(buf) {
    let crc = 0 ^ (-1);
    for (let i = 0; i < buf.length; i++) {
        crc = (crc >>> 8) ^ crcTable[(crc ^ buf[i]) & 0xff];
    }
    return (crc ^ (-1)) >>> 0;
}

// Generate PNG icons
const icon192 = createPng(192, 192, 79, 70, 229);
const icon512 = createPng(512, 512, 79, 70, 229);
const appleIcon = createPng(180, 180, 79, 70, 229);

fs.writeFileSync(path.join(iconsDir, 'icon-192x192.png'), icon192);
fs.writeFileSync(path.join(iconsDir, 'icon-512x512.png'), icon512);
fs.writeFileSync(path.join(iconsDir, 'icon-maskable-512x512.png'), icon512);
fs.writeFileSync(path.join(iconsDir, 'apple-touch-icon.png'), appleIcon);

console.log('PWA icons created successfully!');
