import * as THREE from './vendor/three.module.js';

export function viewError(code, cause) {
  return Object.assign(new Error(code, { cause }), { code });
}

export function connectRenderer() {
  const profiles = [
    { antialias: true, powerPreference: 'default' },
    { antialias: false, powerPreference: 'low-power' },
    { antialias: false, powerPreference: 'default' },
  ];
  let contextAvailable = false;
  let lastError;
  for (const settings of profiles) {
    const canvas = document.createElement('canvas');
    const attributes = { ...settings, alpha: true, depth: true, failIfMajorPerformanceCaveat: false };
    let context;
    try {
      context = canvas.getContext('webgl2', attributes);
      if (!context) continue;
      contextAvailable = true;
      const renderer = new THREE.WebGLRenderer({ canvas, context, ...attributes });
      return { renderer, canvas };
    } catch (error) {
      lastError = error;
      context?.getExtension('WEBGL_lose_context')?.loseContext();
    }
  }
  throw viewError(contextAvailable ? 'renderer-init' : 'no-webgl2', lastError);
}
