let ctx: AudioContext | null = null
let muted = localStorage.getItem('gd-muted') === '1'

export const isMuted = (): boolean => muted

export function toggleMute(): boolean {
  muted = !muted
  localStorage.setItem('gd-muted', muted ? '1' : '0')
  return muted
}

function ens(): AudioContext {
  if (!ctx) ctx = new AudioContext()
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

function tone(freq: number, dur: number, type: OscillatorType, gain: number, when = 0, slideTo?: number): void {
  const ac = ens()
  const t0 = ac.currentTime + when
  const osc = ac.createOscillator()
  const g = ac.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, t0)
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur)
  g.gain.setValueAtTime(0.0001, t0)
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.012)
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
  osc.connect(g).connect(ac.destination)
  osc.start(t0)
  osc.stop(t0 + dur + 0.05)
}

function noise(dur: number, gain: number, when = 0): void {
  const ac = ens()
  const t0 = ac.currentTime + when
  const len = Math.floor(ac.sampleRate * dur)
  const buf = ac.createBuffer(1, len, ac.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len)
  const src = ac.createBufferSource()
  const g = ac.createGain()
  src.buffer = buf
  g.gain.setValueAtTime(gain, t0)
  src.connect(g).connect(ac.destination)
  src.start(t0)
}

export type SoundKind = 'play' | 'bomb' | 'win'

export function playSound(kind: SoundKind): void {
  if (muted) return
  try {
    if (kind === 'play') {
      tone(620, 0.07, 'triangle', 0.05)
      tone(830, 0.06, 'triangle', 0.04, 0.05)
    } else if (kind === 'bomb') {
      noise(0.5, 0.22)
      tone(120, 0.42, 'sawtooth', 0.12, 0, 42)
      tone(70, 0.5, 'square', 0.08, 0.03, 30)
    } else {
      ;[523, 659, 784, 1047].forEach((f, i) => tone(f, 0.16, 'triangle', 0.07, i * 0.11))
    }
  } catch {
    /* audio unavailable */
  }
}
