export class Midi {
  constructor(h) {
    this.h = h; this.access = null; this.supported = !!navigator.requestMIDIAccess;
    this.inId = 'all'; this.outId = 'off'; this.channel = 0; this.denied = false;
  }
  async init() {
    if (this.access || !this.supported) return;
    try {
      this.access = await navigator.requestMIDIAccess();
      this.access.onstatechange = () => { this.attach(); this.h.onDevices?.(); };
      this.attach(); this.h.onDevices?.();
    } catch { this.denied = true; this.h.onDevices?.(); }
  }
  attach() { for (const i of this.access.inputs.values()) i.onmidimessage = e => this.recv(e, i); }
  inputs() { return this.access ? [...this.access.inputs.values()] : []; }
  outputs() { return this.access ? [...this.access.outputs.values()] : []; }
  name(kind, id) {
    if (id === 'all') return 'ALL';
    if (id === 'off') return 'OFF';
    const d = (kind === 'in' ? this.inputs() : this.outputs()).find(x => x.id === id);
    return d ? d.name : 'N/A';
  }
  recv(e, input) {
    if (this.inId !== 'all' && input.id !== this.inId) return;
    const [s, a, b] = e.data, cmd = s & 0xf0;
    if (this.channel && (s & 0x0f) !== this.channel - 1) return;
    if (cmd === 0x90 && b > 0) this.h.onNote(a, b, true);
    else if (cmd === 0x80 || cmd === 0x90) this.h.onNote(a, 0, false);
    else if (cmd === 0xb0) this.h.onCC(a, b);
  }
  send(bytes) {
    if (this.outId === 'off') return;
    for (const o of this.outputs()) if (this.outId === 'all' || o.id === this.outId) o.send(bytes);
  }
  ch() { return Math.max(this.channel - 1, 0); }
  noteOn(n, v) { this.send([0x90 | this.ch(), n, v]); }
  noteOff(n) { this.send([0x80 | this.ch(), n, 0]); }
  cc(c, v) { this.send([0xb0 | this.ch(), c, v]); }
}
