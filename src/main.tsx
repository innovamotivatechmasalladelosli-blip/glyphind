import { StrictMode, useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

type IconName =
  | 'menu' | 'plus' | 'grid' | 'folder' | 'flow' | 'checklist' | 'team' | 'community'
  | 'archive' | 'search' | 'filter' | 'more' | 'edit' | 'copy' | 'trash' | 'arrow'
  | 'close' | 'back' | 'save' | 'share' | 'add' | 'command' | 'chevron' | 'spark';

type DiagramNode = {
  id: string;
  label: string;
  detail: string;
  x: number;
  y: number;
  tone: string;
  shape?: NodeShape;
  sourceUrl?: string;
  content?: string;
};

type NodeShape = 'card' | 'circle' | 'pill' | 'diamond' | 'hexagon';
type ExportFormat = 'markdown' | 'json' | 'csv' | 'svg';

type Slide = { id: string; title: string; body: string; diagramProjectId?: string };
type BoardCard = { id: string; title: string; detail: string };
type BoardColumn = { id: string; title: string; cards: BoardCard[] };
type TimelineItem = { id: string; title: string; date: string; detail: string };
type ProjectData = { document?: string; slides?: Slide[]; board?: BoardColumn[]; timeline?: TimelineItem[] };

type Project = {
  id: string;
  name: string;
  type: string;
  updated: number;
  nodes: DiagramNode[];
  data?: ProjectData;
};

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
  { id: 'brace', label: 'Cuadro de llaves', description: 'Desglosa un tema de lo general a lo particular', icon: 'flow', color: '#4579a9', soft: '#eaf3fb', group: 'diagram' },
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
  { ...diagramTypes.find((item) => item.id === 'custom')!, label: 'Todos los mapas y flujo personalizado', description: 'Combina cuadros, ciclos, matrices y estructuras' },
];

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

function connectorPath(from: DiagramNode, to: DiagramNode) {
  const middleX = (from.x + to.x) / 2;
  return `M${from.x} ${from.y} C${middleX} ${from.y}, ${middleX} ${to.y}, ${to.x} ${to.y}`;
}

function shapeForNode(projectType: string, node: DiagramNode, index: number): NodeShape {
  if (node.shape) return node.shape;
  if (projectType === 'mindmap') return index === 0 ? 'circle' : 'pill';
  if (projectType === 'concept') return index === 0 ? 'hexagon' : 'diamond';
  if (projectType === 'flow' || projectType === 'custom') return index === 0 || index === 3 ? 'pill' : index === 2 ? 'diamond' : 'card';
  return 'card';
}

function connectorPairs(project: Project) {
  if (project.nodes.length < 2) return [] as Array<[DiagramNode, DiagramNode]>;
  if (project.type === 'mindmap' || project.type === 'concept' || project.type === 'team' || project.type === 'community') {
    return project.nodes.slice(1).map((node) => [project.nodes[0], node] as [DiagramNode, DiagramNode]);
  }
  return project.nodes.slice(0, -1).map((node, index) => [node, project.nodes[index + 1]] as [DiagramNode, DiagramNode]);
}

const extractionStopWords = new Set('para con las los una uno que del por sus más como este esta desde entre sobre donde cuando cómo qué son'.split(' '));

function extractInformation(raw: string) {
  const document = new DOMParser().parseFromString(raw, 'text/html');
  document.querySelectorAll('script,style,noscript,svg,nav,footer').forEach((element) => element.remove());
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
  return {};
}

