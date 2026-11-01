import { StrictMode, useEffect, useMemo, useState, type FormEvent } from 'react';
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
};

type Project = {
  id: string;
  name: string;
  type: string;
  updated: number;
  nodes: DiagramNode[];
};

type DiagramType = {
  id: string;
  label: string;
  description: string;
  icon: IconName;
  color: string;
  soft: string;
};

const STORAGE_KEY = 'glyphind-projects-v1';

const diagramTypes: DiagramType[] = [
  { id: 'flow', label: 'Flujo', description: 'Procesos, decisiones y recorridos', icon: 'flow', color: '#5b63d8', soft: '#eef0ff' },
  { id: 'tasks', label: 'Pendientes', description: 'Listas, prioridades y avances', icon: 'checklist', color: '#db744f', soft: '#fff0e9' },
  { id: 'document', label: 'Documento', description: 'Redacción, revisión y entrega', icon: 'folder', color: '#3478b9', soft: '#e8f3ff' },
  { id: 'presentation', label: 'Presentación', description: 'Narrativa, diapositivas y revisión', icon: 'grid', color: '#bc633f', soft: '#fff0e8' },
  { id: 'concept', label: 'Mapa conceptual', description: 'Conceptos, relaciones y síntesis', icon: 'command', color: '#2e8c86', soft: '#e7f8f5' },
  { id: 'mindmap', label: 'Mapa mental', description: 'Ideas que crecen desde un centro', icon: 'spark', color: '#bd8b31', soft: '#fff7df' },
  { id: 'timeline', label: 'Cronograma', description: 'Fases, dependencias y fechas', icon: 'arrow', color: '#7c5ab5', soft: '#f1ebff' },
  { id: 'board', label: 'Tablero', description: 'Entrada, progreso, revisión y cierre', icon: 'checklist', color: '#2b8e78', soft: '#e7f7f1' },
  { id: 'custom', label: 'Flujo personalizado', description: 'Construye cualquier proceso', icon: 'add', color: '#5b63d8', soft: '#eef0ff' },
  { id: 'team', label: 'Equipo', description: 'Roles, personas y estructura', icon: 'team', color: '#2b8e78', soft: '#e7f7f1' },
  { id: 'community', label: 'Comunidad', description: 'Relaciones, grupos y conexiones', icon: 'community', color: '#a45dbd', soft: '#f7eafa' },
];

const availableDiagramTypes = diagramTypes.filter((type) => type.id !== 'team' && type.id !== 'community');
const workflowTemplates = availableDiagramTypes.filter((type) => ['document', 'presentation', 'concept', 'mindmap', 'timeline', 'board', 'custom'].includes(type.id));

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
};

const seedProjects: Project[] = [
  { id: 'project-1', name: 'Lanzamiento de producto', type: 'flow', updated: Date.now() - 1000 * 60 * 18, nodes: defaultNodes.flow },
  { id: 'project-2', name: 'Mapa del equipo', type: 'team', updated: Date.now() - 1000 * 60 * 60 * 3, nodes: defaultNodes.team },
  { id: 'project-3', name: 'Comunidad Glyphind', type: 'community', updated: Date.now() - 1000 * 60 * 60 * 22, nodes: defaultNodes.community },
  { id: 'project-4', name: 'Plan semanal', type: 'tasks', updated: Date.now() - 1000 * 60 * 60 * 31, nodes: defaultNodes.tasks },
  { id: 'project-5', name: 'Ideas para el futuro', type: 'mindmap', updated: Date.now() - 1000 * 60 * 60 * 46, nodes: defaultNodes.mindmap },
];

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

