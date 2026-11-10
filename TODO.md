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
- [x] Las acciones rápidas del dashboard se apilan en móvil; se comprobó que la página no desborda horizontalmente a 320, 390, 768 y 1440 px.

## Verificación de entrega

- [x] `npm run typecheck` termina sin errores.
- [x] `npm test` cubre migración v1, validación de edges y sobre reversible.
- [x] `npm run build` genera la SPA, el Worker de análisis, los artefactos WASM de Transformers.js, el manifiesto y el Service Worker.
- [x] El repositorio canónico de GitHub se utilizó como fuente de trabajo y conserva el flujo de build estático.

## Estado real de las integraciones y trabajo aún pendiente

- [x] Importación/exportación básica de Mermaid y Excalidraw, con pruebas de round-trip para nodos y conectores; no todos los metadatos o construcciones específicas de cada formato se preservan.
- [x] Importación de Markdown y arrastrar/soltar archivos admitidos desde el dashboard.
- [x] Biblioteca local inicial de plantillas: guardar un proyecto como plantilla y aplicarlo desde el editor.
- [x] Editor manual inicial de conectores con nodo de origen/destino, etiqueta y dirección. Los «puertos» aún equivalen a elegir nodos; no hay anclajes de conexión nombrados por lado.
- [x] Build de producción, pruebas y typecheck corren localmente; las diez pruebas actuales pasan.
- [ ] Completar undo/redo semántico para todas las vistas y controles, y mostrar diffs antes/después reales; el historial actual es un resumen de operaciones del canvas, no un comparador visual completo.
- [ ] Completar la API y ejecución segura de plugins para parsers/exportadores; hoy sólo se registran descriptores locales, sin ejecutar ni despachar extensiones.
- [ ] Añadir layouts especializados y editores semánticos completos para matrices, ciclos, conjuntos, cronogramas y tableros; el layout existente no cubre todas esas estructuras.
- [ ] Virtualizar canvas grandes y validar carga/rendimiento con proyectos de referencia.
- [ ] Implementar captura móvil desde la acción Compartir del sistema operativo.
- [ ] Completar sanitización de HTML y SVG de extremo a extremo, agregar pruebas de seguridad y revisar los límites de importación/exportación.
- [ ] Crear CI automático en GitHub Actions. El primer intento de publicar el workflow fue rechazado por falta del permiso `workflows` del token de GitHub.
- [ ] Hacer pruebas prácticas con TalkBack y VoiceOver; las etiquetas ARIA existentes no sustituyen esas verificaciones.
- [ ] Evaluar colaboración opt-in con Yjs/WebRTC sólo después de definir conflictos, permisos y datos que salen del dispositivo.
- [ ] Validar recuperación tras cierre abrupto y rendimiento p95 en móviles reales.