function createProject(name: string, type: string, relatedProjects: Project[] = []): Project {
  return {
    id: `project-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name: name.trim() || 'Proyecto sin título',
    type,
    updated: Date.now(),
    nodes: defaultNodes[type]?.map((node) => ({ ...node, id: `${node.id}-${Date.now()}` })) ?? defaultNodes.flow,
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

function safeFilename(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9áéíóúñ]+/gi, '-').replace(/^-|-$/g, '') || 'glyphind-proyecto';
}

function downloadProject(project: Project, format: ExportFormat = 'markdown') {
  const type = typeFor(project.type);
  const baseName = safeFilename(project.name);
  if (format === 'json') {
    downloadFile(JSON.stringify(project, null, 2), `${baseName}.json`, 'application/json;charset=utf-8');
    return;
  }
  if (format === 'csv') {
    const rows = [['id', 'titulo', 'detalle', 'x', 'y', 'forma', 'tono'], ...project.nodes.map((node, index) => [node.id, node.label, node.detail, String(node.x), String(node.y), shapeForNode(project.type, node, index), node.tone])];
    const csv = rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
    downloadFile(`\ufeff${csv}`, `${baseName}.csv`, 'text/csv;charset=utf-8');
    return;
  }
  if (format === 'svg') {
    const nodes = project.nodes.map((node, index) => `<g transform="translate(${node.x * 8},${node.y * 5})"><rect x="-65" y="-25" width="130" height="50" rx="${shapeForNode(project.type, node, index) === 'circle' ? 25 : 8}" fill="#fffefa" stroke="${type.color}"/><text x="0" y="0" text-anchor="middle" dominant-baseline="middle" font-family="Arial" font-size="11" fill="#24231f">${node.label.replace(/[<&>]/g, '')}</text></g>`).join('');
    const links = connectorPairs(project).map(([from, to]) => `<path d="${connectorPath(from, to).replace(/(\d+(?:\.\d+)?)/g, (value) => String(Number(value) * (value === String(from.x) || value === String(to.x) ? 8 : 5)))}" fill="none" stroke="#c9c6bd" stroke-dasharray="4 4"/>`).join('');
    downloadFile(`<svg xmlns="http://www.w3.org/2000/svg" width="800" height="500" viewBox="0 0 800 500"><rect width="100%" height="100%" fill="#fdfcf8"/>${links}${nodes}</svg>`, `${baseName}.svg`, 'image/svg+xml;charset=utf-8');
    return;
  }
  const specialized = project.data?.document ?? (project.data?.slides ? project.data.slides.map((slide, index) => `## ${index + 1}. ${slide.title}\n\n${slide.body}`).join('\n\n') : project.data?.timeline ? project.data.timeline.map((item) => `## ${item.date} · ${item.title}\n\n${item.detail}`).join('\n\n') : project.data?.board ? project.data.board.map((column) => `## ${column.title}\n\n${column.cards.map((card) => `- **${card.title}** — ${card.detail}`).join('\n')}`).join('\n\n') : null);
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
  const blob = new Blob([JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), projects }, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `glyphind-respaldo-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}


function App() {
  const [projects, setProjects] = useState<Project[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) as Project[] : [];
    } catch {
      return [];
    }
  });
  const [activeView, setActiveView] = useState<'projects' | 'editor'>('projects');
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [mobileMenu, setMobileMenu] = useState(false);
  const [modal, setModal] = useState<'new' | 'edit' | null>(null);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState('');
  const [draftType, setDraftType] = useState('flow');
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [toast, setToast] = useState('');
  const importInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
  }, [projects]);

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
    setProjects((current) => current.map((project) => project.id === id ? { ...project, ...patch, updated: Date.now() } : project));
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
        ...(nextNodes ? { nodes: nextNodes } : {}),
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

  const openEditModal = (project: Project) => {
    setEditingProjectId(project.id);
    setDraftName(project.name);
    setDraftType(project.type);
    setOpenMenu(null);
    setModal('edit');
  };

  const duplicateProject = (project: Project) => {
    const duplicate: Project = {
      ...project,
      id: `project-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: `${project.name} · copia`,
      updated: Date.now(),
      nodes: project.nodes.map((node) => ({ ...node, id: `${node.id}-copy` })),
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

  const importWorkspace = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        const imported = Array.isArray(parsed) ? parsed : parsed.projects;
        if (!Array.isArray(imported) || imported.some((item) => !item?.id || !item?.name || !item?.type || !Array.isArray(item?.nodes))) throw new Error('Formato inválido');
        setProjects(imported as Project[]);
        setFilter('all');
        setSearch('');
        setToast(`${imported.length} proyectos restaurados`);
      } catch {
        setToast('No se pudo importar el respaldo');
      }
    };
    reader.readAsText(file);
  };

  if (activeView === 'editor' && activeProject) {
    return (
        <Editor
          project={activeProject}
          allProjects={projects}
          onBack={() => setActiveView('projects')}
        onChange={(nextProject) => updateProject(nextProject.id, nextProject)}
        onToast={setToast}
      />
    );
  }

  return (
    <div className="app-shell">
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
          <div className="workspace-actions"><button className="sidebar-action" onClick={() => downloadWorkspace(projects)}><Icon name="arrow" size={14} /> Exportar respaldo</button><button className="sidebar-action" onClick={() => importInputRef.current?.click()}><Icon name="folder" size={14} /> Importar respaldo</button><input ref={importInputRef} type="file" accept="application/json,.json" hidden onChange={importWorkspace} /></div>
          <div className="sidebar-footnote"><span>G</span><span>Glyphind <em>0.1</em></span></div>
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
                    <article className={`project-row ${index === 0 && !search && filter === 'all' ? 'is-featured' : ''}`} key={project.id} onDoubleClick={() => openProject(project)}>
                      <button className="project-main" onClick={() => openProject(project)}>
                        <span className="project-type-icon" style={{ color: type.color, backgroundColor: type.soft }}><Icon name={type.icon} size={23} /></span>
                        <span className="project-copy"><strong>{project.name}</strong><span>{type.label} <i>·</i> {project.nodes.length} elementos</span></span>
                      </button>
                      <span className="project-status"><span className="status-dot" /> Local</span>
                      <span className="project-updated">{formatDate(project.updated)}</span>
                      <div className="project-actions"><button className="row-open" onClick={() => openProject(project)}>Abrir <Icon name="arrow" size={15} /></button><button className="icon-button more-button" aria-label={`Más opciones para ${project.name}`} onClick={() => setOpenMenu(openMenu === project.id ? null : project.id)}><Icon name="more" /></button>{openMenu === project.id && <div className="context-menu"><button onClick={() => openEditModal(project)}><Icon name="edit" size={15} /> Editar detalles</button><button onClick={() => duplicateProject(project)}><Icon name="copy" size={15} /> Duplicar proyecto</button><div className="menu-line" /><button className="danger" onClick={() => removeProject(project)}><Icon name="trash" size={15} /> Eliminar</button></div>}</div>
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
      {toast && <div className="toast"><span className="toast-check">✓</span>{toast}</div>}
    </div>
  );
}


