import { useEffect } from 'react';
import type { ReactNode } from 'react';
import type { DiagramNode, GlyphindGroup, GlyphindPage, MatrixData, Project } from '../domain/model';
import { addMatrixColumn, addVennItem, createCycleEdges, ensureVennGroups, readCycleData, readMatrixData, removeMatrixColumn, reorderCycleNode, renameMatrixColumn, setMatrixCell, setVennMembership } from '../domain/semantics';

type Props = {
  project: Project;
  onBack: () => void;
  onChange: (project: Project) => void;
  onToast: (message: string) => void;
  exportMenu: ReactNode;
};

function makeId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function appendNodeToPrimaryPage(project: Project, nodeId: string): GlyphindPage[] {
  const primary = project.pages[0] ?? { id: 'page-main', title: 'Página principal', nodeIds: [], edgeIds: [] };
  return [{ ...primary, nodeIds: [...new Set([...primary.nodeIds, nodeId])] }, ...project.pages.slice(1)];
}

function syncPrimaryPage(project: Project, nodes: DiagramNode[], edges: Project['edges']): GlyphindPage[] {
  const primary = project.pages[0] ?? { id: 'page-main', title: 'Página principal', nodeIds: [], edgeIds: [] };
  return [{ ...primary, nodeIds: nodes.map((node) => node.id), edgeIds: edges.map((edge) => edge.id) }, ...project.pages.slice(1)];
}

function removeNode(project: Project, nodeId: string): Project {
  const nodes = project.nodes.filter((node) => node.id !== nodeId);
  const edges = project.edges.filter((edge) => edge.from !== nodeId && edge.to !== nodeId);
  return {
    ...project,
    nodes,
    edges,
    groups: project.groups.map((group) => ({ ...group, nodeIds: (Array.isArray(group.nodeIds) ? group.nodeIds : []).filter((id) => id !== nodeId) })),
    pages: project.pages.map((page) => ({ ...page, nodeIds: page.nodeIds.filter((id) => id !== nodeId), edgeIds: page.edgeIds.filter((id) => edges.some((edge) => edge.id === id)) })),
    sources: project.sources.map((source) => ({ ...source, nodeIds: source.nodeIds?.filter((id) => id !== nodeId), edgeIds: source.edgeIds?.filter((id) => edges.some((edge) => edge.id === id)) })),
    data: project.data?.matrix ? { ...project.data, matrix: { ...project.data.matrix, cells: Object.fromEntries(Object.entries(project.data.matrix.cells && typeof project.data.matrix.cells === 'object' ? project.data.matrix.cells : {}).filter(([id]) => id !== nodeId)) } } : project.data,
  };
}

function SemanticFrame({ project, onBack, exportMenu, children }: Props & { children: ReactNode }) {
  const label = project.type === 'matrix' ? 'Matriz comparativa' : project.type === 'cycle' ? 'Ciclo' : 'Conjuntos';
  return <div className="editor-shell"><header className="editor-topbar"><button className="back-link" onClick={onBack}><span aria-hidden="true">←</span> Volver a proyectos</button><div className="editor-breadcrumb"><span>/</span><span>{project.name}</span><span className="editor-type-pill">{label}</span></div><div className="editor-actions"><span className="saved-label"><span className="canvas-live-dot" /> Guardado local</span>{exportMenu}</div></header><main className="specialized-main semantic-editor-main">{children}</main></div>;
}

export function SemanticDiagramEditor(props: Props) {
  const { project } = props;
  if (project.type === 'matrix') return <MatrixEditorView {...props} />;
  if (project.type === 'cycle') return <CycleEditor {...props} />;
  return <VennEditor {...props} />;
}

