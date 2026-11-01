# Glyphind

Glyphind es un espacio local-first para crear y ordenar proyectos de diagramas. La interfaz está inspirada en una biblioteca de proyectos limpia y silenciosa, con editor de lienzo, tipos extensibles y acciones rápidas.

La aplicación publicada está disponible en [Glyphind en GitHub Pages](https://innovamotivatechmasalladelosli-blip.github.io/glyphind/). La versión pública se sirve desde la compilación estática incluida en `main`.

## Principios

- **Sin hosting ni base de datos:** todos los proyectos se guardan en `localStorage` del navegador.
- **Sin cuentas:** funciona directamente en el dispositivo y no requiere autenticación.
- **Tipos extensibles:** Flujo, Pendientes, Equipo, Comunidad y Mapa mental se definen desde un catálogo común.
- **Responsive:** el panel de proyectos y el editor se adaptan a pantallas pequeñas.

## Desarrollo local

```bash
npm install
npm run dev
```

La aplicación se sirve en `http://localhost:3000`. Para generar una compilación de producción:

```bash
npm run build
```
