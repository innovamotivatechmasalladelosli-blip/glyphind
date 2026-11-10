# Glyphind — resultados de la entrega

## Aplicación local-first y sin infraestructura remota

- [x] La aplicación se ejecuta como frontend web sin servidor de aplicación ni base de datos gestionada.
- [x] Los proyectos y cambios del editor se conservan en IndexedDB mediante snapshots transaccionales, con fallback compatible a `localStorage` bajo `glyphind-projects-v1`.
- [x] La experiencia incluye indicación visible de estado local y funciona sin depender de una cuenta.
- [x] Se añadió una carcasa PWA progresiva con manifiesto y Service Worker para reabrir la aplicación sin red después de la primera visita.

## Contrato de datos y portabilidad

- [x] Cada proyecto usa `schemaVersion: 1` con IDs estables, nodos, edges explícitos, páginas, grupos, fuentes y procedencia.
- [x] La migración desde proyectos antiguos conserva nodos y contenido y convierte las conexiones inferidas por orden en edges versionados.
- [x] El editor deja de dibujar relaciones a partir de la posición: el renderer y los exportadores consumen `edges` con origen, destino, dirección, relación, etiqueta y confianza.
- [x] Cada proyecto puede descargarse como `.glyphind`, JSON reversible, Markdown, CSV o SVG.
- [x] El workspace completo puede exportarse e importarse como respaldo versionado; la importación acepta sobres de workspace, arrays legados y un documento `.glyphind` individual.
- [x] Duplicar, cambiar formato, crear nodos y eliminar nodos remapea o limpia relaciones y páginas para evitar endpoints huérfanos.

## Texto, web y evidencia explicable

- [x] El análisis de texto, HTML y URL se ejecuta en un Web Worker para no bloquear el canvas.
- [x] La URL se lee directamente desde el navegador y, cuando CORS lo impide, la interfaz ofrece pegar HTML o texto y explica que no existe un proxy remoto oculto.
- [x] Las propuestas conservan fragmentos, selector aproximado, fecha, URL opcional, confianza y método de generación.
- [x] El usuario puede revisar, aceptar o descartar sugerencias antes de incorporarlas al documento.
- [x] El panel de revisión muestra evidencia y relaciones sugeridas con etiquetas legibles.

## IA gratuita ejecutada en el dispositivo

- [x] El modo predeterminado usa reglas locales, sin descargar modelos ni enviar contenido fuera del dispositivo.
- [x] Se integró Transformers.js con `Xenova/multilingual-e5-small` cuantizado como modo opt-in de IA semántica. Ordena frases literales de la fuente (no redacta); corre en el Worker y usa caché del navegador tras la primera descarga.
- [x] La interfaz diferencia reglas offline de IA semántica local y conserva un fallback determinista si el modelo no puede descargarse o ejecutarse. Prueba Chromium con texto español: dos frases literales pertinentes, sin errores JS.

## Editor accesible y experiencia móvil

- [x] El canvas mantiene selección por teclado, etiquetas accesibles en nodos y alternativa estructural mediante Vista de esquema.
- [x] La Vista de esquema permite recorrer nodos y relaciones sin depender de la posición o el color y puede abrir el inspector del elemento seleccionado.
- [x] Los paneles de evidencia y esquema se convierten en bottom sheets en pantallas pequeñas.
- [x] Se respeta `prefers-reduced-motion` para eliminar movimientos no esenciales.
- [x] Se ajustó la barra de herramientas del canvas para permanecer flotante y utilizable en escritorio y móvil; en anchos menores el canvas ofrece desplazamiento horizontal y una indicación visible para encontrar el resto del diagrama.
- [x] Las acciones rápidas del dashboard se apilan en móvil; dashboard, editor y menú de exportación se comprobaron sin overflow a 320, 390, 768 y 1440 px.
- [x] El menú de opciones de proyecto se posiciona dentro del viewport, se recoloca al desplazarse y ofrece Editar, Duplicar y Eliminar también en la última fila, en escritorio y móvil.
- [x] El pie del sidebar muestra “Powered by InnovA+” justo encima de la versión de Glyphind.

## Verificación de entrega

- [x] `npm run typecheck` termina sin errores.
- [x] `npm test` ejecuta 48 pruebas de migración, formatos, adaptadores, edges/puertos, historial/diffs, SVG seguro, plantillas, estructuras semánticas, fuentes compartidas, recuperación y selección semántica.
- [x] `npm run build` genera la SPA, el Worker de análisis, los artefactos WASM de Transformers.js, el manifiesto y el Service Worker.
- [x] El repositorio canónico de GitHub se utilizó como fuente de trabajo y conserva el flujo de build estático.