function ProjectModal({ mode, name, type, setName, setType, onSubmit, onClose }: { mode: 'new' | 'edit'; name: string; type: string; setName: (value: string) => void; setType: (value: string) => void; onSubmit: (event: FormEvent) => void; onClose: () => void }) {
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}>
      <form className="project-modal" onSubmit={onSubmit}>
        <div className="modal-head"><div><span className="section-kicker">{mode === 'new' ? 'Nuevo lienzo' : 'Editar lienzo'}</span><h2>{mode === 'new' ? 'Elige cómo pensar' : 'Ajusta los detalles'}</h2></div><button type="button" className="icon-button" onClick={onClose} aria-label="Cerrar"><Icon name="close" /></button></div>
        <label className="field-label">Nombre del proyecto<input autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder="Ej. Flujo de incorporación" /></label>
        <div className="field-label">Tipo de diagrama<div className="type-choice-group"><span className="type-choice-group-label">Organizadores principales</span><div className="type-choice-grid">{featuredDiagramTypes.map((item) => <button type="button" key={item.id} className={`type-choice ${type === item.id ? 'is-selected' : ''}`} onClick={() => setType(item.id)}><span style={{ color: item.color, backgroundColor: item.soft }}><Icon name={item.icon} size={19} /></span><span><strong>{item.label}</strong><small>{item.description}</small></span>{type === item.id && <i>✓</i>}</button>)}</div></div><details className="more-type-options"><summary>Más herramientas de trabajo</summary>{diagramGroups.map((group) => <div className="type-choice-group" key={group.id}><span className="type-choice-group-label">{group.label}</span><div className="type-choice-grid">{availableDiagramTypes.filter((item) => item.group === group.id).map((item) => <button type="button" key={item.id} className={`type-choice ${type === item.id ? 'is-selected' : ''}`} onClick={() => setType(item.id)}><span style={{ color: item.color, backgroundColor: item.soft }}><Icon name={item.icon} size={19} /></span><span><strong>{item.label}</strong><small>{item.description}</small></span>{type === item.id && <i>✓</i>}</button>)}</div></div>)}</details></div>
        <div className="modal-foot"><span>Configura tu espacio y empieza a trabajar</span><div><button type="button" className="secondary-button" onClick={onClose}>Cancelar</button><button type="submit" className="primary-button">{mode === 'new' ? 'Crear proyecto' : 'Guardar cambios'} <Icon name="arrow" size={15} /></button></div></div>
      </form>
    </div>
  );
}


function ExportMenu({ project, onExport }: { project: Project; onExport: (format: ExportFormat) => void }) {
  const [open, setOpen] = useState(false);
  const options: Array<[ExportFormat, string]> = [['markdown', 'Markdown'], ['json', 'JSON editable'], ['csv', 'CSV de elementos'], ['svg', 'SVG vectorial']];
  return <div className="export-menu"><button className="secondary-button" onClick={() => setOpen((value) => !value)} aria-expanded={open}><Icon name="arrow" size={14} /> Descargar <Icon name="chevron" size={14} /></button>{open && <div className="export-options">{options.map(([format, label]) => <button key={format} onClick={() => { onExport(format); setOpen(false); }}>{label}</button>)}</div>}</div>;
}