function MatrixEditorView({ project, onBack, onChange, onToast, exportMenu }: Props) {
  const matrix = readMatrixData(project);
  const commit = (data: MatrixData, nodes = project.nodes, pages = project.pages) => onChange({ ...project, nodes, pages, data: { ...project.data, matrix: data } });
  const addRow = () => {
    const node: DiagramNode = { id: makeId('option'), label: `Nueva opción ${project.nodes.length + 1}`, detail: '', x: 50, y: 50, tone: ['blue', 'lilac', 'green', 'orange'][project.nodes.length % 4] };
    commit({ ...matrix, cells: { ...matrix.cells, [node.id]: Object.fromEntries(matrix.columns.map((column) => [column, ''])) } }, [...project.nodes, node], appendNodeToPrimaryPage(project, node.id));
    onToast('Opción añadida a la matriz');
  };
  const updateNode = (nodeId: string, patch: Partial<DiagramNode>) => onChange({ ...project, nodes: project.nodes.map((node) => node.id === nodeId ? { ...node, ...patch } : node) });
  const deleteRow = (nodeId: string) => {
    if (project.nodes.length <= 1) return;
    const next = removeNode(project, nodeId);
    onChange(next);
    onToast('Opción retirada; la evidencia fuente se conserva');
  };
  return <SemanticFrame {...{ project, onBack, exportMenu }} onChange={onChange} onToast={onToast}>
    <div className="specialized-heading"><div><span className="section-kicker">Comparación estructurada</span><h1>{project.name}</h1><p>Compara opciones con criterios editables. Cada fila es un elemento trazable del proyecto.</p></div><div className="heading-actions"><button className="secondary-button" onClick={addRow}>＋ Añadir opción</button><button className="primary-button" onClick={() => { const next = addMatrixColumn(matrix); if (next !== matrix) commit(next); else onToast('La matriz admite hasta 12 criterios'); }}>＋ Añadir criterio</button></div></div>
    <div className="semantic-tip"><strong>Cómo usarla</strong><span>Renombra los criterios en los encabezados y escribe valores directamente en las celdas. Los cambios se guardan solo en este dispositivo.</span></div>
    <div className="matrix-scroll" role="region" aria-label="Tabla comparativa; desplázate horizontalmente para ver todos los criterios" tabIndex={0}><table className="semantic-matrix"><thead><tr><th scope="col" className="matrix-rowhead">Opciones</th>{matrix.columns.map((column) => <th scope="col" key={column}><div className="matrix-column-head"><input aria-label={`Nombre del criterio ${column}`} value={column} onChange={(event) => commit(renameMatrixColumn(matrix, column, event.target.value))} /><button className="semantic-icon-button" disabled={matrix.columns.length <= 1} onClick={() => commit(removeMatrixColumn(matrix, column))} aria-label={`Eliminar criterio ${column}`}>×</button></div></th>)}<th scope="col" className="matrix-actions-head">Acciones</th></tr></thead><tbody>{project.nodes.map((node, rowIndex) => <tr key={node.id}><th scope="row"><div className="matrix-row-label"><span className="matrix-row-index">{String(rowIndex + 1).padStart(2, '0')}</span><input aria-label={`Nombre de opción ${rowIndex + 1}`} value={node.label} onChange={(event) => updateNode(node.id, { label: event.target.value })} /><small>{node.sourceUrl || node.evidenceId ? 'Con fuente' : 'Elemento local'}</small></div></th>{matrix.columns.map((column) => <td key={column}><textarea aria-label={`${node.label}, ${column}`} rows={2} value={matrix.cells[node.id]?.[column] ?? ''} onChange={(event) => commit(setMatrixCell(matrix, node.id, column, event.target.value))} placeholder="Añadir valor…" /></td>)}<td className="matrix-row-actions"><button className="semantic-text-button" disabled={project.nodes.length <= 1} onClick={() => deleteRow(node.id)}>Quitar opción</button></td></tr>)}</tbody></table></div>
    <div className="specialized-foot">{project.nodes.length} opciones · {matrix.columns.length} criterios · datos y evidencia guardados localmente</div>
  </SemanticFrame>;
}

