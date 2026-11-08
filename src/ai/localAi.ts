import type { LocalAnalysisMode, LocalAnalysisResult } from '../workers/analysis.worker';

let worker: Worker | null = null;
let sequence = 0;
const pending = new Map<number, { resolve: (result: LocalAnalysisResult) => void; reject: (error: Error) => void }>();

function getWorker() {
  if (worker) return worker;
  worker = new Worker(new URL('../workers/analysis.worker.ts', import.meta.url), { type: 'module' });
  worker.onmessage = (event: MessageEvent<{ id: number; ok: boolean; result?: LocalAnalysisResult; error?: string }>) => {
    const request = pending.get(event.data.id);
    if (!request) return;
    pending.delete(event.data.id);
    if (event.data.ok && event.data.result) request.resolve(event.data.result);
    else request.reject(new Error(event.data.error || 'No se pudo analizar el contenido.'));
  };
  worker.onerror = () => {
    for (const request of pending.values()) request.reject(new Error('El analizador local dejó de responder.'));
    pending.clear();
    worker = null;
  };
  return worker;
}

export function analyzeLocally(raw: string, sourceUrl: string | undefined, mode: LocalAnalysisMode = 'rules') {
  const id = ++sequence;
  return new Promise<LocalAnalysisResult>((resolve, reject) => {
    pending.set(id, { resolve, reject });
    getWorker().postMessage({ id, action: 'analyze', raw, sourceUrl, mode });
  });
}

export const localAiModes = {
  rules: { label: 'Reglas offline', description: 'Parser local, sin descarga y sin red.' },
  model: { label: 'Modelo compacto', description: 'Transformers.js + Flan-T5-small cuantizado, ejecutado en este dispositivo.' },
} as const;
