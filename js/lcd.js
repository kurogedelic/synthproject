import * as THREE from 'three';

// Canvas-backed LCD texture. screens.js draws into ctx; flush() uploads it.
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
  flush() { this.texture.needsUpdate = true; }
}
