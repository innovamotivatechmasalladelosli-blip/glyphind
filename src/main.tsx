import { StrictMode, useEffect, useLayoutEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent, type MouseEvent as ReactMouseEvent } from 'react';
import { createRoot } from 'react-dom/client';
import { analyzeLocally, localAiModes } from './ai/localAi';
import { populateProjectFromAnalysis } from './domain/diagram-generation';
import { createEdgesFromNodes, createWorkspaceEnvelope, migrateProjects, type DiagramNode, type EdgeDirection, type EdgePort, type GlyphindEdge, type GlyphindSource, type GlyphindOperationChange, type NodeShape, type Project, type ProjectData, type Slide, type BoardCard, type BoardColumn, type TimelineItem } from './domain/model';
import { exportExcalidraw, exportMermaid, importExcalidraw, importMarkdown, importMermaid, readFormatPlugins, writeFormatPlugins, type FormatPlugin } from './domain/formats';
import { loadWorkspace, persistWorkspace } from './storage/workspace';
import { collectProjectDiff, describeProjectChange, mergeDiffs } from './domain/history';
import { exportProjectSvg } from './domain/svg';
import { applyLocalTemplate as applyTemplateProject, createLocalTemplate, readLocalTemplates, writeLocalTemplates, type LocalTemplate } from './domain/templates';
import { formatAdapterRegistry } from './domain/format-adapters';
import { ensureVennGroups, readCycleData, readMatrixData } from './domain/semantics';
import { formatSharedDocument, parseShareTarget } from './domain/share-target';
import { createLocalId } from './domain/ids';
import { moveBoardCard, reorderBoardColumn, toggleDependency } from './domain/board-timeline';
import { MAX_WEB_SOURCE_BYTES, readBoundedTextResponse } from './domain/source-read';
import type { LocalAnalysisMode, LocalAnalysisProgress, LocalAnalysisResult } from './workers/analysis.worker';
import { AnalysisReview, OutlinePanel } from './components/local-panels';
import { HistoryDiff } from './components/history-diff';
import { SemanticDiagramEditor } from './components/semantic-diagram-editor';
import './styles.css';

type IconName =
  | 'menu' | 'plus' | 'grid' | 'folder' | 'flow' | 'checklist' | 'team' | 'community'
  | 'archive' | 'search' | 'filter' | 'more' | 'edit' | 'copy' | 'trash' | 'arrow'
  | 'close' | 'back' | 'save' | 'share' | 'add' | 'command' | 'chevron' | 'spark';
type ExportFormat = string;
const CANVAS_WINDOW_SIZE = 80;

type DiagramType = {
  id: string;
  label: string;
  description: string;
  icon: IconName;
  color: string;
  soft: string;
  group: DiagramGroup;
};

type DiagramGroup = 'diagram' | 'planning' | 'content' | 'people';

const diagramGroups: { id: DiagramGroup; label: string }[] = [
  { id: 'diagram', label: 'Diagramas' },
  { id: 'planning', label: 'Planificación' },
  { id: 'content', label: 'Contenido' },
  { id: 'people', label: 'Personas' },
];

const STORAGE_KEY = 'glyphind-projects-v1';

const diagramTypes: DiagramType[] = [
  { id: 'flow', label: 'Flujo', description: 'Procesos, decisiones y recorridos', icon: 'flow', color: '#5b63d8', soft: '#eef0ff', group: 'diagram' },
  { id: 'tasks', label: 'Pendientes', description: 'Listas, prioridades y avances', icon: 'checklist', color: '#db744f', soft: '#fff0e9', group: 'planning' },
  { id: 'document', label: 'Documento', description: 'Redacción, revisión y entrega', icon: 'folder', color: '#3478b9', soft: '#e8f3ff', group: 'content' },
  { id: 'presentation', label: 'Presentación', description: 'Narrativa, diapositivas y revisión', icon: 'grid', color: '#bc633f', soft: '#fff0e8', group: 'content' },
  { id: 'concept', label: 'Mapa conceptual', description: 'Conceptos, relaciones y síntesis', icon: 'command', color: '#2e8c86', soft: '#e7f8f5', group: 'diagram' },
  { id: 'mindmap', label: 'Mapa mental', description: 'Ideas que crecen desde un centro', icon: 'spark', color: '#bd8b31', soft: '#fff7df', group: 'diagram' },
  { id: 'matrix', label: 'Matriz comparativa', description: 'Compara criterios, opciones y decisiones', icon: 'grid', color: '#8b5ca9', soft: '#f4edfa', group: 'diagram' },
  { id: 'pyramid', label: 'Pirámide', description: 'Ordena información por niveles de importancia', icon: 'arrow', color: '#c46b4c', soft: '#fff0e9', group: 'diagram' },
  { id: 'cycle', label: 'Ciclo', description: 'Explica procesos repetitivos y recorridos', icon: 'arrow', color: '#2b8e78', soft: '#e7f7f1', group: 'diagram' },
  { id: 'venn', label: 'Conjuntos', description: 'Encuentra coincidencias y diferencias', icon: 'community', color: '#a45dbd', soft: '#f7eafa', group: 'diagram' },
  { id: 'timeline', label: 'Cronograma', description: 'Fases, dependencias y fechas', icon: 'arrow', color: '#7c5ab5', soft: '#f1ebff', group: 'planning' },
  { id: 'board', label: 'Tablero', description: 'Entrada, progreso, revisión y cierre', icon: 'checklist', color: '#2b8e78', soft: '#e7f7f1', group: 'planning' },
  { id: 'custom', label: 'Flujo personalizado', description: 'Construye cualquier proceso', icon: 'add', color: '#5b63d8', soft: '#eef0ff', group: 'diagram' },
  { id: 'team', label: 'Equipo', description: 'Roles, personas y estructura', icon: 'team', color: '#2b8e78', soft: '#e7f7f1', group: 'people' },
  { id: 'community', label: 'Comunidad', description: 'Relaciones, grupos y conexiones', icon: 'community', color: '#a45dbd', soft: '#f7eafa', group: 'people' },
];

const availableDiagramTypes = diagramTypes;

const featuredDiagramTypes: DiagramType[] = [
  { ...diagramTypes.find((item) => item.id === 'flow')!, label: 'Flujo', description: 'Procesos, decisiones y recorridos' },
  { ...diagramTypes.find((item) => item.id === 'mindmap')!, label: 'Resumen mental', description: 'Ideas principales que crecen desde un centro' },
  { ...diagramTypes.find((item) => item.id === 'concept')!, label: 'Resumen conceptual', description: 'Conceptos, relaciones y síntesis visual' },
  { ...diagramTypes.find((item) => item.id === 'custom')!, label: 'Flujo personalizado', description: 'Construye tu propio organizador desde cero' },
];
const featuredDiagramIds = new Set(featuredDiagramTypes.map((item) => item.id));

const defaultNodes: Record<string, DiagramNode[]> = {
  flow: [
    { id: 'start', label: 'Inicio del proyecto', detail: 'Punto de partida', x: 10, y: 38, tone: 'blue' },
    { id: 'step', label: 'Definir objetivo', detail: 'Paso 01', x: 39, y: 25, tone: 'dark' },
    { id: 'decision', label: '¿Está listo?', detail: 'Decisión', x: 68, y: 42, tone: 'lilac' },
    { id: 'end', label: 'Lanzamiento', detail: 'Resultado', x: 80, y: 70, tone: 'green' },
  ],
  tasks: [
    { id: 'backlog', label: 'Ideas por revisar', detail: '5 pendientes', x: 16, y: 20, tone: 'orange' },
    { id: 'today', label: 'Para hoy', detail: '3 tareas', x: 48, y: 43, tone: 'dark' },
    { id: 'done', label: 'Completado', detail: '12 entregas', x: 74, y: 66, tone: 'green' },
  ],
  team: [
    { id: 'lead', label: 'Dirección', detail: '1 persona', x: 42, y: 16, tone: 'blue' },
    { id: 'design', label: 'Diseño', detail: '3 personas', x: 16, y: 58, tone: 'lilac' },
    { id: 'dev', label: 'Producto', detail: '4 personas', x: 69, y: 58, tone: 'green' },
  ],
  community: [
    { id: 'center', label: 'Glyphind', detail: 'Punto central', x: 43, y: 39, tone: 'dark' },
    { id: 'one', label: 'Diseñadores', detail: '14 miembros', x: 14, y: 16, tone: 'lilac' },
    { id: 'two', label: 'Constructores', detail: '28 miembros', x: 74, y: 16, tone: 'blue' },
    { id: 'three', label: 'Curiosos', detail: '42 miembros', x: 73, y: 72, tone: 'orange' },
  ],
  mindmap: [
    { id: 'idea', label: 'Idea central', detail: 'El punto de partida', x: 41, y: 38, tone: 'dark' },
    { id: 'a', label: 'Contexto', detail: 'Lo que ya sabemos', x: 13, y: 18, tone: 'blue' },
    { id: 'b', label: 'Posibilidades', detail: 'Lo que podemos crear', x: 74, y: 18, tone: 'lilac' },
    { id: 'c', label: 'Siguiente paso', detail: 'Lo que haremos ahora', x: 71, y: 72, tone: 'green' },
  ],
  document: [
    { id: 'brief', label: 'Entrada de contenido', detail: 'Texto o archivo fuente', x: 8, y: 38, tone: 'blue' },
    { id: 'review', label: 'Revisión editorial', detail: 'Claridad y estructura', x: 35, y: 24, tone: 'lilac' },
    { id: 'approval', label: 'Aprobación', detail: 'Responsable y criterios', x: 62, y: 42, tone: 'orange' },
    { id: 'export', label: 'Exportar documento', detail: 'PDF / DOCX / Markdown', x: 80, y: 68, tone: 'green' },
  ],
  presentation: [
    { id: 'pbrief', label: 'Brief', detail: 'Objetivo y audiencia', x: 8, y: 38, tone: 'blue' },
    { id: 'story', label: 'Narrativa', detail: 'Guion y estructura', x: 35, y: 24, tone: 'lilac' },
    { id: 'slides', label: 'Diapositivas', detail: 'Diseño y contenido', x: 62, y: 42, tone: 'orange' },
    { id: 'delivery', label: 'Entrega', detail: 'Revisión final', x: 80, y: 68, tone: 'green' },
  ],
  concept: [
    { id: 'topic', label: 'Tema central', detail: 'Pregunta que guía el mapa', x: 40, y: 40, tone: 'dark' },
    { id: 'concepts', label: 'Conceptos clave', detail: 'Ideas principales', x: 12, y: 18, tone: 'blue' },
    { id: 'relations', label: 'Relaciones', detail: 'Causas y consecuencias', x: 72, y: 18, tone: 'lilac' },
    { id: 'summary', label: 'Síntesis visual', detail: 'Conclusión compartible', x: 70, y: 72, tone: 'green' },
  ],
  timeline: [
    { id: 'scope', label: 'Alcance', detail: 'Resultado esperado', x: 8, y: 38, tone: 'blue' },
    { id: 'phases', label: 'Fases y tareas', detail: 'Desglose del trabajo', x: 35, y: 24, tone: 'lilac' },
    { id: 'dependencies', label: 'Dependencias', detail: 'Bloqueos y precedencias', x: 62, y: 42, tone: 'orange' },
    { id: 'calendar', label: 'Calendario', detail: 'Fechas de entrega', x: 80, y: 68, tone: 'green' },
  ],
  board: [
    { id: 'backlog', label: 'Entrada', detail: 'Ideas y solicitudes', x: 8, y: 38, tone: 'blue' },
    { id: 'progress', label: 'En progreso', detail: 'Límite WIP', x: 35, y: 24, tone: 'orange' },
    { id: 'qa', label: 'Revisión', detail: 'Criterios de aceptación', x: 62, y: 42, tone: 'lilac' },
    { id: 'done', label: 'Hecho', detail: 'Resultado verificable', x: 80, y: 68, tone: 'green' },
  ],
  custom: [
    { id: 'trigger', label: 'Disparador', detail: 'Qué inicia el flujo', x: 8, y: 38, tone: 'blue' },
    { id: 'process', label: 'Transformación', detail: 'Regla o proceso', x: 35, y: 24, tone: 'lilac' },
    { id: 'condition', label: 'Decisión', detail: 'Condición y caminos', x: 62, y: 42, tone: 'orange' },
    { id: 'output', label: 'Salida', detail: 'Resultado final', x: 80, y: 68, tone: 'green' },
  ],
  brace: [
    { id: 'topic', label: 'Tema principal', detail: 'Idea general', x: 12, y: 50, tone: 'dark' },
    { id: 'branch', label: 'Categoría', detail: 'Primera división', x: 38, y: 30, tone: 'blue' },
    { id: 'detail-a', label: 'Detalle A', detail: 'Información específica', x: 70, y: 20, tone: 'lilac' },
    { id: 'detail-b', label: 'Detalle B', detail: 'Información específica', x: 70, y: 48, tone: 'green' },
    { id: 'detail-c', label: 'Detalle C', detail: 'Información específica', x: 70, y: 76, tone: 'orange' },
  ],
  matrix: [
    { id: 'option-a', label: 'Opción A', detail: 'Criterio 1 · Criterio 2', x: 25, y: 27, tone: 'blue' },
    { id: 'option-b', label: 'Opción B', detail: 'Criterio 1 · Criterio 2', x: 72, y: 27, tone: 'lilac' },
    { id: 'choice', label: 'Decisión', detail: 'Resultado comparado', x: 50, y: 72, tone: 'green' },
  ],
  pyramid: [
    { id: 'level-1', label: 'Nivel 1', detail: 'Prioridad máxima', x: 50, y: 18, tone: 'dark' },
    { id: 'level-2', label: 'Nivel 2', detail: 'Puntos importantes', x: 32, y: 48, tone: 'blue' },
    { id: 'level-3', label: 'Nivel 3', detail: 'Detalles y ejemplos', x: 68, y: 48, tone: 'lilac' },
    { id: 'base', label: 'Base', detail: 'Contexto de apoyo', x: 50, y: 78, tone: 'green' },
  ],
  cycle: [
    { id: 'cycle-a', label: 'Observar', detail: 'Recopilar señales', x: 50, y: 15, tone: 'blue' },
    { id: 'cycle-b', label: 'Analizar', detail: 'Encontrar patrones', x: 78, y: 50, tone: 'lilac' },
    { id: 'cycle-c', label: 'Actuar', detail: 'Aplicar una respuesta', x: 50, y: 82, tone: 'green' },
    { id: 'cycle-d', label: 'Aprender', detail: 'Mejorar el siguiente ciclo', x: 22, y: 50, tone: 'orange' },
  ],
  venn: [
    { id: 'set-a', label: 'Grupo A', detail: 'Características propias', x: 30, y: 43, tone: 'blue' },
    { id: 'shared', label: 'En común', detail: 'Coincidencias', x: 50, y: 50, tone: 'dark' },
    { id: 'set-b', label: 'Grupo B', detail: 'Características propias', x: 70, y: 43, tone: 'lilac' },
  ],
};