function WorkspaceFrame({ project, children, onBack, onExport }: { project: Project; children: React.ReactNode; onBack: () => void; onExport: (format: ExportFormat) => void }) {
  const type = typeFor(project.type);
  return <div className="editor-shell"><header className="editor-topbar"><button className="back-link" onClick={onBack}><Icon name="back" size={17} /> Volver a proyectos</button><div className="editor-breadcrumb"><span>/</span><span>{project.name}</span><span className="editor-type-pill" style={{ color: type.color, backgroundColor: type.soft }}><Icon name={type.icon} size={13} /> {type.label}</span></div><div className="editor-actions"><span className="saved-label"><span className="canvas-live-dot" /> Cambios activos</span><ExportMenu project={project} onExport={onExport} /></div></header><main className="specialized-main">{children}</main></div>;
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
  const addCard = (columnId: string) => { const next = columns.map((column) => column.id === columnId ? { ...column, cards: [...column.cards, { id: `card-${Date.now()}`, title: 'Nueva tarjeta', detail: 'Describe el trabajo' }] } : column); onChange({ ...project, data: { ...project.data, board: next } }); onToast('Tarjeta añadida'); };
  const updateCard = (columnId: string, cardId: string, patch: Partial<BoardCard>) => onChange({ ...project, data: { ...project.data, board: columns.map((column) => column.id === columnId ? { ...column, cards: column.cards.map((card) => card.id === cardId ? { ...card, ...patch } : card) } : column) } });
  const moveCard = (columnId: string, cardId: string) => { const index = columns.findIndex((column) => column.id === columnId); if (index < 0 || index === columns.length - 1) return; const source = columns[index]; const card = source.cards.find((item) => item.id === cardId); if (!card) return; const next = columns.map((column, columnIndex) => columnIndex === index ? { ...column, cards: column.cards.filter((item) => item.id !== cardId) } : columnIndex === index + 1 ? { ...column, cards: [...column.cards, card] } : column); onChange({ ...project, data: { ...project.data, board: next } }); onToast('Tarjeta movida a la siguiente etapa'); };
  const moveCardBack = (columnId: string, cardId: string) => { const index = columns.findIndex((column) => column.id === columnId); if (index <= 0) return; const source = columns[index]; const card = source.cards.find((item) => item.id === cardId); if (!card) return; const next = columns.map((column, columnIndex) => columnIndex === index ? { ...column, cards: column.cards.filter((item) => item.id !== cardId) } : columnIndex === index - 1 ? { ...column, cards: [...column.cards, card] } : column); onChange({ ...project, data: { ...project.data, board: next } }); onToast('Tarjeta devuelta a la etapa anterior'); };
  const duplicateCard = (columnId: string, card: BoardCard) => { const copy = { ...card, id: `card-${Date.now()}`, title: `${card.title} · copia` }; onChange({ ...project, data: { ...project.data, board: columns.map((column) => column.id === columnId ? { ...column, cards: [...column.cards, copy] } : column) } }); onToast('Tarjeta duplicada'); };
  const removeCard = (columnId: string, cardId: string) => { const next = columns.map((column) => column.id === columnId ? { ...column, cards: column.cards.filter((card) => card.id !== cardId) } : column); onChange({ ...project, data: { ...project.data, board: next } }); onToast('Tarjeta eliminada'); };
  return <WorkspaceFrame project={project} onBack={onBack} onExport={(format) => { downloadProject(project, format); onToast('Tablero descargado'); }}><div className="specialized-heading"><div><span className="section-kicker">Tablero de trabajo</span><h1>{project.name}</h1><p>Mueve el trabajo por etapas y edita cada tarjeta.</p></div><button className="secondary-button" onClick={() => addCard(columns[0]?.id ?? '')} disabled={!columns.length}><Icon name="plus" size={15} /> Nueva tarjeta</button></div><div className="board-workspace">{columns.map((column, columnIndex) => <section className="board-column" key={column.id}><header><strong>{column.title}</strong><span>{column.cards.length}</span></header>{column.cards.map((card) => <article className="board-card" key={card.id}><input value={card.title} onChange={(event) => updateCard(column.id, card.id, { title: event.target.value })} /><textarea value={card.detail} onChange={(event) => updateCard(column.id, card.id, { detail: event.target.value })} rows={2} /><div className="card-actions"><button onClick={() => moveCardBack(column.id, card.id)} disabled={columnIndex === 0} title="Volver a la etapa anterior"><Icon name="back" size={13} /> Atrás</button><button onClick={() => moveCard(column.id, card.id)} disabled={columnIndex === columns.length - 1} title="Avanzar a la siguiente etapa"><Icon name="arrow" size={13} /> Siguiente</button><button onClick={() => duplicateCard(column.id, card)} title="Duplicar tarjeta"><Icon name="copy" size={13} /></button><button className="danger-action" onClick={() => removeCard(column.id, card.id)} title="Eliminar tarjeta"><Icon name="trash" size={13} /></button></div></article>)}<button className="add-card" onClick={() => addCard(column.id)}><Icon name="plus" size={14} /> Añadir tarjeta</button></section>)}</div></WorkspaceFrame>;
}

