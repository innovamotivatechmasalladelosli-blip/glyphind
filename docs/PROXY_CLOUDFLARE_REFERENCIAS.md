# Referencias técnicas del proxy opcional de URL

Fuentes oficiales consultadas el 10 de noviembre de 2026 para el Worker de Glyphind:

- **Carga de Workers por API**: [Infrastructure as code — Cloudflare Workers](https://developers.cloudflare.com/workers/platform/infrastructure-as-code/). Cloudflare documenta la carga modular mediante `PUT /accounts/{account_id}/workers/scripts/{script_name}` con `multipart/form-data`; la API de multipart crea una versión y despliegue al subir el script.
- **Subdominio `workers.dev`**: [Workers.dev — Cloudflare Workers](https://developers.cloudflare.com/workers/configuration/routing/workers-dev/). El host de un script sigue el patrón `<nombre-del-worker>.<subdominio-de-la-cuenta>.workers.dev`; la cuenta de Glyphind ya tiene un subdominio activo.
- **Limitación de tasa en Workers**: [Rate Limiting bindings](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/). Los límites nativos aceptan periodos de 10 o 60 segundos y son aproximados, locales a cada ubicación de Cloudflare y eventualmente consistentes. Una clave basada en IP puede agrupar usuarios que comparten redes móviles o NAT; se usará sólo como mitigación de abuso, no como autenticación.
- **Solicitudes externas desde Workers**: [Fetch API — Cloudflare Workers](https://developers.cloudflare.com/workers/runtime-apis/fetch/). El Worker puede obtener recursos HTTP desde su entorno de servidor. La app debe validar el destino y no reenviar cookies, credenciales ni cabeceras arbitrarias del navegador.
- **Límites generales**: [Limits — Cloudflare Workers](https://developers.cloudflare.com/workers/platform/limits/). El servicio está sujeto a límites y consumo de la cuenta Cloudflare. El Worker no guardará HTML en D1/KV/R2 ni escribirá contenido a logs propios.

## Decisiones de privacidad y seguridad

La lectura directa del navegador sigue siendo la primera opción. El proxy sólo se invoca después de un consentimiento explícito para esa solicitud y muestra el dominio/URL que se enviará. Sólo viaja la URL al Worker; el Worker obtiene HTML/texto y lo devuelve al navegador. El análisis semántico continúa local. El Worker no conserva contenido. Cloudflare y el sitio de destino procesan la solicitud para poder atenderla; no deben usarse URLs con tokens de acceso ni fuentes privadas.

El endpoint tendrá un único método de lectura, un origen CORS exacto, tamaño y tiempo máximos, contenido textual solamente, sin cabeceras/cookies heredadas, sin almacenamiento y con limitación de uso. Las direcciones locales/privadas y redirecciones se deben rechazar. CORS limita el uso desde navegadores ajenos, pero no es por sí solo autenticación contra clientes HTTP automatizados; la limitación de uso es una mitigación aproximada.

- **Acceso a redes privadas desde Workers**: [VPC Networks](https://developers.cloudflare.com/workers-vpc/configuration/vpc-networks/). Cloudflare documenta el acceso a servicios privados mediante bindings a Tunnel/Mesh/VPC; la documentación consultada no afirma que una consulta DNS previa fije la IP usada después por un `fetch()` global.

## Riesgo residual de DNS

El Worker verifica A/AAAA contra el endpoint DNS-over-HTTPS de Cloudflare `https://cloudflare-dns.com/dns-query`, bloquea respuestas privadas/especiales y no sigue redirecciones. Esto reduce la superficie, pero no fija la IP validada al socket que abre `fetch()`; un dominio con DNS controlado podría intentar rebinding entre verificación y conexión. Si se exige eliminar ese riesgo, se necesita una lista permitida de dominios controlada por el proyecto o un egress que permita fijar el destino. El endpoint no tiene binding VPC y no usa redes privadas; no se debe describir la comprobación DNS como garantía absoluta.