function createProject(name: string, type: string): Project {
  return {
    id: `project-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name: name.trim() || 'Proyecto sin título',
    type,
    updated: Date.now(),
    nodes: defaultNodes[type]?.map((node) => ({ ...node, id: `${node.id}-${Date.now()}` })) ?? defaultNodes.flow,
  };
}

function downloadProject(project: Project) {
  const type = typeFor(project.type);
  const body = [
    `# ${project.name}`,
    `Tipo: ${type.label}`,
    '',
    ...project.nodes.map((node, index) => `${index + 1}. **${node.label}** — ${node.detail}`),
    '',
    `Exportado desde Glyphind · ${new Date().toLocaleString('es-MX')}`,
  ].join('\n');
  const blob = new Blob([body], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${project.name.toLowerCase().replace(/[^a-z0-9áéíóúñ]+/gi, '-').replace(/^-|-$/g, '') || 'glyphind-proyecto'}.md`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function App() {
  const [projects, setProjects] = useState<Project[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) as Project[] : seedProjects;
    } catch {
      return seedProjects;
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
      const project = createProject(draftName, draftType);
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

  if (activeView === 'editor' && activeProject) {
    return (
      <Editor
        project={activeProject}
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
          <button className="nav-item is-active" onClick={() => { setActiveView('projects'); setMobileMenu(false); }}><Icon name="grid" /><span>Todos los proyectos</span><strong>{projects.length}</strong></button>
          <button className="nav-item" onClick={() => { setFilter('flow'); setMobileMenu(false); }}><Icon name="flow" /><span>Flujos</span></button>
          <button className="nav-item" onClick={() => { setFilter('tasks'); setMobileMenu(false); }}><Icon name="checklist" /><span>Pendientes</span></button>
          <button className="nav-item nav-item-upcoming" disabled><Icon name="team" /><span>Equipos <small>Próximamente</small></span></button>
          <button className="nav-item nav-item-upcoming" disabled><Icon name="community" /><span>Comunidades <small>Próximamente</small></span></button>
          <div className="nav-divider" />
          <p className="nav-label">Biblioteca</p>
          <button className="nav-item" onClick={() => { setFilter('mindmap'); setMobileMenu(false); }}><Icon name="spark" /><span>Mapas mentales</span></button>
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-footnote"><span>G</span><span>Glyphind <em>0.1</em></span></div>
        </div>
      </aside>
      {mobileMenu && <button className="sidebar-overlay" aria-label="Cerrar menú" onClick={() => setMobileMenu(false)} />}

      <main className="main-content">
        <header className="topbar">
          <button className="icon-button mobile-menu-button" aria-label="Abrir menú" onClick={() => setMobileMenu(true)}><Icon name="menu" /></button>
          <div className="breadcrumbs"><span>Espacio de trabajo</span><span className="breadcrumb-slash">/</span><strong>Proyectos</strong></div>
          <div className="topbar-actions"><span className="keyboard-hint"><Icon name="command" size={13} /><span>K</span></span><button className="top-new-button" onClick={openNewModal}><Icon name="plus" size={16} /> Nuevo proyecto</button></div>
        </header>

        <div className="page-wrap">
          <section className="page-intro">
            <div>
              <div className="eyebrow"><span className="eyebrow-line" /> Tu espacio local</div>
              <h1>Mis proyectos <span className="project-count">{projects.length}</span></h1>
              <p>Un lugar tranquilo para pensar, conectar y dar forma a tus ideas.</p>
            </div>
          </section>

          <section className="project-toolbar" aria-label="Buscar y filtrar proyectos">
            <div className="search-box"><Icon name="search" size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar proyectos..." aria-label="Buscar proyectos" />{search && <button className="search-clear" onClick={() => setSearch('')}><Icon name="close" size={14} /></button>}</div>
            <label className="filter-box"><Icon name="filter" size={16} /><select value={filter} onChange={(event) => setFilter(event.target.value)} aria-label="Filtrar por tipo"><option value="all">Todos los tipos</option>{availableDiagramTypes.map((type) => <option key={type.id} value={type.id}>{type.label}</option>)}</select><Icon name="chevron" size={15} /></label>
            <span className="toolbar-result">{filteredProjects.length} {filteredProjects.length === 1 ? 'proyecto' : 'proyectos'}</span>
          </section>

          <section className="projects-section">
            <div className="section-heading"><div><span className="section-kicker">Vista general</span><h2>Proyectos recientes</h2></div><button className="text-action" onClick={openNewModal}>Crear otro <Icon name="arrow" size={15} /></button></div>
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
              <div className="empty-state"><span className="empty-icon"><Icon name="search" size={26} /></span><h3>No encontramos ese proyecto</h3><p>Prueba otra búsqueda o limpia los filtros para volver a ver tus proyectos.</p><button className="secondary-button" onClick={() => { setSearch(''); setFilter('all'); }}>Limpiar filtros</button></div>
            )}
          </section>

          <section className="template-catalog"><div className="section-heading"><div><span className="section-kicker">Catálogo</span><h2>Plantillas reales para empezar</h2></div><span className="template-count">{workflowTemplates.length} plantillas</span></div><div className="template-grid">{workflowTemplates.map((template) => <button className="template-card" key={template.id} onClick={() => { const project = createProject(template.label, template.id); setProjects((current) => [project, ...current]); openProject(project); }}><span className="project-type-icon" style={{ color: template.color, backgroundColor: template.soft }}><Icon name={template.icon} size={21} /></span><span><strong>{template.label}</strong><small>{template.description}</small><em>Crear flujo →</em></span></button>)}</div></section>
          <button className="new-project-card" onClick={openNewModal}><span className="new-project-plus"><Icon name="plus" size={20} /></span><span><strong>Empieza algo nuevo</strong><small>Crea un espacio para ordenar tus ideas</small></span><Icon name="arrow" size={18} /></button>
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
        <div className="modal-head"><div><span className="section-kicker">{mode === 'new' ? 'Nuevo espacio' : 'Editar espacio'}</span><h2>{mode === 'new' ? 'Crea tu próximo proyecto' : 'Ajusta los detalles'}</h2></div><button type="button" className="icon-button" onClick={onClose} aria-label="Cerrar"><Icon name="close" /></button></div>
        <label className="field-label">Nombre del proyecto<input autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder="Ej. Flujo de incorporación" /></label>
        <div className="field-label">Tipo de diagrama<div className="type-choice-grid">{availableDiagramTypes.map((item) => <button type="button" key={item.id} className={`type-choice ${type === item.id ? 'is-selected' : ''}`} onClick={() => setType(item.id)}><span style={{ color: item.color, backgroundColor: item.soft }}><Icon name={item.icon} size={19} /></span><span><strong>{item.label}</strong><small>{item.description}</small></span>{type === item.id && <i>✓</i>}</button>)}</div></div>
        <div className="modal-foot"><span>Configura tu espacio y empieza a trabajar</span><div><button type="button" className="secondary-button" onClick={onClose}>Cancelar</button><button type="submit" className="primary-button">{mode === 'new' ? 'Crear proyecto' : 'Guardar cambios'} <Icon name="arrow" size={15} /></button></div></div>
      </form>
    </div>
  );
}

function Editor({ project, onBack, onChange, onToast }: { project: Project; onBack: () => void; onChange: (project: Project) => void; onToast: (message: string) => void }) {
  const [selectedNodeId, setSelectedNodeId] = useState(project.nodes[0]?.id ?? '');
  const [inspectorOpen, setInspectorOpen] = useState(true);
  const [zoom, setZoom] = useState(100);
  const type = typeFor(project.type);
  const selectedNode = project.nodes.find((node) => node.id === selectedNodeId) ?? project.nodes[0];

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

  const deleteNode = () => {
    if (!selectedNode || project.nodes.length <= 1) return;
    const remaining = project.nodes.filter((node) => node.id !== selectedNode.id);
    onChange({ ...project, nodes: remaining });
    setSelectedNodeId(remaining[0].id);
    onToast('Elemento eliminado');
  };

  const fitCanvas = () => {
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

  const cycleZoom = () => {
    const nextZoom = zoom >= 150 ? 75 : zoom + 25;
    setZoom(nextZoom);
    onToast(`Zoom ${nextZoom}%`);
  };

  return (
    <div className="editor-shell">
      <header className="editor-topbar"><button className="back-link" onClick={onBack}><Icon name="back" size={17} /> Volver a proyectos</button><div className="editor-breadcrumb"><span>/</span><span>{project.name}</span><span className="editor-type-pill" style={{ color: type.color, backgroundColor: type.soft }}><Icon name={type.icon} size={13} /> {type.label}</span></div><div className="editor-actions"><span className="saved-label"><span className="canvas-live-dot" /> Cambios activos</span><button className="icon-button" title="Compartir (próximamente)" disabled><Icon name="share" size={17} /></button></div></header>
      <main className="editor-main"><div className="editor-heading"><div><span className="section-kicker">Editor de diagrama</span><h1>{project.name}</h1><p>{type.description}. Cambia, elimina o añade elementos para construir tu flujo.</p></div><button className="secondary-button" onClick={() => { downloadProject(project); onToast('Flujo exportado como Markdown'); }}><Icon name="arrow" size={15} /> Exportar</button></div><div className={`editor-workspace ${inspectorOpen ? '' : 'inspector-is-closed'}`}><aside className="canvas-tools"><span className="tool-label">Herramientas</span><button className="tool-button is-active" title="Seleccionar"><Icon name="command" /></button><button className="tool-button" title="Añadir elemento" onClick={addNode}><Icon name="add" /></button><div className="tools-line" /><span className="tool-label">Vista</span><button className="tool-button" title="Ajustar lienzo" onClick={fitCanvas}><Icon name="grid" /></button><button className="zoom-value zoom-button" title="Cambiar zoom" onClick={cycleZoom}>{zoom}%</button></aside><section className="canvas-section"><div className="canvas-header"><span><span className="canvas-live-dot" /> Lienzo de trabajo</span><span className="canvas-help">Selecciona un elemento para editarlo</span>{!inspectorOpen && <button className="reopen-inspector" onClick={() => setInspectorOpen(true)}>Mostrar inspector <Icon name="arrow" size={13} /></button>}</div><div className="diagram-canvas" onClick={() => setSelectedNodeId('')}><div className="canvas-zoom-layer" style={{ transform: `scale(${zoom / 100})` }}><svg className="canvas-lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><path d="M22 48 C30 48, 30 35, 39 35 M55 36 C64 36, 64 50, 68 50 M77 59 C81 63, 82 66, 83 72" /></svg>{project.nodes.map((node) => <button key={node.id} className={`diagram-node node-${node.tone} ${selectedNode?.id === node.id ? 'is-selected' : ''}`} style={{ left: `${node.x}%`, top: `${node.y}%` }} onClick={(event) => { event.stopPropagation(); setSelectedNodeId(node.id); }}><span className="node-grip"><i /><i /><i /></span><strong>{node.label}</strong><small>{node.detail}</small></button>)}</div></div><div className="canvas-footer"><span>{project.nodes.length} elementos</span><span><kbd>⌘</kbd> + <kbd>K</kbd> para comandos</span></div></section>{inspectorOpen && <aside className="properties-panel"><div className="properties-head"><div><span className="section-kicker">Inspector</span><h2>Propiedades</h2></div><button className="icon-button" aria-label="Cerrar inspector" onClick={() => setInspectorOpen(false)}><Icon name="close" size={16} /></button></div>{selectedNode ? <div className="properties-content"><div className="selected-preview" style={{ backgroundColor: type.soft, color: type.color }}><Icon name={type.icon} size={21} /><span>{type.label}</span></div><label className="field-label">Título<input value={selectedNode.label} onChange={(event) => updateNode({ label: event.target.value })} /></label><label className="field-label">Descripción<textarea value={selectedNode.detail} onChange={(event) => updateNode({ detail: event.target.value })} rows={4} /></label><div className="property-meta"><span>ID del elemento</span><code>{selectedNode.id.slice(0, 12)}</code></div><button className="delete-element" onClick={deleteNode} disabled={project.nodes.length <= 1}><Icon name="trash" size={15} /> Eliminar elemento</button></div> : <div className="properties-empty"><span><Icon name="command" size={23} /></span><p>Selecciona un elemento del lienzo para editar sus propiedades.</p></div>}<button className="add-element-button" onClick={addNode}><Icon name="plus" size={15} /> Añadir elemento</button></aside>}</div></main>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