function TimelineEditor({ project, onBack, onChange, onToast }: { project: Project; onBack: () => void; onChange: (project: Project) => void; onToast: (message: string) => void }) {
  const items = project.data?.timeline ?? [];
  const update = (id: string, patch: Partial<TimelineItem>) => onChange({ ...project, data: { ...project.data, timeline: items.map((item) => item.id === id ? { ...item, ...patch } : item) } });
  const add = () => { const next = { id: `phase-${Date.now()}`, title: 'Nueva fase', date: 'Fecha', detail: 'Define el resultado de esta fase.' }; onChange({ ...project, data: { ...project.data, timeline: [...items, next] } }); onToast('Fase añadida'); };
  const duplicate = (item: TimelineItem) => { const copy = { ...item, id: `phase-${Date.now()}`, title: `${item.title} · copia` }; onChange({ ...project, data: { ...project.data, timeline: [...items, copy] } }); onToast('Fase duplicada'); };
  const move = (index: number, direction: -1 | 1) => { const target = index + direction; if (target < 0 || target >= items.length) return; const next = [...items]; [next[index], next[target]] = [next[target], next[index]]; onChange({ ...project, data: { ...project.data, timeline: next } }); };
  const remove = (id: string) => { if (items.length <= 1) return; onChange({ ...project, data: { ...project.data, timeline: items.filter((item) => item.id !== id) } }); onToast('Fase eliminada'); };
  return <WorkspaceFrame project={project} onBack={onBack} onExport={(format) => { downloadProject(project, format); onToast('Cronograma descargado'); }}><div className="specialized-heading"><div><span className="section-kicker">Cronograma</span><h1>{project.name}</h1><p>Planifica fases, fechas, dependencias y entregables.</p></div><button className="secondary-button" onClick={add}><Icon name="plus" size={15} /> Añadir fase</button></div><div className="timeline-workspace">{items.map((item, index) => <article className="timeline-item" key={item.id}><span className="timeline-index">{index + 1}</span><div><input className="timeline-date" value={item.date} onChange={(event) => update(item.id, { date: event.target.value })} /><input className="timeline-title" value={item.title} onChange={(event) => update(item.id, { title: event.target.value })} /><textarea value={item.detail} onChange={(event) => update(item.id, { detail: event.target.value })} rows={2} /><div className="timeline-actions"><button onClick={() => move(index, -1)} disabled={index === 0} title="Subir fase"><Icon name="back" size={14} /> Subir</button><button onClick={() => move(index, 1)} disabled={index === items.length - 1} title="Bajar fase"><Icon name="arrow" size={14} /> Bajar</button><button onClick={() => duplicate(item)} title="Duplicar fase"><Icon name="copy" size={14} /> Duplicar</button><button className="delete-slide" onClick={() => remove(item.id)} disabled={items.length <= 1}><Icon name="trash" size={14} /> Eliminar</button></div></div></article>)}</div></WorkspaceFrame>;
}

