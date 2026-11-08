import type { LocalAnalysisMode, LocalAnalysisResult } from '../workers/analysis.worker';
import type { Project } from '../domain/model';

export function AnalysisReview({ result, error, mode, onModeChange, onAccept, onDiscard }: { result: LocalAnalysisResult; error: string; mode: LocalAnalysisMode; onModeChange: (mode: LocalAnalysisMode) => void; onAccept: () => void; onDiscard: () => void }) {
  return <aside className="analysis-review" aria-label="Sugerencias de IA local">
    <div className="analysis-review-head"><div><span className="section-kicker">Revisión explicable</span><h2>Sugerencias locales</h2></div><span className="local-ai-badge">{result.modelUsed ? 'Modelo local' : 'Reglas offline'}</span></div>
    <p className="analysis-review-summary">{result.summary}</p>
    {error && <p className="analysis-review-error">{error}</p>}
    <div className="analysis-review-meta"><span>{result.sections.length} secciones</span><span>{result.evidence.length} evidencias</span><label>Modo<select value={mode} onChange={(event) => onModeChange(event.target.value as LocalAnalysisMode)}><option value="rules">Reglas offline</option><option value="model">Modelo compacto</option></select></label></div>
    <div className="analysis-evidence-list">{result.evidence.slice(0, 4).map((item, index) => <article key={`${item.fragment}-${index}`} className="analysis-evidence"><span>{index + 1}</span><div><strong>{item.title || 'Fragmento fuente'}</strong><p>{item.fragment || item.text}</p><small>{item.selector || 'fragmento'} · confianza {Math.round((item.confidence ?? 0) * 100)}%</small></div></article>)}</div>
    <div className="analysis-review-actions"><button className="secondary-button" onClick={onDiscard}>Descartar</button><button className="primary-button" onClick={onAccept}>Aceptar sugerencias</button></div>
  </aside>;
}

export function OutlinePanel({ project, selectedNodeId, onSelect, onClose }: { project: Project; selectedNodeId: string; onSelect: (id: string) => void; onClose: () => void }) {
  const edgeCount = (nodeId: string) => project.edges.filter((edge) => edge.from === nodeId || edge.to === nodeId).length;
  return <aside className="outline-panel" aria-label="Esquema navegable">
    <div className="outline-head"><div><span className="section-kicker">Lectura estructural</span><h2>Esquema</h2></div><button className="icon-button" onClick={onClose} aria-label="Cerrar esquema">×</button></div>
    <p className="outline-intro">Una lectura paralela del canvas para teclado y lector de pantalla. Las relaciones no dependen del color.</p>
    <ol className="outline-list">{project.nodes.map((node, index) => <li key={node.id}><button className={selectedNodeId === node.id ? 'is-selected' : ''} onClick={() => onSelect(node.id)}><span>{index + 1}</span><strong>{node.label}</strong><small>{node.detail}</small><em>{edgeCount(node.id)} {edgeCount(node.id) === 1 ? 'relación' : 'relaciones'}</em></button></li>)}</ol>
  </aside>;
}