function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  const paths: Record<IconName, string> = {
    menu: 'M4 6h16M4 12h16M4 18h16',
    plus: 'M12 5v14M5 12h14',
    grid: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z',
    folder: 'M3 6.5A1.5 1.5 0 0 1 4.5 5h5l2 2h8A1.5 1.5 0 0 1 21 8.5v9A1.5 1.5 0 0 1 19.5 19h-15A1.5 1.5 0 0 1 3 17.5z',
    flow: 'M5 5h4v4H5zM15 15h4v4h-4zM15 5h4v4h-4zM7 9v3a2 2 0 0 0 2 2h6M17 9v3',
    checklist: 'M6 5h14M6 12h14M6 19h14M3.5 5.5h.01M3.5 12h.01M3.5 19h.01',
    team: 'M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM16.5 10a2.5 2.5 0 1 0 0-5M3 19a5 5 0 0 1 10 0M15 14a4 4 0 0 1 5 5',
    community: 'M12 12a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM5 17a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM19 17a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM7 18a5 5 0 0 1 10 0',
    archive: 'M4 7h16M5 7v11h14V7M9 11h6M6 4h12l1 3H5z',
    search: 'm20 20-4.5-4.5M11 18a7 7 0 1 1 0-14 7 7 0 0 1 0 14Z',
    filter: 'M4 6h16M7 12h10M10 18h4',
    more: 'M5 12h.01M12 12h.01M19 12h.01',
    edit: 'm4 16.5-.8 3.3 3.3-.8L19 6.5a2.1 2.1 0 0 0-3-3zM14 6l4 4',
    copy: 'M8 8V5.5A1.5 1.5 0 0 1 9.5 4h9A1.5 1.5 0 0 1 20 5.5v9a1.5 1.5 0 0 1-1.5 1.5H16M5.5 8h9A1.5 1.5 0 0 1 16 9.5v9a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 4 18.5v-9A1.5 1.5 0 0 1 5.5 8Z',
    trash: 'M5 7h14M10 11v5M14 11v5M7 7l1 13h8l1-13M9 7V4h6v3',
    arrow: 'M5 12h13M13 6l6 6-6 6',
    close: 'M6 6l12 12M18 6 6 18',
    back: 'M19 12H5M11 18l-6-6 6-6',
    save: 'M5 4h11l3 3v13H5zM8 4v6h8V4M8 20v-6h8v6',
    share: 'M18 8a3 3 0 1 0-2.8-4A3 3 0 0 0 18 8ZM6 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM18 22a3 3 0 1 0-2.8-4A3 3 0 0 0 18 22ZM8.6 13.5l6.8 4M15.4 6.5l-6.8 4',
    add: 'M12 5v14M5 12h14',
    command: 'M9 3v18M15 3v18M3 9h18M3 15h18',
    chevron: 'm8 10 4 4 4-4',
    spark: 'm12 3 1.2 5.8L19 10l-5.8 1.2L12 17l-1.2-5.8L5 10l5.8-1.2zM19 16l.5 2.5L22 19l-2.5.5L19 22l-.5-2.5L16 19l2.5-.5z',
  };

  return (
    <svg className="icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={paths[name]} />
    </svg>
  );
}

function BrandMark() {
  return (
    <svg className="brand-mark" width="27" height="27" viewBox="0 0 27 27" fill="none" aria-hidden="true">
      <path d="M7 6.5v5.1M20 6.5v5.1M7 11.6h13M7 11.6v7.1M20 11.6v7.1M7 18.7h13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <circle cx="7" cy="5.5" r="3" fill="currentColor" />
      <circle cx="20" cy="5.5" r="3" fill="currentColor" />
      <circle cx="7" cy="20.5" r="3" fill="currentColor" />
      <circle cx="20" cy="20.5" r="3" fill="currentColor" />
    </svg>
  );
}

function typeFor(id: string) {
  return diagramTypes.find((type) => type.id === id) ?? diagramTypes[0];
}

function formatDate(timestamp: number) {
  const diff = Date.now() - timestamp;
  const minutes = Math.max(1, Math.round(diff / 60000));
  if (minutes < 60) return `Hace ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `Hace ${hours} h`;
  const days = Math.round(hours / 24);
  if (days === 1) return 'Ayer';
  return `Hace ${days} días`;
}

function connectorPath(from: DiagramNode, to: DiagramNode, fromPort: EdgePort = 'auto', toPort: EdgePort = 'auto') {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const sourceSide = fromPort === 'auto' ? (Math.abs(dx) >= Math.abs(dy) ? (dx >= 0 ? 'right' : 'left') : (dy >= 0 ? 'bottom' : 'top')) : fromPort;
  const targetSide = toPort === 'auto' ? (Math.abs(dx) >= Math.abs(dy) ? (dx >= 0 ? 'left' : 'right') : (dy >= 0 ? 'top' : 'bottom')) : toPort;
  const anchor = (node: DiagramNode, side: EdgePort) => ({ x: node.x + (side === 'right' ? 5 : side === 'left' ? -5 : 0), y: node.y + (side === 'bottom' ? 6 : side === 'top' ? -6 : 0) });
  const start = anchor(from, sourceSide); const end = anchor(to, targetSide);
  const middleX = (start.x + end.x) / 2;
  return `M${start.x} ${start.y} C${middleX} ${start.y}, ${middleX} ${end.y}, ${end.x} ${end.y}`;
}

function shapeForNode(projectType: string, node: DiagramNode, index: number): NodeShape {
  if (node.shape) return node.shape;
  if (projectType === 'mindmap') return index === 0 ? 'circle' : 'pill';
  if (projectType === 'concept') return index === 0 ? 'hexagon' : 'diamond';
  if (projectType === 'flow' || projectType === 'custom') return index === 0 || index === 3 ? 'pill' : index === 2 ? 'diamond' : 'card';
  return 'card';
}

const toneColors: Record<string, string> = { blue: '#6972d9', dark: '#42413c', lilac: '#b17ac5', green: '#59ad8b', orange: '#e18b67' };
const colorForNode = (node: DiagramNode) => node.colorHex ?? toneColors[node.tone] ?? toneColors.blue;

function hslToHex(hue: number, saturation = 78, lightness = 55) {
  const c = (1 - Math.abs(2 * lightness / 100 - 1)) * saturation / 100;
  const x = c * (1 - Math.abs((hue / 60) % 2 - 1));
  const m = lightness / 100 - c / 2;
  const [r, g, b] = hue < 60 ? [c, x, 0] : hue < 120 ? [x, c, 0] : hue < 180 ? [0, c, x] : hue < 240 ? [0, x, c] : hue < 300 ? [x, 0, c] : [c, 0, x];
  return `#${[r, g, b].map((value) => Math.round((value + m) * 255).toString(16).padStart(2, '0')).join('')}`;
}

function ColorWheel({ value, onChange }: { value: string; onChange: (color: string) => void }) {
  const wheelRef = useRef<HTMLDivElement>(null);
  const chooseHue = (event: React.PointerEvent<HTMLDivElement>) => {
    const wheel = wheelRef.current;
    if (!wheel) return;
    const rect = wheel.getBoundingClientRect();
    const x = event.clientX - rect.left - rect.width / 2;
    const y = event.clientY - rect.top - rect.height / 2;
    if (Math.hypot(x, y) < rect.width * .22) return;
    const hue = (Math.atan2(y, x) * 180 / Math.PI + 90 + 360) % 360;
    onChange(hslToHex(hue));
  };
  return <div className="color-wheel-wrap"><div ref={wheelRef} className="real-color-wheel" onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); chooseHue(event); }} onPointerMove={(event) => { if (event.buttons) chooseHue(event); }} role="slider" aria-label="Rueda cromática" tabIndex={0}><span className="color-wheel-center" style={{ backgroundColor: value }} /></div><div><strong className="color-picker-value">{value.toUpperCase()}</strong><small>Arrastra sobre la rueda</small></div></div>;
}

function connectorEdges(project: Project) {
  const edges = project.edges?.length ? project.edges : createEdgesFromNodes(project.type, project.nodes);
  return edges.map((edge) => {
    const from = project.nodes.find((node) => node.id === edge.from);
    const to = project.nodes.find((node) => node.id === edge.to);
    return from && to ? { edge, from, to } : null;
  }).filter((item): item is { edge: GlyphindEdge; from: DiagramNode; to: DiagramNode } => Boolean(item));
}

const extractionStopWords = new Set('para con las los una uno que del por sus más como este esta desde entre sobre donde cuando cómo qué son'.split(' '));

function extractInformation(raw: string) {
  if (raw.length > 2_000_000) throw new Error('El contenido HTML supera el límite de 2 MB.');
  const document = new DOMParser().parseFromString(raw, 'text/html');
  document.querySelectorAll('script,style,noscript,svg,nav,footer,iframe,object,embed,form,input,button,textarea,select,template,link,meta,base,img,video,audio,source,track,picture,[hidden],[aria-hidden="true"]').forEach((element) => element.remove());
  const title = document.querySelector('title, h1')?.textContent?.trim() || 'Información extraída';
  const sections = Array.from(document.querySelectorAll('h1,h2,h3')).map((element) => element.textContent?.trim()).filter(Boolean).slice(0, 8) as string[];
  const paragraphs = Array.from(document.querySelectorAll('p,li')).map((element) => element.textContent?.replace(/\s+/g, ' ').trim()).filter((text): text is string => Boolean(text && text.length > 30)).slice(0, 16);
  const text = (paragraphs.length ? paragraphs : [document.body.textContent || raw]).join(' ');
  const words = text.toLowerCase().match(/[a-záéíóúñü]{4,}/gi) ?? [];
  const frequencies = new Map<string, number>();
  words.forEach((word) => { if (!extractionStopWords.has(word)) frequencies.set(word, (frequencies.get(word) ?? 0) + 1); });
  const keywords = [...frequencies.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([word]) => word);
  return { title, sections, paragraphs, summary: text.slice(0, 520), keywords };
}

function diagramSlideFor(project: Project): Slide {
  const type = typeFor(project.type);
  const elements = project.nodes.slice(0, 8).map((node, index) => `${index + 1}. ${node.label} — ${node.detail}`).join('\n');
  return {
    id: `diagram-${project.id}`,
    title: project.name,
    body: `${type.label}\n\n${elements || 'Diagrama listo para presentar.'}`,
    diagramProjectId: project.id,
  };
}

function presentationSlidesFor(projects: Project[]) {
  return projects.filter((project) => project.type !== 'presentation').map(diagramSlideFor);
}

function syncPresentationSlides(slides: Slide[], projects: Project[]) {
  const manualSlides = slides.filter((slide) => !slide.diagramProjectId);
  return [...manualSlides, ...presentationSlidesFor(projects)];
}

function initialData(type: string, relatedProjects: Project[] = []): ProjectData {
  if (type === 'document') return { document: '# Documento nuevo\n\nEscribe aquí el contenido de tu documento.\n\n## Próximos pasos\n- Añade el contexto\n- Revisa el contenido\n- Comparte la versión final' };
  if (type === 'presentation') return { slides: [{ id: `slide-${Date.now()}`, title: 'Título de la presentación', body: 'Escribe la idea principal de esta diapositiva.' }, ...presentationSlidesFor(relatedProjects)] };
  if (type === 'board') return { board: [{ id: 'backlog', title: 'Entrada', cards: [{ id: `card-${Date.now()}`, title: 'Primera tarjeta', detail: 'Describe el trabajo pendiente' }] }, { id: 'progress', title: 'En progreso', cards: [] }, { id: 'review', title: 'Revisión', cards: [] }, { id: 'done', title: 'Hecho', cards: [] }] };
  if (type === 'timeline') return { timeline: [{ id: `phase-${Date.now()}`, title: 'Definir alcance', date: 'Semana 1', detail: 'Alinear objetivos, responsables y entregables.' }, { id: `phase-${Date.now()}-2`, title: 'Construir primera versión', date: 'Semana 2', detail: 'Ejecutar las tareas prioritarias.' }] };
  if (type === 'matrix') return { matrix: { columns: ['Criterio 1', 'Criterio 2'], cells: {} } };
  if (type === 'cycle') return { cycle: { closedLoop: true } };
  return {};
}

