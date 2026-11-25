/**
 * Genera los iconos de la PWA (public/icons/*.png) sin dependencias.
 * Dibuja la marca de `Brand`: una "o" blanca con un punto, sobre el azul primario.
 * Uso: node scripts/generate-icons.mjs
 *
 * El dibujo cabe en el 80 % central, así el mismo archivo sirve como icono normal
 * y como "maskable" (Android lo recorta en círculo, squircle, etc.).
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { crc32, deflateSync } from "node:zlib";

const PRIMARY = [59, 124, 236];
const WHITE = [244, 247, 255];
const DOT = [90, 168, 216];

/** Distancia con signo al círculo: negativa dentro. */
const circle = (x, y, cx, cy, r) => Math.hypot(x - cx, y - cy) - r;

/** Color del píxel (coordenadas 0..1) o null si es fondo. */
function paint(x, y) {
  const dotCx = 0.7;
  const dotCy = 0.3;

  // Punto: relleno claro con borde del color del fondo, como en la marca.
  if (circle(x, y, dotCx, dotCy, 0.1) <= 0) {
    return circle(x, y, dotCx, dotCy, 0.065) <= 0 ? DOT : PRIMARY;
  }
  // Anillo de la "o".
  const outer = circle(x, y, 0.5, 0.52, 0.27);
  const inner = circle(x, y, 0.5, 0.52, 0.155);
  if (outer <= 0 && inner > 0) return WHITE;
  return null;
}

function render(size) {
  const samples = 4;
  const raw = Buffer.alloc(size * (size * 4 + 1));

  for (let py = 0; py < size; py += 1) {
    raw[py * (size * 4 + 1)] = 0; // filtro "ninguno"
    for (let px = 0; px < size; px += 1) {
      let r = 0;
      let g = 0;
      let b = 0;
      for (let sy = 0; sy < samples; sy += 1) {
        for (let sx = 0; sx < samples; sx += 1) {
          const x = (px + (sx + 0.5) / samples) / size;
          const y = (py + (sy + 0.5) / samples) / size;
          const [cr, cg, cb] = paint(x, y) ?? PRIMARY;
          r += cr;
          g += cg;
          b += cb;
        }
      }
      const n = samples * samples;
      const offset = py * (size * 4 + 1) + 1 + px * 4;
      raw[offset] = Math.round(r / n);
      raw[offset + 1] = Math.round(g / n);
      raw[offset + 2] = Math.round(b / n);
      raw[offset + 3] = 255;
    }
  }
  return raw;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

function png(size) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8; // 8 bits por canal
  header[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(render(size), { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

mkdirSync("public/icons", { recursive: true });
for (const [name, size] of [
  ["icon-192.png", 192],
  ["icon-512.png", 512],
  ["apple-touch-icon.png", 180],
]) {
  writeFileSync(`public/icons/${name}`, png(size));
  console.log(`public/icons/${name} (${size}x${size})`);
}
