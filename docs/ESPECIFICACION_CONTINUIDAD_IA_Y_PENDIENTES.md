# Especificación de continuidad de Glyphind

Fecha de estado: 10 de noviembre de 2026. Repositorio: `glyphind`, rama `main`.

## Contexto del usuario

La queja prioritaria fue que la función de IA parecía no hacer nada: no extraía información visible ni llenaba los recuadros; además, las herramientas no se sentían prácticas y se pidió descarga en formato de imagen. La respuesta debe priorizar acciones directas y resultados editables, en español, en escritorio y móvil, preservando el enfoque local-first.

## Cambios implementados en esta continuación

- Se añadió una acción visible en el dashboard, **Crear desde texto**. Recibe texto pegado o URL pública. Primero intenta leerla desde el navegador; si CORS bloquea, permite pegar texto/HTML o elegir el proxy remoto. Cada uso del proxy requiere consentimiento explícito para ese intento y muestra la URL y el envío a Cloudflare.
- El asistente recomienda `Xenova/multilingual-e5-small` en un Worker y muestra progreso de lectura/descarga/carga/análisis. El modelo puntúa frases existentes y conserva su literalidad; no es un generador que invente hechos. Como alternativa existe extracción por reglas, sin descargar el modelo.
- La acción crea y abre un proyecto con nodo raíz, hasta ocho frases seleccionadas, tarjetas editables, conectores y fuente local por tarjeta. Los detalles conservan las frases completas. Cuando el título deriva de la primera frase, se evita duplicarla como rama; conectores autogenerados no reciben etiquetas redundantes.
- En el inspector, el botón de análisis ahora explica que crea tarjetas/conectores y la aceptación utiliza las frases relevantes como contenido de las tarjetas, no sólo títulos genéricos.
- Los diagramas de nodos ofrecen descarga PNG local a 2400×1600, rasterizando el SVG sin subir datos. La opción se oculta para editores especializados porque la imagen genérica de nodos no representa fielmente sus vistas.
- En móvil el canvas permite desplazamiento táctil interno, centra el primer nodo al abrir y muestra ayuda para deslizar. Se probó a 390 px y en escritorio a 1440 px.

## Privacidad y uso de créditos

La inferencia semántica se ejecuta en el dispositivo mediante Transformers.js; el texto no se envía a una API de generación. El usuario puede elegir el modo offline sin descarga. El modelo se descarga la primera vez y luego puede aprovechar la caché del navegador. Una URL se intenta leer directamente; si el usuario autoriza el proxy, Cloudflare recibe la URL, obtiene temporalmente el texto de la página y lo devuelve al cliente para extracción local. El Worker limita CORS al origen oficial de Pages, aplica 6 lecturas/minuto, timeout de 12 s, 1 MB, bloquea destinos privados/literales, credenciales, puertos no estándar y redirects; observabilidad/logs están desactivados. Queda riesgo residual de DNS rebinding entre validación y fetch, documentado en `docs/PROXY_CLOUDFLARE_REFERENCIAS.md`. Esta implementación no utilizó créditos externos de LLM.

No cambiar a un modelo de nube ni enviar texto fuente a terceros sin consentimiento explícito del usuario y una explicación de privacidad y coste.

## Pruebas de aceptación ya verificadas

1. En Chromium móvil, un texto en español de cuatro ideas produce un proyecto con raíz, tarjetas y conectores; las tarjetas conservan frases fuente y la primera frase no se duplica como rama.
2. El modo de IA semántica local se ejecutó en Chromium; el caso de prueba produjo cinco nodos y conectores, sin errores de JavaScript.
3. La descarga PNG genera un archivo PNG válido de 2400×1600, sin error del navegador.
4. A 390 px el documento no tiene overflow horizontal de página; el canvas sí reporta scroll interno para acceder a nodos fuera de la vista y el nodo raíz está visible.
5. A 1440 px la acción de creación funciona sin overflow horizontal y produce nodos.
6. Las pruebas automatizadas incluyen generación de proyecto, evidencia, relaciones, flujo, reglas offline, rechazo de frases vacías y deduplicación del título.

Comandos antes de integrar cualquier continuación:

```bash
npm run typecheck
npm test
npm run build
git diff --check
```

## Trabajo todavía pendiente; no afirmar que ya está hecho

### Prioridad alta: PNG de vistas especializadas

Implementar captura/exportación PNG fiel para matriz, ciclo, Venn, tablero, cronograma, documento y presentación. Debe exportar el contenido visible completo (no solamente `project.nodes`), estar disponible desde cada editor correspondiente y no enviar datos fuera del dispositivo. Si se usa un paquete de captura, probarlo con SVG, tipografías, scroll largo, móvil y el flujo de GitHub Pages. Requisitos mínimos: imagen legible, fondo controlable, nombres de archivo seguros, descarga reproducible y prueba de no desbordamiento/recortes.

### Plugins de usuario

El registro actual admite adaptadores tipados integrados al build y descriptores de metadatos; no carga JavaScript arbitrario. No activar `eval`, `new Function` o importación de código aportado sin una arquitectura de aislamiento real. Diseñar un contrato versionado de parser/exportador, validar tamaño y esquema, ejecutar fuera del contexto principal (idealmente Worker/iframe sandbox con capacidades mínimas), incluir cancelación y límites de tiempo/memoria, y probar entradas maliciosas. Si no se puede garantizar el aislamiento, conservar sólo adaptadores integrados.

### Colaboración opcional Yjs/WebRTC

No añadir señalización ni sincronización automática por defecto. Antes de implementar, definir invitación por proyecto, consentimiento expreso, cifrado de transporte, quién puede editar, resolución de conflictos, caducidad/revocación de peers, qué metadatos salen del dispositivo, y experiencia cuando no hay red. El usuario debe poder seguir usando y exportando el proyecto completamente offline. Requerir dos navegadores/dispositivos reales para pruebas de concurrencia y reconexión.

### Pruebas de accesibilidad en dispositivo y rendimiento

- TalkBack y VoiceOver requieren dispositivos/lectores de pantalla físicos; la auditoría AX de Chromium no los sustituye. Completar navegación, anuncios del estado, selección de elementos, bottom sheets, teclado/gestos y contraste.
- Medir p95 de carga, interacción y desplazamiento para proyectos grandes en teléfonos físicos de gama baja/media; usar corpus representativo y documentar versión del navegador, dispositivo, red y tamaño del proyecto.

## Restricciones de implementación

- Mantener todas las cadenas de interfaz y documentación en español.
- No introducir llamadas remotas de IA sin autorización explícita.
- No declarar accesibilidad móvil ni colaboración concluidas antes de probarlas en dispositivos reales.
- Para cada mejora, añadir pruebas y actualizar `TODO.md` con estado comprobado, no planeado.