## Estado real de las integraciones y trabajo aún pendiente

- [x] Mermaid soporta un subconjunto explícito de flowcharts; importa/exporta forward, backward, both y none con etiquetas escapadas. Construcciones fuera del subconjunto se rechazan con error, no se ignoran silenciosamente.
- [x] Excalidraw importa/exporta formas, texto, etiquetas, direcciones, colores y metadatos de Glyphind; preserva puertos cardinales a través de `customData`.
- [x] Markdown se importa como documento editable, conserva el origen, omite fenced code y limita la generación de elementos a 200.
- [x] Arrastrar/soltar archivos admitidos funciona en dashboard y editor. Se importa un archivo por operación y hay límite de 10 MB.
- [x] Biblioteca local de plantillas versionada, validada, migrable desde el formato anterior, limitada por tamaño y con remapeo de IDs/referencias. Aplicar preserva identidad e historial del proyecto destino.
- [x] Undo/redo semántico por snapshots disponible en canvas, documentos, presentaciones, tableros y cronogramas; soporta agrupación de escritura/arrastre y un máximo de 80 snapshots por sesión.
- [x] Historial visible guarda diffs antes/después por campo, los compara en paneles visuales y muestra las 12 operaciones más recientes tanto en canvas como en editores especializados; el registro persistido conserva hasta 100 operaciones por proyecto.
- [x] El editor manual de conectores permite destino, etiqueta, dirección, puerto de origen/destino (auto, superior, derecho, inferior o izquierdo), edición de puertos y eliminación; se validan endpoints y duplicados.
- [x] Exportación SVG autocontenida con escaping XML, whitelist de color, formas, flechas, etiquetas y puertos probados.
- [x] API ejecutable de adaptadores de formato confiables integrados al build: registro tipado, dispatch por extensión y funciones parser/exporter reales. Plugins JSON externos sólo agregan metadatos; no se evalúa JavaScript arbitrario.
- [ ] Carga dinámica de código aportado por usuarios aún no habilitada; requiere un sandbox con aislamiento/permisos auditados y pruebas ante código malicioso, no sólo un registro de metadatos.
- [x] Extracción HTML usa DOMParser en documento inerte, descarta elementos activos/embebidos y limita la fuente a 2 MB; importación de archivos limita a 10 MB.
- [x] El workflow `.github/workflows/ci.yml` automatiza typecheck, suite de pruebas y build en pushes y pull requests.
- [x] `npm run typecheck`, `npm test` (48 pruebas) y `npm run build` pasan tras integrar IA multilingüe y comparación visual del historial.
- [x] CI remoto verificado después del push a `main`; build de GitHub Pages publica JavaScript y CSS estáticos.
- [x] Matriz comparativa con opciones/criterios/celdas editables, ciclo con orden y cierre explícito, y conjuntos A/B con pertenencia e intersección editables; sus estructuras y referencias de página se guardan localmente, CSV/Markdown exportan datos semánticos y JSON conserva relaciones de ciclo/página.
- [x] Tablero: columnas editables/reordenables, límites WIP y traslado de tarjetas; cronograma: duración y dependencias acíclicas. UI probada en desktop y móvil.
- [x] Canvas grande: ventana de hasta 80 nodos, navegación por vistas, conexiones entre ventanas indicadas y datos completos intactos; Playwright probó 181 nodos y preservación del documento.
- [x] Captura móvil PWA desde la acción Compartir del sistema: recibe título/texto/URL, crea un documento local y conserva la URL y fragmento en Fuentes. Debe instalarse Glyphind como app para aparecer en el selector del sistema operativo.
- [x] Playwright/Chrome: selección de nodos por teclado; árbol AX con 38 controles interactivos y ninguno sin nombre accesible en el flujo probado.
- [ ] Prueba física con TalkBack y VoiceOver; no se sustituye por la auditoría automática de Chromium y requiere Android/iOS con lector real.
- [ ] Implementar colaboración opt-in con Yjs/WebRTC. Sigue sin compartirse contenido ni usar señalización remota hasta definir el flujo de conexión, manejo de conflictos y consentimiento explícito por proyecto.
- [x] Recuperación práctica: con snapshot válido y workspace activo corrupto, la app restauró el proyecto y mostró aviso, sin errores de consola.
- [ ] Medir rendimiento p95 y carga de proyectos grandes en móviles físicos.
