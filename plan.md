# Glyphind — implementación local-first e IA en el dispositivo

## Alcance de esta entrega

Se ampliará la aplicación existente sin sustituir su editor actual. La entrega introduce el contrato de datos versionado, relaciones semánticas de primera clase, persistencia durable con fallback, exportación/importación `.glyphind`, análisis en Web Worker, evidencia por fragmento, esquema accesible y una capa de IA local opt-in.

El flujo por defecto seguirá funcionando sin cuenta, backend ni red. El modelo generativo compacto sólo se descarga cuando el usuario lo solicita; después Transformers.js lo ejecuta en el navegador y reutiliza la caché del dispositivo. El analizador determinista local seguirá disponible aun sin descargar modelos.

## Arquitectura

- `src/domain/model.ts`: tipos canónicos Glyphind v1, normalización y migración desde `glyphind-projects-v1`.
- `src/storage/workspace.ts`: IndexedDB para proyectos y snapshots; escritura transaccional y fallback a `localStorage`.
- `src/workers/analysis.worker.ts`: sanitización, extracción de estructura, palabras clave y resumen; opcionalmente carga `Xenova/flan-t5-small` cuantizado mediante Transformers.js en el propio Worker.
- `src/ai/localAi.ts`: API tipada para invocar el Worker, describir el modo de IA y devolver sugerencias trazables.
- `src/main.tsx`: integración gradual con la UI existente; canvas conserva su renderer, pero consume `edges` explícitos y ofrece aceptar/rechazar sugerencias y vista de esquema.
- `public/sw.js`: caché de la carcasa estática para apertura offline después de la primera visita.

## Contrato de datos

`Project` conservará los campos existentes y añadirá `schemaVersion`, `edges`, `groups`, `pages`, `sources` e historial opcional. Cada `GlyphindEdge` contiene `from`, `to`, tipo de relación, dirección, etiqueta y confianza. Cada `GlyphindSource` conserva URL, fecha, fragmentos y si el dato fue inferido. La migración convierte proyectos antiguos y sus parejas geométricas en edges estables sin modificar el contenido visible.

## Persistencia y portabilidad

La carga intenta IndexedDB y valida el snapshot más reciente; durante la transición se mantiene `glyphind-projects-v1` como fallback y respaldo de compatibilidad. Las escrituras guardan un snapshot previo en una transacción antes de reemplazar la colección activa. El exportador JSON seguirá disponible y cada proyecto podrá descargarse como `.glyphind`, un documento JSON legible y versionado. La importación acepta respaldo de workspace, array legado o proyecto individual.

## IA local y explicable

1. Reglas deterministas en Worker: títulos, secciones, párrafos, resumen, keywords, nodos sugeridos y relaciones secuenciales.
2. Modelo gratuito opcional: `Xenova/flan-t5-small`, descargado desde Hugging Face sólo tras acción explícita, almacenado por la caché del navegador y ejecutado en Worker. El modo se muestra en la UI y los errores regresan a reglas locales.
3. Las sugerencias no sobrescriben el canvas. El usuario puede aceptar o descartar; al aceptar, cada nodo guarda evidencia y las relaciones aceptadas quedan como edges explícitos.

## Diseño

- **Estilos considerados:** archivo editorial silencioso (0.06), laboratorio de evidencia local (0.07), herramienta de operaciones técnica (0.04).
- **Elección:** laboratorio de evidencia local.
- **Movimiento:** interfaz editorial cálida con señales de instrumentación: papel claro, bordes finos, acento coral y chips verdes para estado local.
- **Principios:** la fuente siempre queda visible; la semántica precede a la geometría; las sugerencias son reversibles; el teclado y la lista paralela son ciudadanos de primera clase.
- **Color:** se conserva la paleta Glyphind y se añade un azul oscuro para evidencia, verde para local/offline y ámbar para inferencias pendientes.
- **Layout:** canvas amplio con herramientas flotantes y paneles laterales/bottom sheets, evitando introducir un dashboard separado.
- **Elementos distintivos:** chip `Local`, panel de evidencia con fragmentos citables y esquema navegable de nodos/edges.
- **Interacción:** acciones críticas tienen botón y alternativa de teclado; aceptar/rechazar evita mutaciones silenciosas.
- **Animación:** transiciones cortas; `prefers-reduced-motion` elimina desplazamientos y desactiva animaciones no esenciales.
- **Tipografía:** se mantiene Manrope para jerarquía, DM Sans para lectura y DM Mono para metadatos.
- **Esencia:** convierte texto y fuentes en diagramas editables, revisables y portables sin sacar el contenido del dispositivo. Personalidad: explicable, tranquila, autónoma.
- **Voz:** “La fuente permanece contigo.” / “Acepta sólo las relaciones que puedas explicar.”
- **Marca:** el monograma de nodos actual se conserva como firma del archivo visual local.
- **Color propio:** coral `#ef815e`, usado sólo para acciones de creación y foco.

## Servido y compatibilidad

La aplicación seguirá siendo una Vite SPA con ruta `/`. El manifest de rutas se conserva actualizado. El registro del Service Worker será progresivo y no bloqueará el arranque. La descarga de modelo es una operación de red visible y consentida; no existe analítica ni telemetría del contenido.
