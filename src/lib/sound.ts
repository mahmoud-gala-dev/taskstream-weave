/**
 * Subtle UI sound synthesis using Web Audio API.
 * Provides lightweight, zero-dependency, tactile audio feedback on drop.
 */

let sharedAudioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  try {
    if (typeof window === "undefined") return null;
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    if (!sharedAudioCtx || sharedAudioCtx.state === "closed") {
      sharedAudioCtx = new Ctor();
    }
    if (sharedAudioCtx.state === "suspended") {
      void sharedAudioCtx.resume();
    }
    return sharedAudioCtx;
  } catch {
    return null;
  }
}

/**
 * Plays a gentle, pleasant, tactile "drop/plop" sound indicating successful drag and drop.
 * Tuned to be subtle, warm, and non-intrusive.
 */
export function playDropSound() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    // Primary warm tone: gentle downward pitch glide
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(480, now);
    osc.frequency.exponentialRampToValueAtTime(220, now + 0.07);

    // Soft volume envelope (subtle: peak ~0.09)
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.09, now + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.075);

    // Subtle tactile high-frequency tick for crisp definition
    const tick = ctx.createOscillator();
    const tickGain = ctx.createGain();
    tick.type = "triangle";
    tick.frequency.setValueAtTime(740, now);
    tick.frequency.exponentialRampToValueAtTime(360, now + 0.035);

    tickGain.gain.setValueAtTime(0.0001, now);
    tickGain.gain.exponentialRampToValueAtTime(0.035, now + 0.004);
    tickGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.045);

    osc.connect(gain).connect(ctx.destination);
    tick.connect(tickGain).connect(ctx.destination);

    osc.start(now);
    tick.start(now);
    osc.stop(now + 0.08);
    tick.stop(now + 0.05);
  } catch {
    /* sound is best-effort */
  }
}
