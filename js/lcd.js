import * as THREE from 'three';
import { glyph } from './font.js?v=3';

export class Lcd {
  constructor(w = 320, h = 80) {
    this.w = w; this.h = h;
    this.canvas = document.createElement('canvas');
    this.canvas.width = w; this.canvas.height = h;
    this.ctx = this.canvas.getContext('2d');
    this.ctx.imageSmoothingEnabled = false;
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.magFilter = THREE.NearestFilter;
    this.texture.minFilter = THREE.LinearFilter;
    this.texture.generateMipmaps = false;
  }
  clear(c) { this.ctx.fillStyle = c; this.ctx.fillRect(0, 0, this.w, this.h); }
  rect(x, y, w, h, c) { this.ctx.fillStyle = c; this.ctx.fillRect(x, y, w, h); }
  textWidth(s, k = 1) { return s.length ? s.length * 6 * k - k : 0; }
  text(s, x, y, k, c) {
    this.ctx.fillStyle = c;
    for (const ch of s) {
      const g = glyph(ch);
      for (let col = 0; col < 5; col++)
        for (let row = 0; row < 7; row++)
          if ((g[col] >> row) & 1) this.ctx.fillRect(x + col * k, y + row * k, k, k);
      x += 6 * k;
    }
  }
  flush() { this.texture.needsUpdate = true; }
}
