# Cooperativa Agro Dashboard (Angular)

Aplicación web para la gestión interna de una cooperativa agrícola. Permite a los equipos administrativos revisar métricas de cosechas, controlar inventario, registrar ventas y generar reportes operativos desde un único panel de control construido con Angular.

El código fuente definitivo vive en el directorio `angular/`, que reemplaza completamente a la antigua app Flutter incluida en este repositorio.

## Características principales

- **Autenticación demo** con persistencia en `localStorage`. Usa:
	- Correo: `innovacode1857@gmail.com`
	- Contraseña: `innovacode`
- **Dashboard** con indicadores resumidos por cultivo y ventas recientes.
- **Gestión de cosechas** con registro rápido de entregas y categorías de calidad.
- **Inventario agrícola** con actualización de existencias y unidades de medida.
- **Alertas y reportes** visuales para monitorear riesgos y desempeño.

Los datos se originan en un `DataService` que expone `BehaviorSubject`s, lo cual facilita reemplazarlo posteriormente por un API real sin modificar la UI.

## Tecnologías

- [Angular 18](https://angular.dev/) con el nuevo builder `@angular/build`
- TypeScript 5.5 y RxJS 7
- ESLint + `@angular-eslint`
- Karma + Jasmine para pruebas unitarias

## Requisitos previos

- Node.js **18 LTS** (o 20 LTS). Versiones superiores como Node 25 no están soportadas por Angular 18.
- npm 9 o superior (incluido con Node LTS).

## Puesta en marcha

```bash
cd angular
npm install
npm start
```

- El servidor de desarrollo corre en `http://localhost:4200/` y hace recarga automática cuando guardas cambios.
- Para detenerlo, usa `Ctrl + C` en la terminal.

## Scripts disponibles

| Comando | Descripción |
| --- | --- |
| `npm start` | Compila en memoria y levanta `ng serve` con live-reload. |
| `npm run build` | Genera la build de producción en `angular/dist/`. |
| `npm run lint` | Ejecuta ESLint con las reglas de `@angular-eslint`. |
| `npm run test` | Corre Karma + Jasmine en modo interactivo. |
| `npm run test -- --watch=false` | Ejecuta los tests una sola vez (ideal para CI). |

## Estructura de carpetas

```
angular/
├── src/
│   ├── app/
│   │   ├── core/           # Servicios, guards y modelos compartidos
│   │   ├── features/       # Funcionalidades: auth, dashboard, harvest, etc.
│   │   └── layout/         # Contenedor principal, navegación y shell
│   ├── assets/             # Íconos, imágenes y recursos estáticos
│   ├── environments/       # Configuración por ambiente (si aplica)
│   └── main.ts             # Bootstrap de la aplicación
├── package.json
├── angular.json
└── ...
```

## Pruebas

Las especificaciones residen junto al código de producción con la convención `*.spec.ts`. Para ejecutar una corrida única (útil en pipelines):

```bash
npm run test -- --watch=false
```

El archivo `src/test.ts` ya está adaptado al nuevo sistema de build (`@angular/build`) para cargar automáticamente todos los specs.

## Buenas prácticas y mantenimiento

- Usa `npm run lint` antes de abrir un PR.
- No ejecutes `npm audit fix --force`, ya que fuerza upgrades mayores de Angular incompatibles con esta versión.
- Cuando actualices Angular, mantén sincronizados `@angular/core`, `@angular/cli`, `@angular-devkit/build-angular` y `@angular/build`.
- Los datos mock se encuentran en `core/services/data.service.ts`; reemplázalos por llamadas HTTP cuando la API esté disponible.

## Despliegue

1. Ejecuta `npm run build` dentro de `angular/`.
2. Sube el contenido de `angular/dist/cooperativa-dashboard/browser` a tu servidor o CDN.
3. Configura el servidor para redirigir cualquier ruta a `index.html` (SPA).

## Licencia

Proyecto interno de la Cooperativa Agro. Ajusta la licencia según tus necesidades antes de hacerlo público.