function CycleEditor({ project, onBack, onChange, onToast, exportMenu }: Props) {
  const cycle = readCycleData(project);
  const desiredEdges = createCycleEdges(project.nodes, cycle.closedLoop);
  useEffect(() => {
    const nodeIds = new Set(project.nodes.map((node) => node.id));
    const existing = project.edges.filter((edge) => nodeIds.has(edge.from) && nodeIds.has(edge.to));
    if (JSON.stringify(existing) !== JSON.stringify(desiredEdges)) onChange({ ...project, edges: [...project.edges.filter((edge) => !nodeIds.has(edge.from) || !nodeIds.has(edge.to)), ...desiredEdges] });
  }, [project.id, project.nodes, project.edges, cycle.closedLoop]);
  const update = (nodes: DiagramNode[], closedLoop = cycle.closedLoop, baseProject = project) => {
    const oldNodeIds = new Set(project.nodes.map((node) => node.id));
    const externalEdges = baseProject.edges.filter((edge) => !oldNodeIds.has(edge.from) || !oldNodeIds.has(edge.to));
    const edges = [...externalEdges, ...createCycleEdges(nodes, closedLoop)];
    onChange({ ...baseProject, nodes, edges, pages: syncPrimaryPage(baseProject, nodes, edges), data: { ...baseProject.data, cycle: { closedLoop } } });
  };
  const addStep = () => { const next = [...project.nodes, { id: makeId('step'), label: 'Nuevo paso', detail: '', x: 50, y: 50, tone: 'blue' }]; update(next); onToast('Paso añadido al ciclo'); };
  const changeStep = (nodeId: string, patch: Partial<DiagramNode>) => update(project.nodes.map((node) => node.id === nodeId ? { ...node, ...patch } : node));
  const moveStep = (nodeId: string, offset: -1 | 1) => { const next = reorderCycleNode(project.nodes, nodeId, offset); if (next !== project.nodes) { update(next); onToast('Orden del ciclo actualizado'); } };
  const deleteStep = (nodeId: string) => { if (project.nodes.length <= 1) return; const next = removeNode(project, nodeId); update(next.nodes, cycle.closedLoop, next); onToast('Paso eliminado del ciclo'); };
  return <SemanticFrame {...{ project, onBack, exportMenu }} onChange={onChange} onToast={onToast}>
    <div className="specialized-heading"><div><span className="section-kicker">Secuencia repetible</span><h1>{project.name}</h1><p>Ordena los pasos, edita sus detalles y decide si el último vuelve al primero.</p></div><div className="heading-actions"><label className="semantic-toggle"><input type="checkbox" checked={cycle.closedLoop} onChange={(event) => update(project.nodes, event.target.checked)} /><span className="toggle-track" /><span>Cerrar el ciclo</span></label><button className="primary-button" onClick={addStep}>＋ Añadir paso</button></div></div>
    <div className={`cycle-visual ${cycle.closedLoop ? 'is-closed' : 'is-open'}`} aria-label={cycle.closedLoop ? 'Ciclo cerrado' : 'Secuencia abierta'}><div className="cycle-visual-center"><span>{cycle.closedLoop ? '↻' : '→'}</span><strong>{cycle.closedLoop ? 'Se repite' : 'Secuencia'}</strong></div><div className="cycle-visual-steps">{project.nodes.map((node, index) => <div className="cycle-visual-step" key={node.id}><span>{String(index + 1).padStart(2, '0')}</span><strong>{node.label || 'Paso sin título'}</strong>{index < project.nodes.length - 1 && <i aria-hidden="true">→</i>}</div>)}</div><p>{cycle.closedLoop ? 'Al completar el último paso, el proceso vuelve al inicio.' : 'El último paso concluye el recorrido.'}</p></div>
    <section className="cycle-step-list" aria-label="Pasos del ciclo">{project.nodes.map((node, index) => <article className="cycle-step-card" key={node.id}><span className="cycle-step-number">{String(index + 1).padStart(2, '0')}</span><div className="cycle-step-fields"><input aria-label={`Nombre del paso ${index + 1}`} value={node.label} onChange={(event) => changeStep(node.id, { label: event.target.value })} /><textarea aria-label={`Detalle del paso ${index + 1}`} rows={2} value={node.detail} placeholder="Describe qué ocurre en este paso" onChange={(event) => changeStep(node.id, { detail: event.target.value })} /></div><div className="cycle-step-actions"><button className="semantic-icon-button" disabled={index === 0} onClick={() => moveStep(node.id, -1)} aria-label={`Mover ${node.label} hacia arriba`}>↑</button><button className="semantic-icon-button" disabled={index === project.nodes.length - 1} onClick={() => moveStep(node.id, 1)} aria-label={`Mover ${node.label} hacia abajo`}>↓</button><button className="semantic-icon-button is-danger" disabled={project.nodes.length <= 1} onClick={() => deleteStep(node.id)} aria-label={`Eliminar ${node.label}`}>×</button></div></article>)}</section>
    <div className="specialized-foot">{project.nodes.length} pasos · {desiredEdges.length} relaciones explícitas · orden guardado localmente</div>
  </SemanticFrame>;
}