function Editor({ project, allProjects, onBack, onChange, onToast }: { project: Project; allProjects: Project[]; onBack: () => void; onChange: (project: Project) => void; onToast: (message: string) => void }) {
  const [selectedNodeId, setSelectedNodeId] = useState(project.nodes[0]?.id ?? '');
  const [inspectorOpen, setInspectorOpen] = useState(true);
  const [zoom, setZoom] = useState(100);
  const [gridVisible, setGridVisible] = useState(true);
  const [extracting, setExtracting] = useState(false);
  const draggingNodeRef = useRef<string | null>(null);
  const type = typeFor(project.type);
  const selectedNode = project.nodes.find((node) => node.id === selectedNodeId) ?? project.nodes[0];

  if (project.type === 'document') return <DocumentEditor project={project} onBack={onBack} onChange={onChange} onToast={onToast} />;
  if (project.type === 'presentation') return <PresentationEditor project={project} allProjects={allProjects} onBack={onBack} onChange={onChange} onToast={onToast} />;
  if (project.type === 'board') return <BoardEditor project={project} onBack={onBack} onChange={onChange} onToast={onToast} />;
  if (project.type === 'timeline') return <TimelineEditor project={project} onBack={onBack} onChange={onChange} onToast={onToast} />;

  const updateNode = (patch: Partial<DiagramNode>) => {
    if (!selectedNode) return;
    onChange({ ...project, nodes: project.nodes.map((node) => node.id === selectedNode.id ? { ...node, ...patch } : node) });
  };

  const addNode = () => {
    const node: DiagramNode = { id: `node-${Date.now()}`, label: 'Nuevo elemento', detail: 'Añade una descripción', x: 38, y: 68, tone: 'orange' };
    onChange({ ...project, nodes: [...project.nodes, node] });
    setSelectedNodeId(node.id);
    onToast('Elemento añadido al lienzo');
  };

  const duplicateNode = () => {
    if (!selectedNode) return;
    const node: DiagramNode = { ...selectedNode, id: `node-${Date.now()}`, label: `${selectedNode.label} · copia`, x: Math.min(88, selectedNode.x + 8), y: Math.min(84, selectedNode.y + 8) };
    onChange({ ...project, nodes: [...project.nodes, node] });
    setSelectedNodeId(node.id);
    onToast('Elemento duplicado');
  };

  const deleteNode = () => {
    if (!selectedNode || project.nodes.length <= 1) return;
    const remaining = project.nodes.filter((node) => node.id !== selectedNode.id);
    onChange({ ...project, nodes: remaining });
    setSelectedNodeId(remaining[0].id);
    onToast('Elemento eliminado');
  };

  const fitCanvas = () => {
    if (['mindmap', 'concept', 'team', 'community'].includes(project.type)) {
      const branches = Math.max(1, project.nodes.length - 1);
      const nextNodes = project.nodes.map((node, index) => {
        if (index === 0) return { ...node, x: 50, y: 50 };
        const angle = -Math.PI / 2 + ((index - 1) / branches) * Math.PI * 2;
        return { ...node, x: 50 + Math.cos(angle) * 34, y: 50 + Math.sin(angle) * 32 };
      });
      onChange({ ...project, nodes: nextNodes });
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
    onChange({ ...project, nodes: nextNodes });
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
    onChange({ ...project, nodes: project.nodes.map((node) => node.id === id ? { ...node, x, y } : node) });
  };

  const stopMovingNode = () => { draggingNodeRef.current = null; };

  const canvasOrganizerTypes = diagramTypes.filter((item) => ['flow', 'concept', 'mindmap', 'brace', 'matrix', 'pyramid', 'cycle', 'venn', 'custom'].includes(item.id));
  const changeCanvasFormat = (nextType: string) => {
    if (nextType === project.type) return;
    const nextNodes = (defaultNodes[nextType] ?? defaultNodes.flow).map((node) => ({ ...node, id: `${node.id}-${Date.now()}` }));
    onChange({ ...project, type: nextType, nodes: nextNodes });
    setSelectedNodeId(nextNodes[0]?.id ?? '');
    onToast(`Formato cambiado a ${typeFor(nextType).label}`);
  };

  const applyTemplate = () => {
    const nextNodes = (defaultNodes[project.type] ?? defaultNodes.flow).map((node) => ({ ...node, id: `${node.id}-${Date.now()}` }));
    onChange({ ...project, nodes: nextNodes });
    setSelectedNodeId(nextNodes[0]?.id ?? '');
    onToast('Plantilla aplicada al lienzo');
  };

  const extractNodeInformation = async () => {
    if (!selectedNode || extracting) return;
    setExtracting(true);
    try {
      let raw = selectedNode.content?.trim() ?? '';
      const sourceUrl = selectedNode.sourceUrl?.trim() ?? '';
      if (sourceUrl) {
        const response = await fetch(sourceUrl);
        if (!response.ok) throw new Error('No se pudo leer el sitio');
        raw = await response.text();
      }
      if (!raw) throw new Error('Pega HTML o texto en Contenido fuente, o agrega una URL compatible con lectura directa.');
      const result = extractInformation(raw);
      const base = { ...selectedNode, label: result.title, detail: `${result.summary}${result.keywords.length ? `\n\nPalabras clave: ${result.keywords.join(', ')}` : ''}`, content: raw, sourceUrl: sourceUrl || selectedNode.sourceUrl };
      const extractedSections = result.sections.length ? result.sections.slice(0, 6).filter((section) => section !== result.title) : result.paragraphs.slice(0, 6).map((_, index) => `Hallazgo ${index + 1}`);
      const generated = extractedSections.map((section, index) => ({ id: `node-${Date.now()}-${index}`, label: section, detail: result.paragraphs[index] || 'Sección extraída de la fuente.', content: result.paragraphs[index] || '', sourceUrl, x: 18 + (index % 3) * 32, y: 18 + Math.floor(index / 3) * 28, tone: ['blue', 'lilac', 'green', 'orange'][index % 4], shape: project.type === 'mindmap' ? 'pill' as NodeShape : 'card' as NodeShape }));
      onChange({ ...project, nodes: [{ ...base, x: project.type === 'mindmap' ? 50 : base.x, y: project.type === 'mindmap' ? 50 : base.y }, ...project.nodes.filter((node) => node.id !== selectedNode.id), ...generated] });
      setSelectedNodeId(selectedNode.id);
      onToast(`${generated.length} nodos creados a partir de la información extraída`);
    } catch (error) {
      onToast(error instanceof Error ? error.message : 'No se pudo extraer la información');
    } finally {
      setExtracting(false);
    }
  };

  return (
    <div className="editor-shell canvas-editor-shell">
      <header className="editor-topbar"><button className="back-link" onClick={onBack}><Icon name="back" size={17} /> Proyectos</button><div className="editor-breadcrumb"><span>/</span><span>{project.name}</span><span className="editor-type-pill" style={{ color: type.color, backgroundColor: type.soft }}><Icon name={type.icon} size={13} /> {type.label}</span></div><div className="editor-actions"><span className="saved-label"><span className="canvas-live-dot" /> Guardado local</span><ExportMenu project={project} onExport={(format) => { downloadProject(project, format); onToast('Diagrama descargado'); }} /></div></header>
      <main className="editor-main canvas-editor-main"><div className="editor-heading"><div><span className="section-kicker">Lienzo de composición</span><h1>{project.name}</h1><p>Resume, conecta y transforma información en un organizador visual.</p></div><div className="canvas-format-tools"><label>Formato<select value={project.type} onChange={(event) => changeCanvasFormat(event.target.value)}>{canvasOrganizerTypes.map((item) => <option value={item.id} key={item.id}>{item.label}</option>)}</select></label><button className="secondary-button" onClick={applyTemplate}><Icon name="spark" size={15} /> Plantilla</button></div></div><div className={`editor-workspace canvas-full-workspace ${inspectorOpen ? '' : 'inspector-is-closed'}`}><section className="canvas-section"><div className="canvas-header"><span><span className="canvas-live-dot" /> Lienzo de trabajo</span><span className="canvas-help">Arrastra y conecta tus ideas</span>{!inspectorOpen && <button className="reopen-inspector" onClick={() => setInspectorOpen(true)}>Abrir propiedades <Icon name="arrow" size={13} /></button>}</div><div className={`diagram-canvas ${gridVisible ? '' : 'grid-is-hidden'}`} onClick={() => setSelectedNodeId('')} onPointerMove={moveNode} onPointerUp={stopMovingNode} onPointerCancel={stopMovingNode}><div className="canvas-zoom-layer" style={{ transform: `scale(${zoom / 100})` }}><svg className="canvas-lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">{connectorPairs(project).map(([from, to]) => <path key={`${from.id}-${to.id}`} d={connectorPath(from, to)} />)}</svg>{project.nodes.map((node, index) => <button key={node.id} className={`diagram-node node-${node.tone} shape-${shapeForNode(project.type, node, index)} ${selectedNode?.id === node.id ? 'is-selected' : ''}`} style={{ left: `${node.x}%`, top: `${node.y}%` }} onPointerDown={(event) => { event.stopPropagation(); setSelectedNodeId(node.id); draggingNodeRef.current = node.id; event.currentTarget.setPointerCapture(event.pointerId); }} onClick={(event) => { event.stopPropagation(); setSelectedNodeId(node.id); }}><span className="node-grip"><i /><i /><i /></span><strong>{node.label}</strong><small>{node.detail}</small></button>)}</div></div><div className="canvas-footer"><span>{project.nodes.length} elementos · {zoom}%</span><span>Arrastra para mover · selecciona para editar</span></div></section>{inspectorOpen && <aside className="properties-panel"><div className="properties-head"><div><span className="section-kicker">Propiedades</span><h2>Editar selección</h2></div><button className="icon-button" aria-label="Cerrar propiedades" onClick={() => setInspectorOpen(false)}><Icon name="close" size={16} /></button></div>{selectedNode ? <div className="properties-content"><div className="selected-preview" style={{ backgroundColor: type.soft, color: type.color }}><Icon name={type.icon} size={21} /><span>{type.label}</span></div><label className="field-label">Título<input value={selectedNode.label} onChange={(event) => updateNode({ label: event.target.value })} /></label><label className="field-label">Descripción<textarea value={selectedNode.detail} onChange={(event) => updateNode({ detail: event.target.value })} rows={4} /></label><details className="advanced-source-tools"><summary>Fuentes y resumen avanzado</summary><label className="field-label">Fuente web (URL)<input type="url" value={selectedNode.sourceUrl ?? ''} onChange={(event) => updateNode({ sourceUrl: event.target.value })} placeholder="https://sitio.com/articulo" /></label><label className="field-label">Contenido fuente<textarea value={selectedNode.content ?? ''} onChange={(event) => updateNode({ content: event.target.value })} rows={4} placeholder="Pega aquí texto o HTML para resumirlo." /></label><button className="extract-button" onClick={extractNodeInformation} disabled={extracting}><Icon name="spark" size={15} /> {extracting ? 'Analizando…' : 'Resumir y crear secciones'}</button></details><label className="field-label">Forma<select value={shapeForNode(project.type, selectedNode, project.nodes.findIndex((node) => node.id === selectedNode.id))} onChange={(event) => updateNode({ shape: event.target.value as NodeShape })}><option value="card">Tarjeta</option><option value="circle">Círculo</option><option value="pill">Píldora</option><option value="diamond">Decisión</option><option value="hexagon">Hexágono</option></select></label><label className="field-label">Color<select value={selectedNode.tone} onChange={(event) => updateNode({ tone: event.target.value })}><option value="blue">Azul</option><option value="dark">Carbón</option><option value="lilac">Lila</option><option value="green">Verde</option><option value="orange">Naranja</option></select></label><div className="property-actions"><button className="delete-element" onClick={duplicateNode}><Icon name="copy" size={15} /> Duplicar</button><button className="delete-element" onClick={deleteNode} disabled={project.nodes.length <= 1}><Icon name="trash" size={15} /> Eliminar</button></div></div> : <div className="properties-empty"><span><Icon name="command" size={23} /></span><p>Selecciona un elemento para editarlo.</p></div>}<button className="add-element-button" onClick={addNode}><Icon name="plus" size={15} /> Añadir elemento</button></aside>}</div><aside className="canvas-tools"><div className="tool-group"><span className="tool-label">Editar</span><button className="tool-button is-active" title="Seleccionar elemento"><Icon name="command" /><span>Seleccionar</span></button><button className="tool-button" title="Añadir elemento" onClick={addNode}><Icon name="add" /><span>Añadir</span></button><button className="tool-button" title="Duplicar elemento" onClick={duplicateNode} disabled={!selectedNode}><Icon name="copy" /><span>Duplicar</span></button><button className="tool-button" title="Eliminar elemento" onClick={deleteNode} disabled={!selectedNode || project.nodes.length <= 1}><Icon name="trash" /><span>Eliminar</span></button></div><div className="tools-line" /><div className="tool-group"><span className="tool-label">Organizar</span><button className="tool-button" title="Ordenar automáticamente" onClick={fitCanvas}><Icon name="grid" /><span>Ordenar</span></button><button className="tool-button" title="Mostrar u ocultar cuadrícula" onClick={() => setGridVisible((value) => !value)}><Icon name="grid" /><span>{gridVisible ? 'Cuadrícula' : 'Sin cuadrícula'}</span></button></div><div className="tools-line" /><div className="tool-group tool-group-view"><span className="tool-label">Vista</span><div className="zoom-controls"><button className="tool-button" title="Alejar" onClick={() => updateZoom(-25)} disabled={zoom <= 50}>−</button><button className="zoom-value zoom-button" title="Restablecer zoom" onClick={resetZoom}>{zoom}%</button><button className="tool-button" title="Acercar" onClick={() => updateZoom(25)} disabled={zoom >= 175}>+</button></div></div></aside></main>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
