const clamp01 = number => Math.max(0, Math.min(1, number));

export const pumpDefaults = {
  inflow: 55,
  primary: true,
  automatic: true,
  power: 25,
};

export function createPumpRun(initialLevel = 0.42) {
  let level = clamp01(initialLevel);
  let backupRunning = false;
  let alarm = false;
  let movement = 0;

  return {
    step(seconds, settings, stage) {
      const previous = level;
      const inflow = clamp01(settings.inflow / 100);
      const main = settings.primary ? clamp01(settings.power / 100) : 0;
      backupRunning = settings.automatic && (backupRunning ? level > 0.44 : level >= 0.63);
      const backup = backupRunning ? 1 : 0;
      const gain = inflow * 0.094;
      const discharge = main * 0.108 + backup * 0.101;
      const dt = Math.max(0, Math.min(0.06, seconds));
      const reserve = level + dt * gain;
      const drained = Math.min(reserve, discharge * dt);
      level = clamp01(reserve - drained);
      alarm = alarm ? level > 0.72 : level >= 0.82;
      if (dt) movement = 0.92 * movement + 0.08 * (level - previous) / dt;
      return { level, inflow, main: level > 0 ? main : 0, backup, alarm, stage, movement };
    },
    reset(value = 0.42) {
      level = clamp01(value);
      backupRunning = false;
      alarm = false;
      movement = 0;
    },
  };
}