function VennEditor({ project, onBack, onChange, onToast, exportMenu }: Props) {
  const groups = ensureVennGroups(project);
  const [groupA, groupB] = groups;
  const belongsA = new Set(groupA?.nodeIds ?? []);
  const belongsB = new Set(groupB?.nodeIds ?? []);
  const updateGroups = (nextGroups: GlyphindGroup[]) => onChange({ ...project, groups: nextGroups });
  const updateNode = (nodeId: string, patch: Partial<DiagramNode>) => onChange({ ...project, nodes: project.nodes.map((node) => node.id === nodeId ? { ...node, ...patch } : node) });
  const toggle = (nodeId: string, groupId: string, included: boolean) => updateGroups(setVennMembership(groups, nodeId, groupId, included));
  const addItem = () => { const next = addVennItem(project.nodes); const node = next[next.length - 1]; onChange({ ...project, nodes: next, groups, pages: appendNodeToPrimaryPage(project, node.id) }); onToast('Elemento añadido; selecciona a qué conjunto pertenece'); };
  const deleteItem = (nodeId: string) => { if (project.nodes.length <= 1) return; onChange({ ...removeNode(project, nodeId), groups: groups.map((group) => ({ ...group, nodeIds: group.nodeIds.filter((id) => id !== nodeId) })) }); };
  const inAOnly = project.nodes.filter((node) => belongsA.has(node.id) && !belongsB.has(node.id));
  const inBoth = project.nodes.filter((node) => belongsA.has(node.id) && belongsB.has(node.id));
  const inBOnly = project.nodes.filter((node) => belongsB.has(node.id) && !belongsA.has(node.id));
  const inNeither = project.nodes.filter((node) => !belongsA.has(node.id) && !belongsB.has(node.id));
  return <SemanticFrame {...{ project, onBack, exportMenu }} onChange={onChange} onToast={onToast}>
    <div className="specialized-heading"><div><span className="section-kicker">Relaciones de pertenencia</span><h1>{project.name}</h1><p>Asigna cada elemento a uno, ambos o ninguno de los conjuntos para revelar coincidencias.</p></div><button className="primary-button" onClick={addItem}>＋ Añadir elemento</button></div>
    <div className="venn-set-headings"><label><span>Conjunto A</span><input aria-label="Nombre del conjunto A" value={groupA?.label ?? 'Grupo A'} onChange={(event) => updateGroups(groups.map((group, index) => index === 0 ? { ...group, label: event.target.value } : group))} /></label><label><span>Conjunto B</span><input aria-label="Nombre del conjunto B" value={groupB?.label ?? 'Grupo B'} onChange={(event) => updateGroups(groups.map((group, index) => index === 1 ? { ...group, label: event.target.value } : group))} /></label></div>
    <div className="venn-overview" aria-label="Resumen visual de las regiones de los conjuntos"><section className="venn-region venn-region-a"><strong>{groupA?.label ?? 'Grupo A'}</strong><small>Solo A · {inAOnly.length}</small><div>{inAOnly.map((node) => <span className="venn-chip" key={node.id}>{node.label}</span>)}</div></section><section className="venn-region venn-region-both"><strong>Intersección</strong><small>En ambos · {inBoth.length}</small><div>{inBoth.map((node) => <span className="venn-chip" key={node.id}>{node.label}</span>)}</div></section><section className="venn-region venn-region-b"><strong>{groupB?.label ?? 'Grupo B'}</strong><small>Solo B · {inBOnly.length}</small><div>{inBOnly.map((node) => <span className="venn-chip" key={node.id}>{node.label}</span>)}</div></section><section className="venn-region venn-region-out"><strong>Fuera de los conjuntos</strong><small>Ninguno · {inNeither.length}</small><div>{inNeither.map((node) => <span className="venn-chip" key={node.id}>{node.label}</span>)}</div></section></div>
    <section className="venn-item-list" aria-label="Editar elementos y pertenencias"><div className="venn-list-head"><div><h2>Elementos</h2><p>Marca las casillas para cambiar de región.</p></div><div className="venn-membership-head"><span>{groupA?.label ?? 'Grupo A'}</span><span>{groupB?.label ?? 'Grupo B'}</span></div></div>{project.nodes.map((node, index) => <article className="venn-item-row" key={node.id}><span className="venn-item-index">{String(index + 1).padStart(2, '0')}</span><input aria-label={`Nombre del elemento ${index + 1}`} value={node.label} onChange={(event) => updateNode(node.id, { label: event.target.value })} /><label><input type="checkbox" checked={belongsA.has(node.id)} onChange={(event) => toggle(node.id, groupA.id, event.target.checked)} aria-label={`${node.label} pertenece a ${groupA.label}`} /></label><label><input type="checkbox" checked={belongsB.has(node.id)} onChange={(event) => toggle(node.id, groupB.id, event.target.checked)} aria-label={`${node.label} pertenece a ${groupB.label}`} /></label><button className="semantic-text-button" disabled={project.nodes.length <= 1} onClick={() => deleteItem(node.id)}>Quitar</button></article>)}</section>
    <div className="specialized-foot">{project.nodes.length} elementos · intersección calculada localmente · los nodos conservan su procedencia</div>
  </SemanticFrame>;
}
