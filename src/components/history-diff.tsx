import type { GlyphindOperationChange } from '../domain/model';

export function HistoryDiff({ changes }: { changes: GlyphindOperationChange[] }) {
  return <details className="operation-diff">
    <summary>Comparación visual · {changes.length} cambios</summary>
    <div className="operation-diff-list">{changes.map((change, index) => <article className="operation-diff-item" key={`${change.entity}-${change.id}-${change.field}-${index}`}>
      <strong>{change.entity} · {change.field}</strong>
      <div className="operation-diff-grid">
        <section className="operation-diff-before"><span>Antes</span><pre>{change.before || '(sin valor)'}</pre></section>
        <section className="operation-diff-after"><span>Después</span><pre>{change.after || '(sin valor)'}</pre></section>
      </div>
    </article>)}</div>
  </details>;
}
