import type { LocalAnalysisMode, LocalAnalysisProgress, LocalAnalysisResult } from '../workers/analysis.worker';

type WorkerMessage = { id: number; ok: boolean; result?: LocalAnalysisResult; progress?: LocalAnalysisProgress; error?: string };
type PendingRequest = {
  resolve: (result: LocalAnalysisResult) => void;
  reject: (error: Error) => void;
  onProgress?: (progress: LocalAnalysisProgress) => void;
};

let worker: Worker | null = null;
let sequence = 0;
const pending = new Map<number, PendingRequest>();

function failPending(message: string) {
  for (const request of pending.values()) request.reject(new Error(message));
  pending.clear();
  worker?.terminate();
  worker = null;
}

function getWorker() {
  if (worker) return worker;
  worker = new Worker(new URL('../workers/analysis.worker.ts', import.meta.url), { type: 'module' });
  worker.onmessage = (event: MessageEvent<WorkerMessage>) => {
    const request = pending.get(event.data.id);
    if (!request) return;
    if (event.data.progress) {
      request.onProgress?.(event.data.progress);
      return;
    }
    pending.delete(event.data.id);
    if (event.data.ok && event.data.result) request.resolve(event.data.result);
    else request.reject(new Error(event.data.error || 'No se pudo analizar el contenido.'));
  };
  worker.onerror = () => failPending('El analizador local dejó de responder. Vuelve a intentarlo.');
  worker.onmessageerror = () => failPending('No se pudo leer la respuesta del analizador local.');
  return worker;
}

export function analyzeLocally(raw: string, sourceUrl: string | undefined, mode: LocalAnalysisMode = 'rules', onProgress?: (progress: LocalAnalysisProgress) => void) {
  const id = ++sequence;
  return new Promise<LocalAnalysisResult>((resolve, reject) => {
    pending.set(id, { resolve, reject, onProgress });
    try {
      getWorker().postMessage({ id, action: 'analyze', raw, sourceUrl, mode });
    } catch (error) {
      pending.delete(id);
      reject(error instanceof Error ? error : new Error('No se pudo iniciar el análisis local.'));
    }
  });
}

export const localAiModes = {
  rules: { label: 'Reglas offline', description: 'Parser local, sin descarga y sin red.' },
  model: { label: 'Ensamble local comprimido', description: 'Multilingual E5 prioriza relevancia y MiniLM multilingüe elimina frases repetidas para formar una síntesis diversa. Ambos modelos se ejecutan en este dispositivo; la primera descarga requiere conexión.' },
} as const;
