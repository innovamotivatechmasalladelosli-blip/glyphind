# Glyphind

Glyphind es un espacio local-first para convertir texto, páginas web y notas en diagramas editables, revisables y exportables. La fuente canónica permanece en el dispositivo: no requiere cuenta, backend ni base de datos remota para crear, editar, abrir o exportar proyectos.

## Qué incluye la base actual

El documento Glyphind v1 conserva nodos, relaciones explícitas, páginas, grupos, fuentes, evidencia e historial opcional. Los proyectos creados con la versión anterior (`glyphind-projects-v1`) se migran al abrirse; las conexiones antiguas se convierten en `edges` sin borrar los nodos ni el contenido existente.

La persistencia intenta IndexedDB con snapshots transaccionales y mantiene localStorage como fallback de compatibilidad. El workspace completo se puede descargar como `.glyphind` y cada proyecto admite JSON editable, Markdown, CSV y SVG. Un archivo `.glyphind` se puede importar desde el mismo botón de respaldo.

El análisis de fuentes se ejecuta en un Web Worker para no bloquear el canvas. El modo predeterminado usa reglas locales para detectar título, secciones, párrafos, palabras clave, nodos sugeridos y fragmentos de evidencia. Las sugerencias se muestran antes de modificar el documento y el usuario puede aceptarlas o descartarlas.

Glyphind también integra un modelo gratuito y opcional mediante Transformers.js: `Xenova/flan-t5-small` en formato cuantizado. La primera activación del modo **Modelo compacto** descarga el modelo desde Hugging Face; luego el navegador lo reutiliza desde su caché y lo ejecuta en el Worker. Ese flujo de red es visible y opt-in. Si el modelo no está disponible, las reglas locales siguen funcionando y el documento no se envía a un servidor de Glyphind.

El editor incorpora una **Vista de esquema** navegable por teclado y lector de pantalla, con relaciones y procedencia legibles sin depender del color. La aplicación incluye Service Worker y manifiesto PWA progresivos para reabrir la carcasa estática sin red después de la primera visita.

La segunda ampliación de herramientas hace más completos los editores especializados. Documentos permite importar `.txt` y `.md`, aplicar formato Markdown, insertar tablas y código, buscar y reemplazar, consultar un esquema navegable, abrir una vista previa, copiar el contenido y revisar métricas de lectura. Presentaciones permite vincular diapositivas con diagramas, duplicarlas y reordenarlas. Tableros permite filtrar tarjetas y administrar columnas. Todos los editores incluyen una bandeja común para copiar el JSON editable, descargar `.glyphind` y consultar atajos. El canvas permite crear conexiones manuales entre nodos, además de las relaciones iniciales de plantilla.

## Desarrollo local

```bash
npm ci
npm run dev
```

La aplicación se sirve en `http://localhost:3000`. Para typecheck y pruebas del modelo:

```bash
npm run typecheck
npm test
```

Para generar una compilación de producción, incluyendo los artefactos estáticos de GitHub Pages:

```bash
npm run build
```

## Privacidad y límites deliberados

No hay telemetría del contenido del usuario. La lectura directa de una URL usa `fetch` desde el navegador y puede fallar por CORS; en ese caso Glyphind explica el límite y permite pegar HTML o texto, en lugar de ocultar un proxy remoto detrás de una experiencia local-first.
