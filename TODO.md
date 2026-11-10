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
- [x] Se integró Transformers.js con `Xenova/flan-t5-small` cuantizado como modelo compacto opt-in; se ejecuta en el Worker y usa caché del navegador tras la primera descarga.
- [x] La interfaz identifica si una propuesta proviene de reglas offline o del modelo local y mantiene un fallback determinista si el modelo no puede descargarse o ejecutarse.

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
- [x] `npm test` ejecuta 26 pruebas de migración, formatos, adaptadores, edges/puertos, historial/diffs, SVG seguro y plantillas.
- [x] `npm run build` genera la SPA, el Worker de análisis, los artefactos WASM de Transformers.js, el manifiesto y el Service Worker.
- [x] El repositorio canónico de GitHub se utilizó como fuente de trabajo y conserva el flujo de build estático.

## Estado real de las integraciones y trabajo aún pendiente

- [x] Mermaid soporta un subconjunto explícito de flowcharts; importa/exporta forward, backward, both y none con etiquetas escapadas. Construcciones fuera del subconjunto se rechazan con error, no se ignoran silenciosamente.
- [x] Excalidraw importa/exporta formas, texto, etiquetas, direcciones, colores y metadatos de Glyphind; preserva puertos cardinales a través de `customData`.
- [x] Markdown se importa como documento editable, conserva el origen, omite fenced code y limita la generación de elementos a 200.
- [x] Arrastrar/soltar archivos admitidos funciona en dashboard y editor. Se importa un archivo por operación y hay límite de 10 MB.
- [x] Biblioteca local de plantillas versionada, validada, migrable desde el formato anterior, limitada por tamaño y con remapeo de IDs/referencias. Aplicar preserva identidad e historial del proyecto destino.
- [x] Undo/redo semántico por snapshots disponible en canvas, documentos, presentaciones, tableros y cronogramas; soporta agrupación de escritura/arrastre y un máximo de 80 snapshots por sesión.
- [x] Historial visible guarda diffs antes/después por campo y muestra las 12 operaciones más recientes tanto en canvas como en editores especializados; el registro persistido conserva hasta 100 operaciones por proyecto.
- [x] El editor manual de conectores permite destino, etiqueta, dirección, puerto de origen/destino (auto, superior, derecho, inferior o izquierdo), edición de puertos y eliminación; se validan endpoints y duplicados.
- [x] Exportación SVG autocontenida con escaping XML, whitelist de color, formas, flechas, etiquetas y puertos probados.
- [x] API de adaptadores compilados para parsers/exportadores con registro tipado, despacho por extensión y opciones de exportación. Los JSON importados sólo agregan metadatos: nunca cargan ni evalúan código arbitrario por seguridad.
- [x] Extracción HTML usa DOMParser en documento inerte, descarta elementos activos/embebidos y limita la fuente a 2 MB; importación de archivos limita a 10 MB.
- [x] El workflow `.github/workflows/ci.yml` automatiza typecheck, suite de pruebas y build en pushes y pull requests.
- [x] `npm run typecheck` y `npm test` pasan; la suite cubre formatos, diffs, adaptadores, seguridad SVG y plantillas locales.
- [x] CI remoto verificado después del push a `main`: GitHub Actions run `42775239889` terminó con `success`; GitHub Pages sirve el JavaScript y CSS del build publicado.
- [ ] Añadir layouts especializados y editores semánticos completos para matrices, ciclos y conjuntos; los editores de tablero y cronograma existentes aún necesitan mejoras de estructura y dependencias.
- [ ] Virtualizar canvas grandes y validar carga/rendimiento con proyectos de referencia.
- [ ] Implementar captura móvil desde la acción Compartir del sistema operativo.
- [ ] Hacer pruebas prácticas con TalkBack y VoiceOver; las etiquetas ARIA existentes no sustituyen esas verificaciones.
- [ ] Evaluar colaboración opt-in con Yjs/WebRTC sólo después de definir conflictos, permisos y datos que salen del dispositivo.
- [ ] Validar recuperación tras cierre abrupto y rendimiento p95 en móviles reales.