function createProject(name: string, type: string, relatedProjects: Project[] = []): Project {
  const nodes = defaultNodes[type]?.map((node) => ({ ...node, id: `${node.id}-${Date.now()}` })) ?? defaultNodes.flow;
  return {
    schemaVersion: 1,
    id: `project-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name: name.trim() || 'Proyecto sin título',
    type,
    updated: Date.now(),
    nodes,
    edges: createEdgesFromNodes(type, nodes),
    groups: type === 'venn' ? [
      { id: 'set-a', label: 'Grupo A', nodeIds: nodes.filter((node) => ['Grupo A', 'En común'].includes(node.label)).map((node) => node.id), color: '#7c72d6' },
      { id: 'set-b', label: 'Grupo B', nodeIds: nodes.filter((node) => ['Grupo B', 'En común'].includes(node.label)).map((node) => node.id), color: '#df78af' },
    ] : [],
    pages: [{ id: 'page-main', title: 'Página principal', nodeIds: nodes.map((node) => node.id), edgeIds: createEdgesFromNodes(type, nodes).map((edge) => edge.id) }],
    sources: [],
    data: initialData(type, relatedProjects),
  };
}

function downloadFile(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function downloadProjectPng(project: Project) {
  const svgUrl = URL.createObjectURL(new Blob([exportProjectSvg(project)], { type: 'image/svg+xml;charset=utf-8' }));
  const image = new Image();
  image.onload = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 2400;
    canvas.height = 1600;
    const context = canvas.getContext('2d');
    if (!context) { URL.revokeObjectURL(svgUrl); return; }
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      URL.revokeObjectURL(svgUrl);
      if (!blob) return;
      const pngUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = pngUrl;
      link.download = `${safeFilename(project.name)}.png`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(pngUrl), 1000);
    }, 'image/png');
  };
  image.onerror = () => URL.revokeObjectURL(svgUrl);
  image.src = svgUrl;
}

function safeFilename(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9áéíóúñ]+/gi, '-').replace(/^-|-$/g, '') || 'glyphind-proyecto';
}

function downloadProject(project: Project, format: ExportFormat = 'markdown') {
  const type = typeFor(project.type);
  const baseName = safeFilename(project.name);
  if (format === 'png') { downloadProjectPng(project); return; }
  const registeredAdapter = formatAdapterRegistry.get(format);
  if (registeredAdapter?.serialize) { const extension = registeredAdapter.extensions[0]; downloadFile(registeredAdapter.serialize(project), `${baseName}.${extension}`, registeredAdapter.mime); return; }
  if (format === 'json') {
    downloadFile(JSON.stringify(project, null, 2), `${baseName}.json`, 'application/json;charset=utf-8');
    return;
  }
  if (format === 'glyphind') {
    downloadFile(JSON.stringify({ format: 'glyphind', schemaVersion: 1, document: project }, null, 2), `${baseName}.glyphind`, 'application/vnd.glyphind+json;charset=utf-8');
    return;
  }
  if (format === 'csv') {
    let rows: string[][];
    if (project.type === 'matrix') {
      const matrix = readMatrixData(project);
      rows = [['Opción', ...matrix.columns], ...project.nodes.map((node) => [node.label, ...matrix.columns.map((column) => matrix.cells[node.id]?.[column] ?? '')])];
    } else if (project.type === 'cycle') {
      const cycle = readCycleData(project);
      rows = [['orden', 'paso', 'detalle', 'siguiente paso'], ...project.nodes.map((node, index) => [String(index + 1), node.label, node.detail, project.nodes[index + 1]?.label ?? (cycle.closedLoop ? project.nodes[0]?.label ?? '' : '')])];
    } else if (project.type === 'venn') {
      const [a, b] = ensureVennGroups(project);
      rows = [['Elemento', a.label, b.label], ...project.nodes.map((node) => [node.label, a.nodeIds.includes(node.id) ? 'Sí' : 'No', b.nodeIds.includes(node.id) ? 'Sí' : 'No'])];
    } else {
      rows = [['id', 'titulo', 'detalle', 'x', 'y', 'forma', 'tono', 'evidencia'], ...project.nodes.map((node, index) => [node.id, node.label, node.detail, String(node.x), String(node.y), shapeForNode(project.type, node, index), node.tone, node.evidenceId ?? ''])];
    }
    const csv = rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
    downloadFile(`\ufeff${csv}`, `${baseName}.csv`, 'text/csv;charset=utf-8');
    return;
  }
  if (format === 'svg') {
    downloadFile(exportProjectSvg(project), `${baseName}.svg`, 'image/svg+xml;charset=utf-8');
    return;
  }
  if (format === 'mermaid') {
    downloadFile(exportMermaid(project), `${baseName}.mmd`, 'text/plain;charset=utf-8');
    return;
  }
  if (format === 'excalidraw') {
    downloadFile(exportExcalidraw(project), `${baseName}.excalidraw`, 'application/json;charset=utf-8');
    return;
  }
  const semanticMarkdown = project.type === 'matrix'
    ? (() => { const matrix = readMatrixData(project); const cell = (value: string) => value.replace(/\|/g, '\\|').replace(/\r?\n/g, '<br>'); return `# ${project.name}\n\n| Opción | ${matrix.columns.map(cell).join(' | ')} |\n| ${['---', ...matrix.columns.map(() => '---')].join(' | ')} |\n${project.nodes.map((node) => `| ${cell(node.label)} | ${matrix.columns.map((column) => cell(matrix.cells[node.id]?.[column] ?? '')).join(' | ')} |`).join('\n')}`; })()
    : project.type === 'cycle'
      ? `# ${project.name}\n\n${project.nodes.map((node, index) => `${index + 1}. **${node.label}**${node.detail ? ` — ${node.detail}` : ''}`).join('\n')}\n\n${readCycleData(project).closedLoop ? `Al terminar **${project.nodes[0]?.label ?? 'el primer paso'}**, el proceso vuelve al inicio.` : 'Secuencia abierta: el proceso termina después del último paso.'}`
      : project.type === 'venn'
        ? (() => { const [a, b] = ensureVennGroups(project); return `# ${project.name}\n\nConjuntos: **${a.label}** y **${b.label}**.\n\n${project.nodes.map((node) => { const inA = a.nodeIds.includes(node.id), inB = b.nodeIds.includes(node.id); const region = inA && inB ? 'En ambos' : inA ? `Solo ${a.label}` : inB ? `Solo ${b.label}` : 'Fuera de ambos'; return `- **${node.label}** — ${region}${node.detail ? ` · ${node.detail}` : ''}`; }).join('\n')}`; })()
        : null;
  const specialized = semanticMarkdown ?? project.data?.document ?? (project.data?.slides ? project.data.slides.map((slide, index) => `## ${index + 1}. ${slide.title}\n\n${slide.body}`).join('\n\n') : project.data?.timeline ? project.data.timeline.map((item) => `## ${item.date} · ${item.title}\n\n${item.detail}`).join('\n\n') : project.data?.board ? project.data.board.map((column) => `## ${column.title}\n\n${column.cards.map((card) => `- **${card.title}** — ${card.detail}`).join('\n')}`).join('\n\n') : null);
  const body = specialized ?? [
    `# ${project.name}`,
    `Tipo: ${type.label}`,
    '',
    ...project.nodes.map((node, index) => `${index + 1}. **${node.label}** — ${node.detail}`),
    '',
    `Exportado desde Glyphind · ${new Date().toLocaleString('es-MX')}`,
  ].join('\n');
  downloadFile(body, `${baseName}.md`, 'text/markdown;charset=utf-8');
}

function downloadWorkspace(projects: Project[]) {
  const blob = new Blob([JSON.stringify(createWorkspaceEnvelope(projects), null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `glyphind-respaldo-${new Date().toISOString().slice(0, 10)}.glyphind`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}


function App() {
  const [projects, setProjects] = useState<Project[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? migrateProjects(JSON.parse(stored)) : [];
    } catch {
      return [];
    }
  });
  const [storageMode, setStorageMode] = useState<'cargando' | 'indexeddb' | 'localStorage'>('cargando');
  const [hydrated, setHydrated] = useState(false);
  const [activeView, setActiveView] = useState<'projects' | 'editor'>('projects');
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [mobileMenu, setMobileMenu] = useState(false);
  const [modal, setModal] = useState<'new' | 'edit' | null>(null);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState('');
  const [draftType, setDraftType] = useState('flow');
  const [localTemplates, setLocalTemplates] = useState<LocalTemplate[]>(() => readLocalTemplates(localStorage));
  const [formatPlugins, setFormatPlugins] = useState<FormatPlugin[]>(() => readFormatPlugins());
  const [showAiBuilder, setShowAiBuilder] = useState(false);
  const [aiBuilderText, setAiBuilderText] = useState('');
  const [aiBuilderUrl, setAiBuilderUrl] = useState('');
  const [aiBuilderName, setAiBuilderName] = useState('');
  const [aiBuilderType, setAiBuilderType] = useState('mindmap');
  const [aiBuilderMode, setAiBuilderMode] = useState<LocalAnalysisMode>('model');
  const [aiBuilderBusy, setAiBuilderBusy] = useState(false);
  const [aiBuilderProgress, setAiBuilderProgress] = useState<LocalAnalysisProgress | null>(null);
  const [aiBuilderError, setAiBuilderError] = useState('');
  const [showTemplateManager, setShowTemplateManager] = useState(false);
  const [showPluginManager, setShowPluginManager] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null);
  const menuButtonRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [toast, setToast] = useState('');
  const importInputRef = useRef<HTMLInputElement>(null);
  const toggleProjectMenu = (projectId: string, event: ReactMouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    if (openMenu === projectId) {
      setOpenMenu(null);
      setMenuPosition(null);
      menuButtonRef.current = null;
      return;
    }
    menuButtonRef.current = event.currentTarget;
    setMenuPosition(null);
    setOpenMenu(projectId);
  };
  const positionProjectMenu = () => {
    const button = menuButtonRef.current;
    const menu = menuRef.current;
    if (!openMenu || !button || !menu) return;
    const anchor = button.getBoundingClientRect();
    const bounds = menu.getBoundingClientRect();
    const margin = 12;
    const gap = 8;
    const hasRoomBelow = window.innerHeight - anchor.bottom >= bounds.height + gap + margin;
    const top = hasRoomBelow
      ? Math.min(window.innerHeight - bounds.height - margin, anchor.bottom + gap)
      : Math.max(margin, anchor.top - bounds.height - gap);
    const left = Math.max(margin, Math.min(window.innerWidth - bounds.width - margin, anchor.right - bounds.width));
    setMenuPosition({ top, left });
  };
  useLayoutEffect(() => {
    positionProjectMenu();
  }, [openMenu]);
  useEffect(() => {
    if (!openMenu) return;
    window.addEventListener('scroll', positionProjectMenu, true);
    window.addEventListener('resize', positionProjectMenu);
    return () => {
      window.removeEventListener('scroll', positionProjectMenu, true);
      window.removeEventListener('resize', positionProjectMenu);
    };
  }, [openMenu]);

  useEffect(() => {
    let mounted = true;
    loadWorkspace().then((loaded) => {
      if (!mounted) return;
      if (loaded.projects.length) setProjects(loaded.projects);
      setHydrated(true);
      setStorageMode('indexeddb');
      if (loaded.recoveredFromSnapshot) setToast('Se recuperó la última copia local disponible; revisa y exporta un respaldo.');
    }).catch(() => {
      if (!mounted) return;
      setHydrated(true);
      setStorageMode('localStorage');
    });
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    persistWorkspace(projects).then(setStorageMode);
  }, [projects, hydrated]);

  useEffect(() => {
    if (!hydrated || !window.location.search) return;
    const capture = parseShareTarget(window.location.search);
    if (!capture) return;
    const project = createProject(capture.title, 'document');
    const source: GlyphindSource = {
      id: `source-share-${Date.now()}`,
      kind: capture.url ? 'url' : 'text',
      ...(capture.url ? { url: capture.url } : {}),
      title: capture.title,
      capturedAt: new Date().toISOString(),
      ...(capture.text ? { fragment: capture.text.slice(0, 280) } : {}),
      generatedBy: 'user',
    };
    const sharedProject: Project = {
      ...project,
      name: capture.title,
      nodes: [],
      edges: [],
      pages: [{ id: 'page-main', title: 'Página principal', nodeIds: [], edgeIds: [] }],
      sources: [source],
      data: { ...project.data, document: formatSharedDocument(capture) },
    };
    setProjects((current) => [sharedProject, ...current]);
    setFilter('all');
    setSearch('');
    window.history.replaceState({}, '', `${window.location.pathname}${window.location.hash}`);
    setToast('Contenido compartido guardado localmente con su fuente');
    openProject(sharedProject);
  }, [hydrated]);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(''), 2600);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const activeProject = projects.find((project) => project.id === activeProjectId) ?? null;
  const filteredProjects = useMemo(() => projects.filter((project) => {
    const matchesSearch = project.name.toLowerCase().includes(search.toLowerCase());
    const matchesFilter = filter === 'all' || project.type === filter;
    return matchesSearch && matchesFilter;
  }), [projects, search, filter]);

  const openProject = (project: Project) => {
    setActiveProjectId(project.id);
    setActiveView('editor');
    setOpenMenu(null);
    setMobileMenu(false);
  };

  const updateProject = (id: string, patch: Partial<Project>) => {
    setProjects((current) => current.map((project) => {
      if (project.id !== id) return project;
      const next = { ...project, ...patch, updated: Date.now() };
      const summary = describeProjectChange(project, next);
      if (summary === 'Cambio del proyecto') return next;
      const operations = project.history ?? [];
      const last = operations[operations.length - 1];
      const now = Date.now();
      const changes = collectProjectDiff(project, next);
      const canCoalesce = last && last.summary === summary && now - Date.parse(last.at) < 800;
      const mergedChanges = canCoalesce ? mergeDiffs(last.changes ?? [], changes) : changes;
      const operation = { id: canCoalesce ? last.id : `op-${now}`, at: new Date(now).toISOString(), type: 'edit', summary, changes: mergedChanges };
      const history = canCoalesce ? [...operations.slice(0, -1), operation] : [...operations, operation].slice(-100);
      return { ...next, history };
    }));
  };

  const persistTemplateList = (next: LocalTemplate[]) => {
    try { writeLocalTemplates(next, localStorage); setLocalTemplates(next); return true; }
    catch (error) { setToast(error instanceof Error ? error.message : 'No se pudo guardar la plantilla local'); return false; }
  };
  const saveCurrentTemplate = (source: Project | null = activeProject, name = templateName) => {
    if (!source) { setToast('Abre un proyecto para guardar una plantilla'); return; }
    try {
      const entry = createLocalTemplate(source, name.trim() || source.name);
      if (persistTemplateList([...localTemplates, entry])) { setTemplateName(''); setToast('Plantilla guardada solo en este dispositivo'); }
    } catch (error) { setToast(error instanceof Error ? error.message : 'No se pudo guardar la plantilla'); }
  };
  const applyDashboardTemplate = (template: LocalTemplate) => {
    if (!activeProject) { setToast('Abre el proyecto donde quieras aplicar la plantilla'); return; }
    try { updateProject(activeProject.id, applyTemplateProject(activeProject, template)); setToast(`Plantilla «${template.name}» aplicada`); }
    catch (error) { setToast(error instanceof Error ? error.message : 'No se pudo aplicar la plantilla'); }
  };
  const removeLocalTemplate = (id: string) => {
    const next = localTemplates.filter((template) => template.id !== id);
    if (persistTemplateList(next)) setToast('Plantilla eliminada del dispositivo');
  };

  const submitProject = (event: FormEvent) => {
    event.preventDefault();
    if (modal === 'new') {
      const project = createProject(draftName, draftType, draftType === 'presentation' ? projects : []);
      setProjects((current) => [project, ...current]);
      setModal(null);
      setToast('Proyecto creado y guardado localmente');
      openProject(project);
      return;
    }
    if (modal === 'edit' && editingProjectId) {
      const currentProject = projects.find((project) => project.id === editingProjectId);
      const nextNodes = currentProject && currentProject.type !== draftType
        ? (defaultNodes[draftType] ?? defaultNodes.flow).map((node) => ({ ...node, id: `${node.id}-${Date.now()}` }))
        : undefined;
      updateProject(editingProjectId, {
        name: draftName.trim() || 'Proyecto sin título',
        type: draftType,
        ...(nextNodes ? { nodes: nextNodes, edges: createEdgesFromNodes(draftType, nextNodes), pages: [{ id: 'page-main', title: 'Página principal', nodeIds: nextNodes.map((node) => node.id), edgeIds: createEdgesFromNodes(draftType, nextNodes).map((edge) => edge.id) }], sources: [] } : {}),
      });
      setModal(null);
      setToast('Cambios guardados localmente');
    }
  };

  const openNewModal = () => {
    setDraftName('');
    setDraftType('flow');
    setModal('new');
  };

  const openAiBuilder = () => {
    setAiBuilderText('');
    setAiBuilderUrl('');
    setAiBuilderName('');
    setAiBuilderType('mindmap');
    setAiBuilderMode('model');
    setAiBuilderError('');
    setAiBuilderProgress(null);
    setShowAiBuilder(true);
  };

  const createDiagramFromText = async (event: FormEvent) => {
    event.preventDefault();
    if (aiBuilderBusy) return;
    let raw = aiBuilderText.trim();
    const sourceUrl = aiBuilderUrl.trim();
    setAiBuilderBusy(true);
    setAiBuilderError('');
    setAiBuilderProgress(aiBuilderMode === 'model' ? { stage: 'starting' } : null);
    try {
      if (sourceUrl) {
        const parsed = new URL(sourceUrl);
        if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('La URL debe empezar con http:// o https://.');
        setAiBuilderProgress({ stage: 'fetching' });
        const controller = new AbortController();
        const timeout = window.setTimeout(() => controller.abort(), 20_000);
        try { raw = await readBoundedTextResponse(await fetch(sourceUrl, { signal: controller.signal }), MAX_WEB_SOURCE_BYTES); }
        catch (error) {
          if (error instanceof DOMException && error.name === 'AbortError') throw new Error('La página tardó más de 20 segundos. Pega el texto o inténtalo otra vez.');
          if (error instanceof TypeError || (error instanceof Error && error.message.includes('Failed to fetch'))) throw new Error('El sitio bloquea la lectura directa por CORS. Pega aquí el texto o el HTML; Glyphind no usa un proxy remoto.');
          throw error;
        } finally { window.clearTimeout(timeout); }
      }
      if (new TextEncoder().encode(raw).byteLength > MAX_WEB_SOURCE_BYTES) throw new Error('El texto supera 1 MB. Divide el material en partes para mantener el análisis en el dispositivo.');
      if (raw.length < 24) throw new Error('Pega una frase completa o agrega una URL compatible para poder crear tarjetas.');
      setAiBuilderProgress(aiBuilderMode === 'model' ? { stage: 'starting' } : null);
      const analysis = await analyzeLocally(raw, sourceUrl || undefined, aiBuilderMode, setAiBuilderProgress);
      const title = aiBuilderName.trim() || (analysis.title !== 'Información extraída' ? analysis.title : 'Ideas desde texto');
      const seed = createProject(title, aiBuilderType);
      const project = populateProjectFromAnalysis(seed, analysis, sourceUrl || undefined);
      setProjects((current) => [project, ...current]);
      setFilter('all');
      setSearch('');
      setShowAiBuilder(false);
      setAiBuilderText('');
      setAiBuilderUrl('');
      openProject(project);
      const fallback = analysis.modelError ? ' (se usó extracción local de respaldo)' : '';
      setToast(`Diagrama creado con ${project.nodes.length - 1} hallazgos y fuentes rastreables${fallback}`);
    } catch (error) {
      setAiBuilderError(error instanceof Error ? error.message : 'No se pudo crear el diagrama. Revisa el texto e inténtalo otra vez.');
    } finally {
      setAiBuilderBusy(false);
      setAiBuilderProgress(null);
    }
  };

  const openEditModal = (project: Project) => {
    setEditingProjectId(project.id);
    setDraftName(project.name);
    setDraftType(project.type);
    setOpenMenu(null);
    setModal('edit');
  };

  const duplicateProject = (project: Project) => {
    const nodeIdMap = new Map(project.nodes.map((node) => [node.id, `${node.id}-copy`]))
    const nodes = project.nodes.map((node) => ({ ...node, id: nodeIdMap.get(node.id) ?? `${node.id}-copy` }));
    const duplicate: Project = {
      ...project,
      id: `project-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: `${project.name} · copia`,
      updated: Date.now(),
      nodes,
      edges: project.edges.map((edge) => ({ ...edge, id: `${edge.id}-copy`, from: nodeIdMap.get(edge.from) ?? edge.from, to: nodeIdMap.get(edge.to) ?? edge.to })),
      pages: project.pages.map((page) => ({ ...page, id: `${page.id}-copy`, nodeIds: page.nodeIds.map((id) => nodeIdMap.get(id) ?? id), edgeIds: page.edgeIds.map((id) => `${id}-copy`) })),
      sources: project.sources.map((source) => ({ ...source, id: `${source.id}-copy`, nodeIds: source.nodeIds?.map((id) => nodeIdMap.get(id) ?? id) })),
    };
    setProjects((current) => [duplicate, ...current]);
    setOpenMenu(null);
    setToast('Copia creada y guardada localmente');
  };

  const removeProject = (project: Project) => {
    if (!window.confirm(`¿Eliminar «${project.name}»? Esta acción no se puede deshacer.`)) return;
    setProjects((current) => current.filter((item) => item.id !== project.id));
    setOpenMenu(null);
    setToast('Proyecto eliminado del dispositivo');
  };

  const importFile = (file: File, additionalFiles = 0) => {
    if (!file) return;
    const additionalNotice = additionalFiles > 0 ? ` (se importó este archivo; quedan ${additionalFiles} archivo(s) por importar)` : '';
    if (file.size > 10_000_000) { setToast('El archivo supera el límite de importación de 10 MB.' + additionalNotice); return; }
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const raw = String(reader.result);
        const extension = file.name.split('.').pop()?.toLowerCase();
        const adapter = extension ? formatAdapterRegistry.byExtension(extension) : undefined;
        if (adapter?.parse) {
          const project = adapter.parse(raw, file.name);
          setProjects((current) => [project, ...current]);
          setFilter('all');
          setSearch('');
          setToast(`${adapter.name} importado: ${project.nodes.length} elementos y ${project.edges.length} conectores${additionalNotice}`);
          return;
        }
        const parsed = JSON.parse(raw);
        if (parsed?.format === 'glyphind-plugin' && Array.isArray(parsed.plugins)) {
          const incoming: FormatPlugin[] = (parsed.plugins as unknown[]).filter((plugin: unknown): plugin is FormatPlugin => Boolean(plugin && typeof plugin === 'object' && typeof (plugin as FormatPlugin).id === 'string' && typeof (plugin as FormatPlugin).name === 'string' && Array.isArray((plugin as FormatPlugin).extensions) && ((plugin as FormatPlugin).kind === 'importer' || (plugin as FormatPlugin).kind === 'exporter')));
          const merged = [...formatPlugins, ...incoming.map((plugin) => ({ ...plugin, enabled: false }))];
          writeFormatPlugins(merged);
          const stored = readFormatPlugins();
          setFormatPlugins(stored);
          setToast(`${Math.max(0, stored.length - formatPlugins.length)} descriptor(es) local(es) válidos guardados; no habilitan parsers ni ejecutan código${additionalNotice}`);
          return;
        }
        const imported = parsed?.document ? [parsed.document] : (Array.isArray(parsed) ? parsed : parsed?.projects ?? (parsed?.nodes && parsed?.name ? [parsed] : undefined));
        const normalized = migrateProjects(imported);
        if (!normalized.length) throw new Error('Formato inválido');
        setProjects(normalized);
        setFilter('all');
        setSearch('');
        setToast(`${normalized.length} proyectos restaurados con esquema Glyphind v1${additionalNotice}`);
      } catch (error) {
        setToast((error instanceof Error ? error.message : 'No se pudo importar el archivo') + additionalNotice);
      }
    };
    reader.onerror = () => setToast('No se pudo leer el archivo seleccionado.' + additionalNotice);
    reader.readAsText(file);
  };
  const importWorkspace = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (file) importFile(file);
  };

  if (activeView === 'editor' && activeProject) {
    return (
      <div className="editor-drop-zone" onDragOver={(event) => { if (event.dataTransfer.types.includes('Files')) event.preventDefault(); }} onDrop={(event) => { const files = event.dataTransfer.files; const file = files[0]; if (file) { event.preventDefault(); importFile(file, Math.max(0, files.length - 1)); } }}>
        {toast && <div className="toast" role="status" aria-live="polite"><span className="toast-check">✓</span>{toast}</div>}
        <Editor
          project={activeProject}
          allProjects={projects}
          onBack={() => setActiveView('projects')}
        onChange={(nextProject) => updateProject(nextProject.id, nextProject)}
        onToast={setToast}
        onTemplatesChange={setLocalTemplates}
        />
      </div>
    );
  }

  return (
    <div className="app-shell" onDragOver={(event) => { if (event.dataTransfer.types.includes('Files')) event.preventDefault(); }} onDrop={(event) => { const file = event.dataTransfer.files[0]; if (file) { event.preventDefault(); importFile(file); } }}>
      <aside className={`sidebar ${mobileMenu ? 'is-open' : ''}`}>
        <div className="sidebar-top">
          <div className="brand"><BrandMark /><span>Glyphind</span></div>
          <button className="icon-button sidebar-close" aria-label="Cerrar menú" onClick={() => setMobileMenu(false)}><Icon name="close" /></button>
        </div>
        <div className="sidebar-rule" />
        <nav className="sidebar-nav" aria-label="Navegación principal">
          <p className="nav-label">Espacio de trabajo</p>
          <button className={`nav-item ${filter === 'all' ? 'is-active' : ''}`} onClick={() => { setActiveView('projects'); setFilter('all'); setMobileMenu(false); }}><Icon name="grid" /><span>Todos los proyectos</span><strong>{projects.length}</strong></button>
          <div className="nav-scroll">
            {diagramGroups.map((group) => <div className="nav-group" key={group.id}><p className="nav-group-label">{group.label}</p>{availableDiagramTypes.filter((item) => item.group === group.id).map((item) => <button className={`nav-item ${filter === item.id ? 'is-active' : ''}`} key={item.id} onClick={() => { setActiveView('projects'); setFilter(item.id); setMobileMenu(false); }}><Icon name={item.icon} /><span>{item.label}</span><strong>{projects.filter((project) => project.type === item.id).length || ''}</strong></button>)}</div>)}
          </div>
        </nav>
        <div className="sidebar-bottom">
          <div className="workspace-actions"><button className="sidebar-action" onClick={() => downloadWorkspace(projects)}><Icon name="arrow" size={14} /> Exportar respaldo</button><button className="sidebar-action" onClick={() => importInputRef.current?.click()}><Icon name="folder" size={14} /> Importar archivo</button><button className="sidebar-action" onClick={() => setShowTemplateManager((open) => !open)}>Plantillas locales ({localTemplates.length})</button><button className="sidebar-action" onClick={() => setShowPluginManager((open) => !open)}>Catálogo de formatos ({formatPlugins.length})</button><input ref={importInputRef} type="file" accept="application/vnd.glyphind+json,application/json,.json,.glyphind,.mmd,.mermaid,.md,.markdown,.excalidraw" hidden onChange={importWorkspace} /></div>
          {showTemplateManager && <section className="local-manager" aria-label="Biblioteca de plantillas"><h3>Biblioteca local</h3><label className="field-label">Nombre de esta plantilla<input value={templateName} onChange={(event) => setTemplateName(event.target.value)} placeholder="Ej. Flujo de aprobación" /></label><button className="sidebar-action" onClick={() => saveCurrentTemplate()}>Guardar proyecto actual como plantilla</button>{localTemplates.map((template) => <div className="local-manager-row" key={template.id}><span>{template.name} · {typeFor(template.type).label}</span><button className="sidebar-action" onClick={() => applyDashboardTemplate(template)}>Aplicar</button><button className="sidebar-action" onClick={() => removeLocalTemplate(template.id)}>Eliminar</button></div>)}</section>}
          {showPluginManager && <section className="local-manager" aria-label="Plugins de formato"><h3>Extensiones registradas</h3><p>Este catálogo guarda metadatos locales únicamente. Los descriptores importados no habilitan funciones de importación/exportación ni ejecutan código; los formatos disponibles siguen siendo los integrados en Glyphind.</p>{formatPlugins.length ? formatPlugins.map((plugin) => <div className="local-manager-row" key={plugin.id}><span>{plugin.name} · .{plugin.extensions.join(', .')} · {plugin.kind}</span><span className="plugin-status">Metadatos · sin ejecución</span><button className="sidebar-action" onClick={() => { const next = formatPlugins.filter((item) => item.id !== plugin.id); writeFormatPlugins(next); setFormatPlugins(next); }}>Eliminar</button></div>) : <p>No hay plugins instalados.</p>}<button className="sidebar-action" onClick={() => importInputRef.current?.click()}>Importar descriptor JSON</button></section>}
          <div className="powered-by">Powered by <strong>InnovA+</strong></div><div className="sidebar-footnote"><span>G</span><span>Glyphind <em>0.1</em></span></div>
        </div>
      </aside>
      {mobileMenu && <button className="sidebar-overlay" aria-label="Cerrar menú" onClick={() => setMobileMenu(false)} />}

      <main className="main-content">
        <header className="topbar">
          <button className="icon-button mobile-menu-button" aria-label="Abrir menú" onClick={() => setMobileMenu(true)}><Icon name="menu" /></button>
          <div className="breadcrumbs"><span>Espacio de trabajo</span><span className="breadcrumb-slash">/</span><strong>Proyectos</strong></div>
          <div className="topbar-actions"><button className="top-new-button" onClick={openNewModal}><Icon name="plus" size={16} /> Nuevo proyecto</button></div>
        </header>

        <div className="page-wrap">
          <section className="page-intro"><div><div className="eyebrow"><span className="eyebrow-line" /> Espacio de trabajo</div><h1>Mis proyectos <span className="project-count">{projects.length}</span></h1></div></section>

          <section className="quick-actions" aria-label="Acciones rápidas">
            <button className="quick-action quick-action-primary" onClick={openNewModal}>
              <span className="quick-action-icon"><Icon name="plus" size={18} /></span>
              <span><strong>Nuevo proyecto</strong><small>Empieza desde una plantilla</small></span>
            </button>
            <button className="quick-action quick-action-ai" onClick={openAiBuilder}>
              <span className="quick-action-icon"><Icon name="spark" size={18} /></span>
              <span><strong>Crear desde texto</strong><small>Extrae ideas y llena un mapa</small></span>
            </button>
            <button className="quick-action" onClick={() => importInputRef.current?.click()}>
              <span className="quick-action-icon"><Icon name="folder" size={17} /></span>
              <span><strong>Importar respaldo</strong><small>Continúa desde otro dispositivo</small></span>
            </button>
            <button className="quick-action" onClick={() => { downloadWorkspace(projects); setToast('Respaldo descargado'); }}>
              <span className="quick-action-icon"><Icon name="arrow" size={17} /></span>
              <span><strong>Exportar respaldo</strong><small>Guarda una copia local</small></span>
            </button>
          </section>

          <section className="project-toolbar" aria-label="Buscar y filtrar proyectos">
            <div className="search-box"><Icon name="search" size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar proyectos..." aria-label="Buscar proyectos" />{search && <button className="search-clear" onClick={() => setSearch('')}><Icon name="close" size={14} /></button>}</div>
            <label className="filter-box"><Icon name="filter" size={16} /><select value={filter} onChange={(event) => setFilter(event.target.value)} aria-label="Filtrar por tipo"><option value="all">Todos los tipos</option>{diagramGroups.map((group) => <optgroup key={group.id} label={group.label}>{availableDiagramTypes.filter((type) => type.group === group.id).map((type) => <option key={type.id} value={type.id}>{type.label}</option>)}</optgroup>)}</select><Icon name="chevron" size={15} /></label>
            <span className="toolbar-result">{filteredProjects.length} {filteredProjects.length === 1 ? 'proyecto' : 'proyectos'}</span>
          </section>

          <section className="projects-section">
            <div className="section-heading"><div><span className="section-kicker">Vista general</span><h2>Proyectos recientes</h2></div></div>
            {filteredProjects.length > 0 ? (
              <div className="project-list">
                {filteredProjects.map((project, index) => {
                  const type = typeFor(project.type);
                  return (
                    <article className={`project-row ${index === 0 && !search && filter === 'all' ? 'is-featured' : ''} ${openMenu === project.id ? 'menu-open' : ''}`} key={project.id} onDoubleClick={() => openProject(project)}>
                      <button className="project-main" onClick={() => openProject(project)}>
                        <span className="project-type-icon" style={{ color: type.color, backgroundColor: type.soft }}><Icon name={type.icon} size={23} /></span>
                        <span className="project-copy"><strong>{project.name}</strong><span>{type.label} <i>·</i> {project.nodes.length} elementos</span></span>
                      </button>
                      <span className="project-status"><span className="status-dot" /> {storageMode === 'indexeddb' ? 'Local · IndexedDB' : storageMode === 'cargando' ? 'Local · preparando' : 'Local · respaldo'}</span>
                      <span className="project-updated">{formatDate(project.updated)}</span>
                      <div className="project-actions"><button className="row-open" onClick={() => openProject(project)}>Abrir <Icon name="arrow" size={15} /></button><button className="icon-button more-button" aria-label={`Más opciones para ${project.name}`} aria-haspopup="menu" aria-expanded={openMenu === project.id} onClick={(event) => toggleProjectMenu(project.id, event)}><Icon name="more" /></button>{openMenu === project.id && <div ref={menuRef} className="context-menu" role="menu" style={{ top: menuPosition?.top ?? -1000, left: menuPosition?.left ?? 12, visibility: menuPosition ? 'visible' : 'hidden' }} onClick={(event) => event.stopPropagation()}><button onClick={() => openEditModal(project)}><Icon name="edit" size={15} /> Editar detalles</button><button onClick={() => duplicateProject(project)}><Icon name="copy" size={15} /> Duplicar proyecto</button><div className="menu-line" /><button className="danger" onClick={() => removeProject(project)}><Icon name="trash" size={15} /> Eliminar</button></div>}</div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="empty-state"><span className="empty-icon"><Icon name={projects.length === 0 ? 'plus' : 'search'} size={26} /></span><h3>{projects.length === 0 ? 'Tu espacio está listo' : 'No encontramos ese proyecto'}</h3><p>{projects.length === 0 ? 'Crea tu primer proyecto para empezar a organizar ideas, tareas y procesos.' : 'Prueba otra búsqueda o limpia los filtros para volver a ver tus proyectos.'}</p><button className="secondary-button" onClick={projects.length === 0 ? openNewModal : () => { setSearch(''); setFilter('all'); }}>{projects.length === 0 ? 'Crear primer proyecto' : 'Limpiar filtros'}</button></div>
            )}
          </section>

        </div>
      </main>

      {modal && <ProjectModal mode={modal} name={draftName} type={draftType} setName={setDraftName} setType={setDraftType} onSubmit={submitProject} onClose={() => setModal(null)} />}
      {showAiBuilder && <AiBuilderModal name={aiBuilderName} setName={setAiBuilderName} type={aiBuilderType} setType={setAiBuilderType} text={aiBuilderText} setText={setAiBuilderText} url={aiBuilderUrl} setUrl={setAiBuilderUrl} mode={aiBuilderMode} setMode={setAiBuilderMode} busy={aiBuilderBusy} progress={aiBuilderProgress} error={aiBuilderError} onSubmit={createDiagramFromText} onClose={() => { if (!aiBuilderBusy) setShowAiBuilder(false); }} />}
      {toast && <div className="toast" role="status" aria-live="polite"><span className="toast-check">✓</span>{toast}</div>}
    </div>
  );
}


function ProjectModal({ mode, name, type, setName, setType, onSubmit, onClose }: { mode: 'new' | 'edit'; name: string; type: string; setName: (value: string) => void; setType: (value: string) => void; onSubmit: (event: FormEvent) => void; onClose: () => void }) {
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}>
      <form className="project-modal" onSubmit={onSubmit}>
        <div className="modal-head"><div><span className="section-kicker">{mode === 'new' ? 'Nuevo lienzo' : 'Editar lienzo'}</span><h2>{mode === 'new' ? 'Elige cómo pensar' : 'Ajusta los detalles'}</h2></div><button type="button" className="icon-button" onClick={onClose} aria-label="Cerrar"><Icon name="close" /></button></div>
        <label className="field-label">Nombre del proyecto<input autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder="Ej. Flujo de incorporación" /></label>
        <div className="field-label">Tipo de diagrama<div className="type-choice-group"><span className="type-choice-group-label">Organizadores principales</span><div className="type-choice-grid">{featuredDiagramTypes.map((item) => <button type="button" key={item.id} className={`type-choice ${type === item.id ? 'is-selected' : ''}`} onClick={() => setType(item.id)}><span style={{ color: item.color, backgroundColor: item.soft }}><Icon name={item.icon} size={19} /></span><span><strong>{item.label}</strong><small>{item.description}</small></span>{type === item.id && <i>✓</i>}</button>)}</div></div><details className="more-type-options"><summary>Más herramientas de trabajo</summary>{diagramGroups.map((group) => <div className="type-choice-group" key={group.id}><span className="type-choice-group-label">{group.label}</span><div className="type-choice-grid">{availableDiagramTypes.filter((item) => item.group === group.id && !featuredDiagramIds.has(item.id)).map((item) => <button type="button" key={item.id} className={`type-choice ${type === item.id ? 'is-selected' : ''}`} onClick={() => setType(item.id)}><span style={{ color: item.color, backgroundColor: item.soft }}><Icon name={item.icon} size={19} /></span><span><strong>{item.label}</strong><small>{item.description}</small></span>{type === item.id && <i>✓</i>}</button>)}</div></div>)}</details></div>
        <div className="modal-foot"><span>Configura tu espacio y empieza a trabajar</span><div><button type="button" className="secondary-button" onClick={onClose}>Cancelar</button><button type="submit" className="primary-button">{mode === 'new' ? 'Crear proyecto' : 'Guardar cambios'} <Icon name="arrow" size={15} /></button></div></div>
      </form>
    </div>
  );
}


function ExportMenu({ project, onExport }: { project: Project; onExport: (format: ExportFormat) => void }) {
  const [open, setOpen] = useState(false);
  const canExportPng = !['document', 'presentation', 'board', 'timeline', 'matrix', 'cycle', 'venn'].includes(project.type);
  const options: Array<[ExportFormat, string]> = [['glyphind', 'Archivo .glyphind'], ['markdown', 'Markdown'], ...formatAdapterRegistry.list().filter((adapter) => adapter.serialize).map((adapter) => [adapter.id, `${adapter.name} (.${adapter.extensions[0]})`] as [string, string]), ['json', 'JSON editable'], ['csv', 'CSV de elementos'], ['svg', 'SVG vectorial'], ...(canExportPng ? [['png', 'Imagen PNG · 2×'] as [ExportFormat, string]] : [])];
  return <div className="export-menu"><button className="secondary-button" onClick={() => setOpen((value) => !value)} aria-expanded={open}><Icon name="arrow" size={14} /> Descargar <Icon name="chevron" size={14} /></button>{open && <div className="export-options">{options.map(([format, label]) => <button key={format} onClick={() => { onExport(format); setOpen(false); }}>{label}</button>)}</div>}</div>;
}

function WorkspaceFrame({ project, children, onBack, onExport }: { project: Project; children: React.ReactNode; onBack: () => void; onExport: (format: ExportFormat) => void }) {
  const type = typeFor(project.type);
  return <div className="editor-shell"><header className="editor-topbar"><button className="back-link" onClick={onBack}><Icon name="back" size={17} /> Volver a proyectos</button><div className="editor-breadcrumb"><span>/</span><span>{project.name}</span><span className="editor-type-pill" style={{ color: type.color, backgroundColor: type.soft }}><Icon name={type.icon} size={13} /> {type.label}</span></div><div className="editor-actions"><span className="saved-label"><span className="canvas-live-dot" /> Cambios activos</span><ExportMenu project={project} onExport={onExport} /></div></header><main className="specialized-main">{children}</main></div>;
}

function HistoryDock({ canUndo, canRedo, undo, redo, operations }: { canUndo: boolean; canRedo: boolean; undo: () => void; redo: () => void; operations: NonNullable<Project['history']> }) {
  return <nav className="specialized-history-dock" aria-label="Historial de edición"><button className="secondary-button" onClick={undo} disabled={!canUndo} aria-label="Deshacer cambio">↶ Deshacer</button><button className="secondary-button" onClick={redo} disabled={!canRedo} aria-label="Rehacer cambio">↷ Rehacer</button><details className="history-details"><summary>Historial ({operations.length})</summary><ol>{operations.slice(-12).reverse().map((operation) => <li key={operation.id}><strong>{operation.summary}</strong><time dateTime={operation.at}>{new Date(operation.at).toLocaleString()}</time>{Boolean(operation.changes?.length) && <HistoryDiff changes={operation.changes ?? []} />}</li>)}</ol></details></nav>;
}

function DocumentEditor({ project, onBack, onChange, onToast }: { project: Project; onBack: () => void; onChange: (project: Project) => void; onToast: (message: string) => void }) {
  const content = project.data?.document ?? '';
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const updateContent = (next: string) => onChange({ ...project, data: { ...project.data, document: next } });
  const insertSnippet = (snippet: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return updateContent(`${content}${content ? '\n\n' : ''}${snippet}`);
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const next = `${content.slice(0, start)}${snippet}${content.slice(end)}`;
    updateContent(next);
    window.requestAnimationFrame(() => { textarea.focus(); textarea.setSelectionRange(start + snippet.length, start + snippet.length); });
  };
  const clearDocument = () => { if (window.confirm('¿Limpiar todo el contenido del documento?')) { updateContent(''); onToast('Documento vacío listo para escribir'); } };
  return <WorkspaceFrame project={project} onBack={onBack} onExport={(format) => { downloadProject(project, format); onToast('Documento descargado'); }}>
    <div className="specialized-heading"><div><span className="section-kicker">Editor de documento</span><h1>{project.name}</h1><p>Redacta, estructura y revisa el contenido directamente.</p></div><button className="secondary-button" onClick={() => insertSnippet('- [ ] Nueva tarea')}><Icon name="checklist" size={15} /> Añadir tarea</button></div>
    <div className="document-workspace">
      <div className="document-toolbar" aria-label="Herramientas de formato">
        <button onClick={() => insertSnippet('# Título')}><strong>H1</strong><span>Título</span></button>
        <button onClick={() => insertSnippet('## Sección')}><strong>H2</strong><span>Sección</span></button>
        <button onClick={() => insertSnippet('- Elemento')}><Icon name="checklist" size={15} /><span>Lista</span></button>
        <button onClick={() => insertSnippet('> Nota importante')}><strong>“</strong><span>Nota</span></button>
        <button onClick={() => insertSnippet('\n---\n')}><strong>—</strong><span>Separador</span></button>
        <span className="document-toolbar-spacer" />
        <button className="document-clear" onClick={clearDocument}><Icon name="trash" size={14} /><span>Limpiar</span></button>
      </div>
      <textarea ref={textareaRef} className="document-textarea" value={content} onChange={(event) => updateContent(event.target.value)} spellCheck />
    </div>
    <div className="specialized-foot">{content.split(/\s+/).filter(Boolean).length} palabras · cambios guardados automáticamente · Markdown compatible</div>
  </WorkspaceFrame>;
}

function DiagramSlidePreview({ project }: { project: Project }) {
  const type = typeFor(project.type);
  return <div className="diagram-slide-preview"><div className="diagram-slide-preview-head"><span className="project-type-icon" style={{ color: type.color, backgroundColor: type.soft }}><Icon name={type.icon} size={17} /></span><div><strong>{project.name}</strong><small>{type.label} · {project.nodes.length} elementos</small></div></div><div className="diagram-preview-map">{project.nodes.slice(0, 8).map((node) => <span className={`diagram-preview-node node-${node.tone}`} key={node.id}>{node.label}</span>)}</div></div>;
}

function PresentationEditor({ project, allProjects, onBack, onChange, onToast }: { project: Project; allProjects: Project[]; onBack: () => void; onChange: (project: Project) => void; onToast: (message: string) => void }) {
  const slides = project.data?.slides ?? [];
  const diagramProjects = allProjects.filter((item) => item.id !== project.id && item.type !== 'presentation');
  const [active, setActive] = useState(0);
  const slide = slides[active] ?? slides[0];
  useEffect(() => {
    const syncedSlides = syncPresentationSlides(slides, diagramProjects);
    const changed = syncedSlides.length !== slides.length || syncedSlides.some((item, index) => item.id !== slides[index]?.id);
    if (changed) onChange({ ...project, data: { ...project.data, slides: syncedSlides } });
  }, [project.id]);
  const update = (patch: Partial<Slide>) => slide && onChange({ ...project, data: { ...project.data, slides: slides.map((item, index) => index === active ? { ...item, ...patch } : item) } });
  const add = () => { const next = { id: `slide-${Date.now()}`, title: 'Nueva diapositiva', body: 'Añade el contenido de esta diapositiva.' }; onChange({ ...project, data: { ...project.data, slides: [...slides, next] } }); setActive(slides.length); onToast('Diapositiva añadida'); };
  const duplicate = () => { if (!slide) return; const copy = { ...slide, id: `slide-${Date.now()}`, title: `${slide.title || 'Diapositiva'} · copia`, diagramProjectId: undefined }; const next = [...slides.slice(0, active + 1), copy, ...slides.slice(active + 1)]; onChange({ ...project, data: { ...project.data, slides: next } }); setActive(active + 1); onToast('Diapositiva duplicada'); };
  const remove = () => { if (slides.length <= 1) return; const next = slides.filter((_, index) => index !== active); onChange({ ...project, data: { ...project.data, slides: next } }); setActive(Math.max(0, active - 1)); };
  const refreshDiagrams = () => {
    const syncedSlides = syncPresentationSlides(slides, diagramProjects);
    onChange({ ...project, data: { ...project.data, slides: syncedSlides } });
    setActive(Math.min(active, Math.max(0, syncedSlides.length - 1)));
    onToast(`${diagramProjects.length} diagramas incluidos en la presentación`);
  };
  const linkedProject = slide?.diagramProjectId ? allProjects.find((item) => item.id === slide.diagramProjectId) : undefined;
  return <WorkspaceFrame project={project} onBack={onBack} onExport={(format) => { downloadProject(project, format); onToast('Presentación descargada'); }}><div className="specialized-heading"><div><span className="section-kicker">Editor de presentación</span><h1>{project.name}</h1><p>Construye la narrativa y presenta todos los diagramas de tu espacio.</p></div><div className="heading-actions"><button className="secondary-button" onClick={refreshDiagrams}><Icon name="grid" size={15} /> Actualizar diagramas</button><button className="secondary-button" onClick={duplicate} disabled={!slide}><Icon name="copy" size={15} /> Duplicar diapositiva</button></div></div><div className="presentation-workspace"><aside className="slide-list"><div className="slide-list-heading"><span>Diapositivas</span><small>{diagramProjects.length} diagramas</small></div>{slides.map((item, index) => <button className={`slide-thumb ${index === active ? 'is-active' : ''} ${item.diagramProjectId ? 'is-diagram' : ''}`} key={item.id} onClick={() => setActive(index)}><span>{index + 1}</span><strong>{item.title || 'Sin título'}</strong>{item.diagramProjectId && <em>Diagrama</em>}</button>)}<button className="add-slide" onClick={add}><Icon name="plus" size={14} /> Añadir diapositiva</button></aside><section className="slide-editor">{slide && <><div className="slide-editor-toolbar"><span>{linkedProject ? 'Diagrama incluido' : 'Contenido editable'}</span><span>{active + 1} / {slides.length}</span></div>{linkedProject && <DiagramSlidePreview project={linkedProject} />}<input className="slide-title-input" value={slide.title} onChange={(event) => update({ title: event.target.value })} placeholder="Título de la diapositiva" /><textarea className="slide-body-input" value={slide.body} onChange={(event) => update({ body: event.target.value })} placeholder="Contenido, notas o instrucciones" /><button className="delete-slide" onClick={remove} disabled={slides.length <= 1}><Icon name="trash" size={14} /> Eliminar diapositiva</button></>}</section></div></WorkspaceFrame>;
}

function BoardEditor({ project, onBack, onChange, onToast }: { project: Project; onBack: () => void; onChange: (project: Project) => void; onToast: (message: string) => void }) {
  const columns = project.data?.board ?? [];
  const save = (board: BoardColumn[]) => onChange({ ...project, data: { ...project.data, board } });
  const addColumn = () => save([...columns, { id: createLocalId('column'), title: `Etapa ${columns.length + 1}`, cards: [] }]);
  const updateColumn = (id: string, patch: Partial<BoardColumn>) => save(columns.map((column) => column.id === id ? { ...column, ...patch } : column));
  const addCard = (columnId: string) => {
    const column = columns.find((item) => item.id === columnId);
    if (!column) return;
    if (column.wipLimit !== undefined && column.cards.length >= column.wipLimit) { onToast('Límite WIP alcanzado; mueve una tarjeta o aumenta el límite.'); return; }
    save(columns.map((item) => item.id === columnId ? { ...item, cards: [...item.cards, { id: createLocalId('card'), title: 'Nueva tarjeta', detail: 'Describe el trabajo' }] } : item));
  };
  const updateCard = (columnId: string, cardId: string, patch: Partial<BoardCard>) => save(columns.map((column) => column.id === columnId ? { ...column, cards: column.cards.map((card) => card.id === cardId ? { ...card, ...patch } : card) } : column));
  const moveCardTo = (cardId: string, targetId: string) => {
    const result = moveBoardCard(columns, cardId, targetId);
    if (result.reason === 'wip-limit') { onToast('La etapa destino alcanzó su límite WIP.'); return; }
    if (result.moved) { save(result.columns); onToast('Tarjeta movida a la etapa seleccionada.'); }
  };
  const duplicateCard = (columnId: string, card: BoardCard) => {
    const column = columns.find((item) => item.id === columnId);
    if (!column) return;
    if (column.wipLimit !== undefined && column.cards.length >= column.wipLimit) { onToast('Límite WIP alcanzado; no se duplicó la tarjeta.'); return; }
    updateColumn(columnId, { cards: [...column.cards, { ...card, id: createLocalId('card'), title: `${card.title} · copia` }] });
  };
  const removeCard = (columnId: string, cardId: string) => updateColumn(columnId, { cards: columns.find((item) => item.id === columnId)?.cards.filter((card) => card.id !== cardId) ?? [] });
  const removeColumn = (columnId: string) => {
    const column = columns.find((item) => item.id === columnId);
    if (!column || columns.length <= 1) return;
    if (column.cards.length) { onToast('Mueve o elimina las tarjetas antes de eliminar la etapa.'); return; }
    save(columns.filter((item) => item.id !== columnId));
  };
  return <WorkspaceFrame project={project} onBack={onBack} onExport={(format) => { downloadProject(project, format); onToast('Tablero descargado'); }}>
    <div className="specialized-heading"><div><span className="section-kicker">Tablero de trabajo</span><h1>{project.name}</h1><p>Organiza etapas, límites de trabajo y tarjetas.</p></div><div className="heading-actions"><button className="secondary-button" onClick={addColumn}><Icon name="plus" size={15} /> Añadir etapa</button><button className="secondary-button" onClick={() => addCard(columns[0]?.id ?? '')} disabled={!columns.length}><Icon name="plus" size={15} /> Nueva tarjeta</button></div></div>
    <div className="board-workspace">{columns.map((column, columnIndex) => <section className="board-column" key={column.id} aria-label={`Etapa ${column.title}`}>
      <header className="board-column-head"><input aria-label={`Nombre de etapa ${columnIndex + 1}`} value={column.title} onChange={(event) => updateColumn(column.id, { title: event.target.value })} /><span>{column.cards.length}{column.wipLimit !== undefined ? ` / ${column.wipLimit}` : ''}</span><label className="board-wip-label">WIP<input aria-label={`Límite WIP de ${column.title}`} type="number" min="1" max="999" value={column.wipLimit ?? ''} placeholder="∞" onChange={(event) => { const value = event.target.value === '' ? undefined : Math.max(1, Number(event.target.value)); updateColumn(column.id, { wipLimit: value }); }} /></label><div className="board-column-actions"><button onClick={() => save(reorderBoardColumn(columns, columnIndex, -1))} disabled={columnIndex === 0} aria-label={`Mover ${column.title} a la izquierda`}>←</button><button onClick={() => save(reorderBoardColumn(columns, columnIndex, 1))} disabled={columnIndex === columns.length - 1} aria-label={`Mover ${column.title} a la derecha`}>→</button><button className="danger-action" onClick={() => removeColumn(column.id)} disabled={columns.length <= 1 || Boolean(column.cards.length)} aria-label={`Eliminar etapa ${column.title}`} title={column.cards.length ? 'Vacía la etapa antes de eliminarla' : 'Eliminar etapa'}><Icon name="trash" size={13} /></button></div></header>
      {column.cards.map((card) => <article className="board-card" key={card.id}><input aria-label="Título de tarjeta" value={card.title} onChange={(event) => updateCard(column.id, card.id, { title: event.target.value })} /><textarea aria-label="Detalle de tarjeta" value={card.detail} onChange={(event) => updateCard(column.id, card.id, { detail: event.target.value })} rows={2} /><label className="board-move-label">Mover a<select aria-label={`Mover ${card.title} a etapa`} value={column.id} onChange={(event) => moveCardTo(card.id, event.target.value)}>{columns.map((target) => <option key={target.id} value={target.id}>{target.title}</option>)}</select></label><div className="card-actions"><button onClick={() => duplicateCard(column.id, card)} title="Duplicar tarjeta" aria-label="Duplicar tarjeta"><Icon name="copy" size={13} /></button><button className="danger-action" onClick={() => removeCard(column.id, card.id)} title="Eliminar tarjeta" aria-label="Eliminar tarjeta"><Icon name="trash" size={13} /></button></div></article>)}
      <button className="add-card" onClick={() => addCard(column.id)} disabled={column.wipLimit !== undefined && column.cards.length >= column.wipLimit}><Icon name="plus" size={14} /> Añadir tarjeta</button>
    </section>)}</div>
  </WorkspaceFrame>;
}

function TimelineEditor({ project, onBack, onChange, onToast }: { project: Project; onBack: () => void; onChange: (project: Project) => void; onToast: (message: string) => void }) {
  const items = project.data?.timeline ?? [];
  const update = (id: string, patch: Partial<TimelineItem>) => onChange({ ...project, data: { ...project.data, timeline: items.map((item) => item.id === id ? { ...item, ...patch } : item) } });
  const add = () => { const next = { id: createLocalId('phase'), title: 'Nueva fase', date: '', duration: '', detail: 'Define el resultado de esta fase.', dependsOn: [] as string[] }; onChange({ ...project, data: { ...project.data, timeline: [...items, next] } }); onToast('Fase añadida'); };
  const duplicate = (item: TimelineItem) => { const copy = { ...item, id: createLocalId('phase'), title: `${item.title} · copia`, dependsOn: [] }; onChange({ ...project, data: { ...project.data, timeline: [...items, copy] } }); onToast('Fase duplicada sin copiar dependencias'); };
  const move = (index: number, direction: -1 | 1) => { const target = index + direction; if (target < 0 || target >= items.length) return; const next = [...items]; [next[index], next[target]] = [next[target], next[index]]; onChange({ ...project, data: { ...project.data, timeline: next } }); };
  const togglePhaseDependency = (id: string, targetId: string) => { const next = toggleDependency(items, id, targetId); if (next === items) { onToast('Esa dependencia crearía un ciclo; no se aplicó.'); return; } onChange({ ...project, data: { ...project.data, timeline: next } }); };
  const remove = (id: string) => { if (items.length <= 1) return; const next = items.filter((item) => item.id !== id).map((item) => ({ ...item, dependsOn: item.dependsOn?.filter((dependencyId) => dependencyId !== id) })); onChange({ ...project, data: { ...project.data, timeline: next } }); onToast('Fase eliminada y dependencias entrantes limpiadas'); };
  return <WorkspaceFrame project={project} onBack={onBack} onExport={(format) => { downloadProject(project, format); onToast('Cronograma descargado'); }}>
    <div className="specialized-heading"><div><span className="section-kicker">Cronograma</span><h1>{project.name}</h1><p>Planifica fechas, duración, dependencias y entregables.</p></div><button className="secondary-button" onClick={add}><Icon name="plus" size={15} /> Añadir fase</button></div>
    <div className="timeline-workspace">{items.map((item, index) => <article className="timeline-item" key={item.id}><span className="timeline-index">{index + 1}</span><div><input className="timeline-date" aria-label={`Fecha de ${item.title}`} value={item.date} placeholder="Fecha o AAAA-MM-DD" onChange={(event) => update(item.id, { date: event.target.value })} /><input className="timeline-title" aria-label="Nombre de fase" value={item.title} onChange={(event) => update(item.id, { title: event.target.value })} /><label className="timeline-duration">Duración<input aria-label={`Duración de ${item.title}`} value={item.duration ?? ''} placeholder="p. ej. 2 semanas" onChange={(event) => update(item.id, { duration: event.target.value })} /></label><textarea aria-label={`Entregable de ${item.title}`} value={item.detail} onChange={(event) => update(item.id, { detail: event.target.value })} rows={2} /><fieldset className="timeline-dependencies"><legend>Depende de</legend>{items.filter((candidate) => candidate.id !== item.id).map((candidate) => <label key={candidate.id}><input type="checkbox" checked={item.dependsOn?.includes(candidate.id) ?? false} onChange={() => togglePhaseDependency(item.id, candidate.id)} />{candidate.title}</label>)}</fieldset><div className="timeline-actions"><button onClick={() => move(index, -1)} disabled={index === 0} title="Subir fase"><Icon name="back" size={14} /> Subir</button><button onClick={() => move(index, 1)} disabled={index === items.length - 1} title="Bajar fase"><Icon name="arrow" size={14} /> Bajar</button><button onClick={() => duplicate(item)} title="Duplicar fase"><Icon name="copy" size={14} /> Duplicar</button><button className="delete-slide" onClick={() => remove(item.id)} disabled={items.length <= 1}><Icon name="trash" size={14} /> Eliminar</button></div></div></article>)}</div>
  </WorkspaceFrame>;
}


function Editor({ project, allProjects, onBack, onChange, onToast, onTemplatesChange }: { project: Project; allProjects: Project[]; onBack: () => void; onChange: (project: Project) => void; onToast: (message: string) => void; onTemplatesChange: (templates: LocalTemplate[]) => void }) {
  const [selectedNodeId, setSelectedNodeId] = useState('');
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [outlineOpen, setOutlineOpen] = useState(false);
  const [canvasWindowIndex, setCanvasWindowIndex] = useState(0);
  const [zoom, setZoom] = useState(100);
  const [gridVisible, setGridVisible] = useState(true);
  const [extracting, setExtracting] = useState(false);
  const [aiMode, setAiMode] = useState<LocalAnalysisMode>('rules');
  const [analysis, setAnalysis] = useState<LocalAnalysisResult | null>(null);
  const [analysisError, setAnalysisError] = useState('');
  const [analysisProgress, setAnalysisProgress] = useState<LocalAnalysisProgress | null>(null);
  const [edgeTargetId, setEdgeTargetId] = useState('');
  const [edgeLabel, setEdgeLabel] = useState('');
  const [edgeDirection, setEdgeDirection] = useState<EdgeDirection>('forward');
  const [edgeFromPort, setEdgeFromPort] = useState<EdgePort>('auto');
  const [edgeToPort, setEdgeToPort] = useState<EdgePort>('auto');
  const [savedTemplates, setSavedTemplates] = useState<LocalTemplate[]>(() => readLocalTemplates(localStorage));
  const [, refreshHistory] = useState(0);
  const historyRef = useRef<{ projectId: string; past: Project[]; future: Project[]; present: Project; lastAt: number; lastKey: string }>({ projectId: project.id, past: [], future: [], present: structuredClone(project), lastAt: 0, lastKey: '' });
  if (historyRef.current.projectId !== project.id) historyRef.current = { projectId: project.id, past: [], future: [], present: structuredClone(project), lastAt: 0, lastKey: '' };
  else if (historyRef.current.present.updated !== project.updated && project.updated > historyRef.current.present.updated) historyRef.current.present = structuredClone(project);
  useEffect(() => { setCanvasWindowIndex(0); }, [project.id]);
  useLayoutEffect(() => {
    if (!window.matchMedia('(max-width: 720px)').matches) return;
    const viewport = document.querySelector<HTMLElement>('.diagram-canvas');
    const root = viewport?.querySelector<HTMLElement>('.diagram-node');
    if (!viewport || !root) return;
    const frame = window.requestAnimationFrame(() => {
      const width = viewport.scrollWidth || 760;
      const rootX = (Number.parseFloat(root.style.left) / 100) * width;
      viewport.scrollLeft = Math.max(0, rootX - viewport.clientWidth / 2);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [project.id]);
  const changeProject = (next: Project, coalesceKey?: string) => {
    const history = historyRef.current;
    const previous = history.present;
    if (JSON.stringify({ ...previous, updated: 0 }) !== JSON.stringify({ ...next, updated: 0 })) {
      const now = Date.now();
      const key = coalesceKey ?? JSON.stringify(collectProjectDiff(previous, next).map(({ entity, id, field }) => [entity, id, field]));
      const canCoalesce = history.lastKey === key && (Boolean(coalesceKey) || now - history.lastAt <= 700);
      if (!canCoalesce) history.past.push(structuredClone(previous));
      if (history.past.length > 80) history.past.shift();
      history.future = [];
      history.present = structuredClone(next);
      history.lastAt = now;
      history.lastKey = key;
      refreshHistory((value) => value + 1);
    }
    onChange(next);
  };
  const undo = () => {
    const history = historyRef.current;
    const previous = history.past.pop();
    if (!previous) return;
    history.future.push(structuredClone(history.present));
    history.present = structuredClone(previous);
    history.lastAt = 0;
    history.lastKey = '';
    changeProject(previous);
    onToast('Cambio deshecho');
  };
  const redo = () => {
    const history = historyRef.current;
    const next = history.future.pop();
    if (!next) return;
    history.past.push(structuredClone(history.present));
    history.present = structuredClone(next);
    history.lastAt = 0;
    history.lastKey = '';
    changeProject(next);
    onToast('Cambio rehecho');
  };
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.matches('input, textarea, select, [contenteditable="true"]')) return;
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 'z') return;
      event.preventDefault();
      if (event.shiftKey) redo(); else undo();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });
  const draggingNodeRef = useRef<string | null>(null);
  const type = typeFor(project.type);
  const selectedNode = project.nodes.find((node) => node.id === selectedNodeId);

  if (project.type === 'document') return <><DocumentEditor project={project} onBack={onBack} onChange={changeProject} onToast={onToast} /><HistoryDock canUndo={historyRef.current.past.length > 0} canRedo={historyRef.current.future.length > 0} undo={undo} redo={redo} operations={project.history ?? []} /></>;
  if (project.type === 'presentation') return <><PresentationEditor project={project} allProjects={allProjects} onBack={onBack} onChange={changeProject} onToast={onToast} /><HistoryDock canUndo={historyRef.current.past.length > 0} canRedo={historyRef.current.future.length > 0} undo={undo} redo={redo} operations={project.history ?? []} /></>;
  if (project.type === 'board') return <><BoardEditor project={project} onBack={onBack} onChange={changeProject} onToast={onToast} /><HistoryDock canUndo={historyRef.current.past.length > 0} canRedo={historyRef.current.future.length > 0} undo={undo} redo={redo} operations={project.history ?? []} /></>;
  if (project.type === 'timeline') return <><TimelineEditor project={project} onBack={onBack} onChange={changeProject} onToast={onToast} /><HistoryDock canUndo={historyRef.current.past.length > 0} canRedo={historyRef.current.future.length > 0} undo={undo} redo={redo} operations={project.history ?? []} /></>;
  if (project.type === 'matrix' || project.type === 'cycle' || project.type === 'venn') return <><SemanticDiagramEditor project={project} onBack={onBack} onChange={changeProject} onToast={onToast} exportMenu={<ExportMenu project={project} onExport={(format) => { downloadProject(project, format); onToast('Proyecto descargado'); }} />} /><HistoryDock canUndo={historyRef.current.past.length > 0} canRedo={historyRef.current.future.length > 0} undo={undo} redo={redo} operations={project.history ?? []} /></>;

  const updateNode = (patch: Partial<DiagramNode>) => {
    if (!selectedNode) return;
    changeProject({ ...project, nodes: project.nodes.map((node) => node.id === selectedNode.id ? { ...node, ...patch } : node) });
  };

  const createManualEdge = () => {
    if (!selectedNode || !edgeTargetId || selectedNode.id === edgeTargetId) return;
    if (project.edges.some((edge) => edge.from === selectedNode.id && edge.to === edgeTargetId)) {
      onToast('Ya existe un conector entre esos puertos');
      return;
    }
    const edge: GlyphindEdge = { id: `edge-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, from: selectedNode.id, to: edgeTargetId, direction: edgeDirection, fromPort: edgeFromPort, toPort: edgeToPort, ...(edgeLabel.trim() ? { label: edgeLabel.trim(), relation: edgeLabel.trim() } : {}) };
    const edges = [...project.edges, edge];
    changeProject({ ...project, edges, pages: project.pages.map((page) => ({ ...page, edgeIds: [...new Set([...page.edgeIds, edge.id])] })) });
    setEdgeLabel('');
    onToast('Conector manual creado');
  };

  const updateEdge = (edgeId: string, patch: Partial<GlyphindEdge>) => {
    const current = project.edges.find((edge) => edge.id === edgeId);
    if (!current) return;
    const nextFrom = patch.from ?? current.from; const nextTo = patch.to ?? current.to;
    if (nextFrom === nextTo || !project.nodes.some((node) => node.id === nextFrom) || !project.nodes.some((node) => node.id === nextTo)) { onToast('El conector necesita dos nodos distintos que existan'); return; }
    if (project.edges.some((edge) => edge.id !== edgeId && edge.from === nextFrom && edge.to === nextTo)) { onToast('Ya existe un conector para ese par ordenado de nodos'); return; }
    changeProject({ ...project, edges: project.edges.map((edge) => edge.id === edgeId ? { ...edge, ...patch, from: nextFrom, to: nextTo } : edge) });
  };

  const removeEdge = (edgeId: string) => {
    const edges = project.edges.filter((edge) => edge.id !== edgeId);
    changeProject({ ...project, edges, pages: project.pages.map((page) => ({ ...page, edgeIds: page.edgeIds.filter((id) => id !== edgeId) })) });
    onToast('Conector eliminado');
  };

  const addNode = () => {
    const node: DiagramNode = { id: `node-${Date.now()}`, label: 'Nuevo elemento', detail: 'Añade una descripción', x: 38, y: 68, tone: 'orange' };
    const previous = project.nodes[project.nodes.length - 1];
    const nextEdges = previous ? [...project.edges, { id: `edge-${previous.id}-${node.id}`, from: previous.id, to: node.id, direction: 'forward' as const, relation: 'siguiente', confidence: 1 }] : project.edges;
    changeProject({ ...project, nodes: [...project.nodes, node], edges: nextEdges, pages: project.pages.map((page) => ({ ...page, nodeIds: [...page.nodeIds, node.id], edgeIds: nextEdges.map((edge) => edge.id) })) });
    setSelectedNodeId(node.id);
    onToast('Elemento añadido al lienzo');
  };

  const duplicateNode = () => {
    if (!selectedNode) return;
    const node: DiagramNode = { ...selectedNode, id: `node-${Date.now()}`, label: `${selectedNode.label} · copia`, x: Math.min(88, selectedNode.x + 8), y: Math.min(84, selectedNode.y + 8) };
    changeProject({ ...project, nodes: [...project.nodes, node], pages: project.pages.map((page) => ({ ...page, nodeIds: [...page.nodeIds, node.id] })) });
    setSelectedNodeId(node.id);
    onToast('Elemento duplicado');
  };

  const deleteNode = () => {
    if (!selectedNode || project.nodes.length <= 1) return;
    const remaining = project.nodes.filter((node) => node.id !== selectedNode.id);
    const nextEdges = project.edges.filter((edge) => edge.from !== selectedNode.id && edge.to !== selectedNode.id);
    changeProject({ ...project, nodes: remaining, edges: nextEdges, pages: project.pages.map((page) => ({ ...page, nodeIds: page.nodeIds.filter((id) => id !== selectedNode.id), edgeIds: page.edgeIds.filter((id) => nextEdges.some((edge) => edge.id === id)) })) });
    setSelectedNodeId(remaining[0].id);
    onToast('Elemento eliminado');
  };

  const setSelectedShape = (shape: NodeShape) => {
    if (!selectedNode) { onToast('Selecciona un elemento para cambiar su forma'); return; }
    updateNode({ shape });
    onToast(shape === 'pill' ? 'Forma pastilla aplicada' : 'Forma cuadro aplicada');
  };

  const fitCanvas = () => {
    if (['mindmap', 'concept', 'team', 'community'].includes(project.type)) {
      const branches = Math.max(1, project.nodes.length - 1);
      const nextNodes = project.nodes.map((node, index) => {
        if (index === 0) return { ...node, x: 50, y: 50 };
        const angle = -Math.PI / 2 + ((index - 1) / branches) * Math.PI * 2;
        return { ...node, x: 50 + Math.cos(angle) * 34, y: 50 + Math.sin(angle) * 32 };
      });
      changeProject({ ...project, nodes: nextNodes });
      setZoom(100);
      onToast('Mapa organizado alrededor de su nodo central');
      return;
    }
    const columns = Math.min(4, Math.max(2, Math.ceil(Math.sqrt(project.nodes.length))));
    const rows = Math.ceil(project.nodes.length / columns);
    const nextNodes = project.nodes.map((node, index) => ({
      ...node,
      x: 12 + (index % columns) * (76 / Math.max(1, columns - 1)),
      y: 18 + Math.floor(index / columns) * (64 / Math.max(1, rows - 1)),
    }));
    changeProject({ ...project, nodes: nextNodes });
    setZoom(100);
    onToast('Lienzo ajustado al flujo');
  };

  const updateZoom = (delta: number) => {
    const nextZoom = Math.max(50, Math.min(175, zoom + delta));
    setZoom(nextZoom);
  };

  const resetZoom = () => { setZoom(100); onToast('Zoom restablecido al 100%'); };

  const moveNode = (event: React.PointerEvent<HTMLDivElement>) => {
    const id = draggingNodeRef.current;
    if (!id) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = Math.max(5, Math.min(95, ((event.clientX - rect.left) / rect.width) * 100));
    const y = Math.max(5, Math.min(95, ((event.clientY - rect.top) / rect.height) * 100));
    changeProject({ ...project, nodes: project.nodes.map((node) => node.id === id ? { ...node, x, y } : node) }, `drag:${id}`);
  };

  const stopMovingNode = () => { draggingNodeRef.current = null; historyRef.current.lastKey = ''; historyRef.current.lastAt = 0; };

  const canvasOrganizerTypes = diagramTypes.filter((item) => ['flow', 'concept', 'mindmap', 'matrix', 'pyramid', 'cycle', 'venn', 'custom'].includes(item.id));
  const changeCanvasFormat = (nextType: string) => {
    if (nextType === project.type) return;
    const nextNodes = (defaultNodes[nextType] ?? defaultNodes.flow).map((node) => ({ ...node, id: `${node.id}-${Date.now()}` }));
    const nextEdges = createEdgesFromNodes(nextType, nextNodes);
    changeProject({ ...project, type: nextType, nodes: nextNodes, edges: nextEdges, pages: [{ id: 'page-main', title: 'Página principal', nodeIds: nextNodes.map((node) => node.id), edgeIds: nextEdges.map((edge) => edge.id) }], sources: [] });
    setSelectedNodeId(nextNodes[0]?.id ?? '');
    onToast(`Formato cambiado a ${typeFor(nextType).label}`);
  };

  const applyTemplate = () => {
    const nextNodes = (defaultNodes[project.type] ?? defaultNodes.flow).map((node) => ({ ...node, id: `${node.id}-${Date.now()}` }));
    const nextEdges = createEdgesFromNodes(project.type, nextNodes);
    changeProject({ ...project, nodes: nextNodes, edges: nextEdges, pages: [{ id: 'page-main', title: 'Página principal', nodeIds: nextNodes.map((node) => node.id), edgeIds: nextEdges.map((edge) => edge.id) }], sources: [] });
    setSelectedNodeId(nextNodes[0]?.id ?? '');
    onToast('Plantilla aplicada al lienzo');
  };

  const saveLocalTemplate = () => {
    try {
      const entry = createLocalTemplate(project);
      const next = [...savedTemplates, entry];
      writeLocalTemplates(next, localStorage);
      setSavedTemplates(next);
      onTemplatesChange(next);
      onToast('Plantilla guardada solo en este dispositivo');
    } catch (error) { onToast(error instanceof Error ? error.message : 'No se pudo guardar la plantilla'); }
  };

  const canvasWindowCount = Math.max(1, Math.ceil(project.nodes.length / CANVAS_WINDOW_SIZE));
  const canvasVirtualized = project.nodes.length > CANVAS_WINDOW_SIZE;
  const activeCanvasNodes = canvasVirtualized ? project.nodes.slice(canvasWindowIndex * CANVAS_WINDOW_SIZE, (canvasWindowIndex + 1) * CANVAS_WINDOW_SIZE) : project.nodes;
  const activeCanvasNodeIds = new Set(activeCanvasNodes.map((node) => node.id));
  const activeCanvasEdges = connectorEdges(project).filter(({ from, to }) => activeCanvasNodeIds.has(from.id) && activeCanvasNodeIds.has(to.id));
  const crossWindowEdgeCount = canvasVirtualized ? project.edges.filter((edge) => activeCanvasNodeIds.has(edge.from) !== activeCanvasNodeIds.has(edge.to)).length : 0;
  const changeCanvasWindow = (index: number) => { setCanvasWindowIndex(Math.max(0, Math.min(canvasWindowCount - 1, index))); setSelectedNodeId(''); };
  useEffect(() => { if (canvasWindowIndex >= canvasWindowCount) setCanvasWindowIndex(canvasWindowCount - 1); }, [canvasWindowCount, canvasWindowIndex]);

  const applyLocalTemplate = (template: LocalTemplate) => {
    try {
      const next = applyTemplateProject(project, template);
      changeProject(next);
      setSelectedNodeId(next.nodes[0]?.id ?? '');
      onToast(`Plantilla «${template.name}» aplicada`);
    } catch (error) { onToast(error instanceof Error ? error.message : 'No se pudo aplicar la plantilla'); }
  };

  const analyzeNodeInformation = async (requestedMode: LocalAnalysisMode = aiMode) => {
    if (!selectedNode || extracting) return;
    setExtracting(true);
    setAnalysisError('');
    setAnalysisProgress(requestedMode === 'model' ? { stage: 'starting' } : null);
    try {
      let raw = selectedNode.content?.trim() ?? '';
      const sourceUrl = selectedNode.sourceUrl?.trim() ?? '';
      if (sourceUrl) {
        setAnalysisProgress({ stage: 'fetching' });
        const controller = new AbortController();
        const timeout = window.setTimeout(() => controller.abort(), 20_000);
        try { raw = await readBoundedTextResponse(await fetch(sourceUrl, { signal: controller.signal })); }
        finally { window.clearTimeout(timeout); }
      }
      if (!raw) throw new Error('Pega HTML o texto en Contenido fuente, o agrega una URL compatible con lectura directa.');
      if (new TextEncoder().encode(raw).byteLength > MAX_WEB_SOURCE_BYTES) throw new Error('El contenido pegado supera 1 MB; usa un fragmento más corto para mantener el análisis local ligero.');
      const result = await analyzeLocally(raw, sourceUrl || undefined, requestedMode, setAnalysisProgress);
      setAnalysis(result);
      if (result.modelError) setAnalysisError(`La IA semántica local no estuvo disponible: ${result.modelError}. Las reglas locales sí produjeron una propuesta.`);
      onToast(result.modelUsed ? 'IA semántica ejecutada en este dispositivo' : 'Sugerencia local lista para revisar');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo analizar la información';
      setAnalysisError(error instanceof DOMException && error.name === 'AbortError' ? 'La URL tardó más de 20 segundos; pega el HTML o texto o vuelve a intentarlo.' : message.includes('Failed to fetch') ? 'No se pudo leer la URL por CORS. Pega el HTML o texto; Glyphind no oculta un proxy remoto.' : message);
      onToast('Revisa la fuente antes de volver a analizar');
    } finally {
      setExtracting(false);
      setAnalysisProgress(null);
    }
  };

  const acceptAnalysis = () => {
    if (!selectedNode || !analysis) return;
    const stamp = Date.now();
    const sourceRecords: GlyphindSource[] = analysis.evidence.slice(0, 8).map((item, index) => ({
      id: `source-${stamp}-${index}`,
      kind: item.kind,
      ...(item.url ? { url: item.url } : {}),
      title: item.title,
      capturedAt: new Date().toISOString(),
      fragment: item.fragment,
      selector: item.selector,
      generatedBy: item.generatedBy ?? 'rules',
      confidence: item.confidence,
    }));
    const facts = (analysis.keySentences.length ? analysis.keySentences : analysis.paragraphs).slice(0, 8);
    sourceRecords.forEach((record, index) => { if (facts[index]) record.fragment = facts[index].slice(0, 280); });
    const sections = facts.map((fact, index) => analysis.sections[index] || fact.split(/[.!?]/)[0].trim().split(/\s+/).slice(0, 7).join(' '));
    const generated = sections.map((section, index): DiagramNode => ({
      id: `node-${stamp}-${index}`,
      label: section,
      detail: facts[index] || 'Sección extraída de la fuente.',
      content: facts[index] || '',
      sourceUrl: selectedNode.sourceUrl,
      evidenceId: sourceRecords[index]?.id,
      inference: 'rules',
      confidence: sourceRecords[index]?.confidence,
      x: 18 + (index % 3) * 32,
      y: 18 + Math.floor(index / 3) * 28,
      tone: ['blue', 'lilac', 'green', 'orange'][index % 4],
      shape: project.type === 'mindmap' ? 'pill' : 'card',
    }));
    const base = { ...selectedNode, label: analysis.title, detail: `${analysis.summary}${analysis.keywords.length ? `\n\nPalabras clave: ${analysis.keywords.join(', ')}` : ''}`, content: selectedNode.content, inference: analysis.modelUsed ? 'local-model' as const : 'rules' as const, confidence: 0.9, evidenceId: sourceRecords[0]?.id };
    const generatedEdges: GlyphindEdge[] = generated.map((node, index) => ({ id: `edge-${selectedNode.id}-${node.id}`, from: selectedNode.id, to: node.id, relation: 'sección extraída por reglas', direction: 'forward', confidence: sourceRecords[index]?.confidence ?? 0.8 }));
    const nextEdges = [...project.edges.filter((edge) => !generatedEdges.some((item) => item.id === edge.id)), ...generatedEdges];
    const nextNodes = [{ ...base, x: project.type === 'mindmap' ? 50 : base.x, y: project.type === 'mindmap' ? 50 : base.y }, ...project.nodes.filter((node) => node.id !== selectedNode.id), ...generated];
    changeProject({ ...project, nodes: nextNodes, edges: nextEdges, sources: [...project.sources, ...sourceRecords], pages: project.pages.map((page) => ({ ...page, nodeIds: nextNodes.map((node) => node.id), edgeIds: nextEdges.map((edge) => edge.id) })) });
    setSelectedNodeId(selectedNode.id);
    setAnalysis(null);
    setAnalysisError('');
    onToast(`${generated.length} tarjetas creadas con evidencia trazable`);
  };

  return (
    <div className="editor-shell canvas-editor-shell">
      <header className="editor-topbar"><button className="back-link" onClick={onBack}><Icon name="back" size={17} /> Proyectos</button><div className="editor-breadcrumb"><span>/</span><span>{project.name}</span><span className="editor-type-pill" style={{ color: type.color, backgroundColor: type.soft }}><Icon name={type.icon} size={13} /> {type.label}</span></div><div className="editor-actions"><span className="saved-label"><span className="canvas-live-dot" /> Guardado local</span><ExportMenu project={project} onExport={(format) => { downloadProject(project, format); onToast('Diagrama descargado'); }} /></div></header>
      <main className="editor-main canvas-editor-main"><div className="editor-heading"><div><span className="section-kicker">Lienzo de composición</span><h1>{project.name}</h1><p>Resume, conecta y transforma información en un organizador visual.</p></div><div className="canvas-format-tools"><label>Formato<select value={project.type} onChange={(event) => changeCanvasFormat(event.target.value)}>{canvasOrganizerTypes.map((item) => <option value={item.id} key={item.id}>{item.label}</option>)}</select></label><button className="secondary-button" onClick={applyTemplate}><Icon name="spark" size={15} /> Plantilla inicial</button><button className="secondary-button" onClick={saveLocalTemplate}>Guardar en biblioteca</button>{savedTemplates.length > 0 && <label className="template-picker">Mis plantillas<select aria-label="Aplicar plantilla guardada" defaultValue="" onChange={(event) => { const template = savedTemplates.find((item) => item.id === event.target.value); if (template) applyLocalTemplate(template); event.currentTarget.value = ""; }}><option value="">Elegir…</option>{savedTemplates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}</select></label>}</div></div><div className={`editor-workspace canvas-full-workspace ${inspectorOpen ? '' : 'inspector-is-closed'}`}><section className="canvas-section"><div className="canvas-header"><span><span className="canvas-live-dot" /> Lienzo de trabajo</span><span className="canvas-help">Arrastra nodos; en móvil desliza para explorar el lienzo.</span>{canvasVirtualized && <div className="canvas-window-controls" role="navigation" aria-label="Ventanas del lienzo"><button onClick={() => changeCanvasWindow(canvasWindowIndex - 1)} disabled={canvasWindowIndex === 0}>← Vista anterior</button><span aria-live="polite">Vista {canvasWindowIndex + 1} de {canvasWindowCount} · {activeCanvasNodes.length} nodos</span><button onClick={() => changeCanvasWindow(canvasWindowIndex + 1)} disabled={canvasWindowIndex === canvasWindowCount - 1}>Vista siguiente →</button>{crossWindowEdgeCount > 0 && <small>{crossWindowEdgeCount} conectores cruzan vistas y no se dibujan aquí.</small>}</div>}{!inspectorOpen && <button className="reopen-inspector" onClick={() => setInspectorOpen(true)}>Abrir propiedades <Icon name="arrow" size={13} /></button>}<button className="outline-toggle" onClick={() => setOutlineOpen((open) => !open)} aria-expanded={outlineOpen}><Icon name="command" size={13} /> {outlineOpen ? 'Ocultar esquema' : 'Vista de esquema'}</button><div className="history-controls"><button className="outline-toggle" onClick={undo} disabled={!historyRef.current.past.length} aria-label="Deshacer cambio (Ctrl o Cmd+Z)" title="Deshacer · Ctrl/Cmd+Z">↶ Deshacer</button><button className="outline-toggle" onClick={redo} disabled={!historyRef.current.future.length} aria-label="Rehacer cambio (Ctrl o Cmd+Shift+Z)" title="Rehacer · Ctrl/Cmd+Shift+Z">↷ Rehacer</button><details className="history-details"><summary>Historial ({project.history?.length ?? 0})</summary><ol>{(project.history ?? []).slice(-12).reverse().map((operation) => <li key={operation.id}><strong>{operation.summary}</strong><time dateTime={operation.at}>{new Date(operation.at).toLocaleString()}</time>{Boolean(operation.changes?.length) && <HistoryDiff changes={operation.changes ?? []} />}</li>)}</ol></details></div></div><div className={`diagram-canvas ${gridVisible ? '' : 'grid-is-hidden'}`} onClick={() => setSelectedNodeId('')} onPointerMove={moveNode} onPointerUp={stopMovingNode} onPointerCancel={stopMovingNode}><div className="canvas-zoom-layer" style={{ transform: `scale(${zoom / 100})` }}><svg className="canvas-lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><defs><marker id="glyphind-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#9d9a91" /></marker></defs>{activeCanvasEdges.map(({ edge, from, to }) => <g key={edge.id}><path d={connectorPath(from, to, edge.fromPort, edge.toPort)} markerEnd={edge.direction === "forward" || edge.direction === "both" ? "url(#glyphind-arrow)" : undefined} markerStart={edge.direction === "backward" || edge.direction === "both" ? "url(#glyphind-arrow)" : undefined} />{(edge.label || edge.relation) && <text className="edge-label" x={(from.x + to.x) / 2} y={(from.y + to.y) / 2 - 2}>{edge.label || edge.relation}</text>}</g>)}</svg>{activeCanvasNodes.map((node) => <button key={node.id} className={`diagram-node node-${node.tone} shape-${shapeForNode(project.type, node, project.nodes.findIndex((item) => item.id === node.id))} ${selectedNode?.id === node.id ? 'is-selected' : ''}`} style={{ left: `${node.x}%`, top: `${node.y}%`, borderLeftColor: colorForNode(node) }} onPointerDown={(event) => { event.stopPropagation(); setSelectedNodeId(node.id); draggingNodeRef.current = node.id; event.currentTarget.setPointerCapture(event.pointerId); }} aria-label={`${node.label}. ${node.detail}`} onClick={(event) => { event.stopPropagation(); setSelectedNodeId(node.id); }}><span className="node-grip"><i /><i /><i /></span><strong>{node.label}</strong><small>{node.detail}</small></button>)}</div></div><div className="canvas-footer"><span>{canvasVirtualized ? `${activeCanvasNodes.length} visibles de ${project.nodes.length} elementos` : `${project.nodes.length} elementos`} · {zoom}%</span><span>Arrastra para mover · selecciona para editar</span></div></section>{inspectorOpen && <aside className="properties-panel"><div className="properties-head"><div><span className="section-kicker">Propiedades</span><h2>Editar selección</h2></div><button className="icon-button" aria-label="Cerrar propiedades" onClick={() => setInspectorOpen(false)}><Icon name="close" size={16} /></button></div>{selectedNode ? <div className="properties-content"><div className="selected-preview" style={{ backgroundColor: type.soft, color: type.color }}><Icon name={type.icon} size={21} /><span>{type.label}</span></div><label className="field-label">Título<input value={selectedNode.label} onChange={(event) => updateNode({ label: event.target.value })} /></label><label className="field-label">Descripción<textarea value={selectedNode.detail} onChange={(event) => updateNode({ detail: event.target.value })} rows={4} /></label><details className="advanced-source-tools"><summary>Fuentes y resumen avanzado</summary><label className="field-label">Fuente web (URL)<input type="url" value={selectedNode.sourceUrl ?? ''} onChange={(event) => updateNode({ sourceUrl: event.target.value })} placeholder="https://sitio.com/articulo" /></label><label className="field-label">Contenido fuente<textarea value={selectedNode.content ?? ''} onChange={(event) => updateNode({ content: event.target.value })} rows={4} placeholder="Pega aquí texto o HTML para resumirlo." /></label><label className="field-label">Modo de análisis<select value={aiMode} onChange={(event) => setAiMode(event.target.value as LocalAnalysisMode)}><option value="rules">Reglas offline · sin red</option><option value="model">IA semántica local · primera descarga con red</option></select></label><p className="analysis-mode-help">{localAiModes[aiMode].description}</p><button className="extract-button" onClick={() => analyzeNodeInformation()} disabled={extracting}><Icon name="spark" size={15} /> {extracting ? (analysisProgress?.stage === 'fetching' ? 'Leyendo URL…' : analysisProgress?.stage === 'downloading' ? `Descargando modelo${analysisProgress.progress !== undefined ? ` · ${Math.round(analysisProgress.progress)}%` : '…'}` : analysisProgress?.stage === 'generating' ? 'Priorizando frases…' : analysisProgress?.stage === 'loading' ? 'Preparando modelo…' : 'Analizando en Worker…') : `Analizar con ${localAiModes[aiMode].label}`}</button>{extracting && <p className="analysis-progress" role="status" aria-live="polite">{analysisProgress?.stage === 'fetching' ? 'Leyendo la fuente web directamente; puede fallar si el sitio no permite CORS.' : analysisProgress?.stage === 'downloading' ? `Descargando ${analysisProgress.file ?? 'modelo'}${analysisProgress.progress !== undefined ? ` (${Math.round(analysisProgress.progress)}%)` : ''}. La primera descarga puede tardar.` : analysisProgress?.stage === 'generating' ? 'La IA compara la fuente con sus frases y conserva el texto literal.' : 'Preparando el análisis local.'}</p>}</details><details className="advanced-source-tools connector-editor"><summary>Conectores ({project.edges.filter((edge) => edge.from === selectedNode.id || edge.to === selectedNode.id).length})</summary><label className="field-label">Nodo de destino<select value={edgeTargetId} onChange={(event) => setEdgeTargetId(event.target.value)}><option value="">Selecciona un elemento…</option>{project.nodes.filter((node) => node.id !== selectedNode.id).map((node) => <option value={node.id} key={node.id}>{node.label}</option>)}</select></label><label className="field-label">Puerto de origen<select value={edgeFromPort} onChange={(event) => setEdgeFromPort(event.target.value as EdgePort)}><option value="auto">Automático</option><option value="top">Superior</option><option value="right">Derecho</option><option value="bottom">Inferior</option><option value="left">Izquierdo</option></select></label><label className="field-label">Puerto de destino<select value={edgeToPort} onChange={(event) => setEdgeToPort(event.target.value as EdgePort)}><option value="auto">Automático</option><option value="top">Superior</option><option value="right">Derecho</option><option value="bottom">Inferior</option><option value="left">Izquierdo</option></select></label><label className="field-label">Etiqueta del conector<input value={edgeLabel} onChange={(event) => setEdgeLabel(event.target.value)} placeholder="p. ej. depende de" /></label><label className="field-label">Dirección<select value={edgeDirection} onChange={(event) => setEdgeDirection(event.target.value as EdgeDirection)}><option value="forward">Desde el seleccionado → destino</option><option value="backward">Destino → seleccionado</option><option value="both">Ambos sentidos</option><option value="none">Sin flecha</option></select></label><button className="extract-button" onClick={createManualEdge} disabled={!edgeTargetId}><Icon name="add" size={14} /> Crear conector</button><div className="connector-list">{project.edges.filter((edge) => edge.from === selectedNode.id || edge.to === selectedNode.id).map((edge) => <div className="connector-row" key={edge.id}><strong>{project.nodes.find((node) => node.id === edge.from)?.label} → {project.nodes.find((node) => node.id === edge.to)?.label}</strong><input aria-label="Etiqueta del conector" value={edge.label ?? edge.relation ?? ""} onChange={(event) => updateEdge(edge.id, { label: event.target.value, relation: event.target.value })} placeholder="Sin etiqueta" /><select aria-label="Dirección del conector" value={edge.direction} onChange={(event) => updateEdge(edge.id, { direction: event.target.value as EdgeDirection })}><option value="forward">→</option><option value="backward">←</option><option value="both">↔</option><option value="none">—</option></select><select aria-label="Puerto de origen del conector" value={edge.fromPort ?? 'auto'} onChange={(event) => updateEdge(edge.id, { fromPort: event.target.value as EdgePort })}><option value="auto">A: Auto</option><option value="top">A: Arriba</option><option value="right">A: Derecha</option><option value="bottom">A: Abajo</option><option value="left">A: Izquierda</option></select><select aria-label="Puerto de destino del conector" value={edge.toPort ?? 'auto'} onChange={(event) => updateEdge(edge.id, { toPort: event.target.value as EdgePort })}><option value="auto">B: Auto</option><option value="top">B: Arriba</option><option value="right">B: Derecha</option><option value="bottom">B: Abajo</option><option value="left">B: Izquierda</option></select><button className="delete-element" onClick={() => removeEdge(edge.id)} aria-label="Eliminar conector"><Icon name="trash" size={13} /></button></div>)}</div></details><label className="field-label">Forma<select value={shapeForNode(project.type, selectedNode, project.nodes.findIndex((node) => node.id === selectedNode.id))} onChange={(event) => updateNode({ shape: event.target.value as NodeShape })}><option value="card">Tarjeta</option><option value="circle">Círculo</option><option value="pill">Píldora</option><option value="diamond">Decisión</option><option value="hexagon">Hexágono</option></select></label><div className="color-picker-field"><span className="field-label">Color</span><ColorWheel value={colorForNode(selectedNode)} onChange={(color) => updateNode({ colorHex: color })} /><div className="color-swatches">{Object.entries(toneColors).map(([tone, color]) => <button type="button" key={tone} className="color-swatch" style={{ backgroundColor: color }} aria-label={`Usar color ${tone}`} onClick={() => updateNode({ tone, colorHex: color })} />)}</div></div><div className="property-actions"><button className="delete-element" onClick={duplicateNode}><Icon name="copy" size={15} /> Duplicar</button><button className="delete-element" onClick={deleteNode} disabled={project.nodes.length <= 1}><Icon name="trash" size={15} /> Eliminar</button></div></div> : <div className="properties-empty"><span><Icon name="command" size={23} /></span><p>Selecciona un elemento para editarlo.</p></div>}<button className="add-element-button" onClick={addNode}><Icon name="plus" size={15} /> Añadir elemento</button></aside>}{outlineOpen && <OutlinePanel project={project} selectedNodeId={selectedNodeId} onSelect={(id) => { setSelectedNodeId(id); setInspectorOpen(true); }} onClose={() => setOutlineOpen(false)} />}</div><aside className="canvas-tools"><div className="tool-group"><span className="tool-label">Editar</span><button className="tool-button is-active" title="Seleccionar elemento"><Icon name="command" /><span>Seleccionar</span></button><button className="tool-button" title="Añadir elemento" onClick={addNode}><Icon name="add" /><span>Añadir</span></button><button className="tool-button" title="Duplicar elemento" onClick={duplicateNode} disabled={!selectedNode}><Icon name="copy" /><span>Duplicar</span></button><button className="tool-button" title="Eliminar elemento" onClick={deleteNode} disabled={!selectedNode || project.nodes.length <= 1}><Icon name="trash" /><span>Eliminar</span></button></div><div className="tools-line" /><div className="tool-group"><span className="tool-label">Organizar</span><button className="tool-button" title="Ordenar automáticamente" onClick={fitCanvas}><Icon name="flow" /><span>Ordenar</span></button><button className="tool-button shape-tool shape-card-tool" title="Aplicar forma cuadro" onClick={() => setSelectedShape('card')}><span>Cuadro</span></button><button className="tool-button shape-tool shape-pill-tool" title="Aplicar forma pastilla" onClick={() => setSelectedShape('pill')}><span>Pastilla</span></button></div><div className="tools-line" /><div className="tool-group tool-group-view"><span className="tool-label">Vista</span><div className="zoom-controls"><button className="tool-button" title="Alejar" onClick={() => updateZoom(-25)} disabled={zoom <= 50}>−</button><button className="zoom-value zoom-button" title="Restablecer zoom" onClick={resetZoom}>{zoom}%</button><button className="tool-button" title="Acercar" onClick={() => updateZoom(25)} disabled={zoom >= 175}>+</button></div></div></aside>{analysis && <AnalysisReview result={analysis} error={analysisError} mode={aiMode} onModeChange={setAiMode} onRetry={() => { void analyzeNodeInformation(); }} onAccept={acceptAnalysis} onDiscard={() => { setAnalysis(null); setAnalysisError(''); }} />}</main>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);


function AiBuilderModal({ name, setName, type, setType, text, setText, url, setUrl, mode, setMode, busy, progress, error, onSubmit, onClose }: {
  name: string;
  setName: (value: string) => void;
  type: string;
  setType: (value: string) => void;
  text: string;
  setText: (value: string) => void;
  url: string;
  setUrl: (value: string) => void;
  mode: LocalAnalysisMode;
  setMode: (value: LocalAnalysisMode) => void;
  busy: boolean;
  progress: LocalAnalysisProgress | null;
  error: string;
  onSubmit: (event: FormEvent) => void;
  onClose: () => void;
}) {
  const progressText = progress?.stage === 'fetching'
    ? 'Leyendo el texto fuente…'
    : progress?.stage === 'downloading'
      ? `Descargando el modelo local${progress.progress !== undefined ? ` · ${Math.round(progress.progress)}%` : '…'}`
      : progress?.stage === 'loading'
        ? 'Preparando el modelo en este dispositivo…'
        : progress?.stage === 'generating'
          ? 'Comparando frases de la fuente y organizando hallazgos…'
          : 'Iniciando análisis local…';
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target && !busy) onClose(); }}>
      <form className="project-modal ai-builder-modal" onSubmit={onSubmit} aria-labelledby="ai-builder-title">
        <div className="modal-head"><div><span className="section-kicker">De texto a mapa · en tu dispositivo</span><h2 id="ai-builder-title">Pega tus ideas. Sal con un diagrama.</h2><p className="ai-builder-intro">Glyphind separa frases de la fuente y las convierte en tarjetas editables con conectores y referencias.</p></div><button type="button" className="icon-button" onClick={onClose} disabled={busy} aria-label="Cerrar generador"><Icon name="close" /></button></div>
        <label className="field-label">URL pública opcional<input type="url" value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://sitio.com/artículo" /></label>
        <label className="field-label">Texto o contenido para organizar<textarea className="ai-builder-source" autoFocus value={text} onChange={(event) => setText(event.target.value)} rows={8} maxLength={1_000_000} placeholder="Pega aquí un artículo, apuntes o una explicación…\n\nEjemplo: El equipo recibe solicitudes. Primero revisa el objetivo y el plazo. Después asigna una persona responsable y confirma el resultado." /></label>
        <div className="ai-builder-meta"><span>{text.length.toLocaleString('es-MX')} caracteres</span><span>Las frases originales quedan como detalle y fuente de cada tarjeta.</span></div>
        <div className="ai-builder-fields">
          <label className="field-label">Nombre del proyecto<input value={name} onChange={(event) => setName(event.target.value)} placeholder="Se toma del título si lo dejas vacío" /></label>
          <label className="field-label">Cómo organizarlo<select value={type} onChange={(event) => setType(event.target.value)}><option value="mindmap">Mapa mental · ideas alrededor del tema</option><option value="concept">Mapa conceptual · conceptos y relaciones</option><option value="flow">Flujo · conserva el orden del texto</option></select></label>
        </div>
        <label className="field-label">Motor local<select value={mode} onChange={(event) => setMode(event.target.value as LocalAnalysisMode)}><option value="model">IA semántica local · recomendado</option><option value="rules">Extracción offline · sin descarga</option></select></label>
        <div className="ai-builder-privacy"><Icon name="save" size={15} /><span><strong>Privado y local.</strong> El texto se analiza en este dispositivo y no consume créditos de API. Si agregas URL, el navegador visita directamente ese sitio; CORS puede bloquear la lectura. El modelo semántico se descarga una vez.</span></div>
        {error && <p className="ai-builder-error" role="alert">{error}</p>}
        {busy && <p className="ai-builder-progress" role="status" aria-live="polite">{progressText}</p>}
        <div className="modal-foot"><span>Podrás editar, deshacer y exportar PNG después.</span><div><button type="button" className="secondary-button" onClick={onClose} disabled={busy}>Cancelar</button><button type="submit" className="primary-button" disabled={busy || (text.trim().length < 24 && !url.trim())}><Icon name="spark" size={15} /> {busy ? 'Organizando…' : 'Crear diagrama'}</button></div></div>
      </form>
    </div>
  );
}
