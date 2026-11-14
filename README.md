# FaceCluster: frontend

Interfaz web de FaceCluster, la plataforma que detecta rostros por video en grabaciones
de videovigilancia residencial. Desde aquí se cargan los videos, se revisan los rostros
que entrega el pipeline de visión por computador y se gestionan reportes de incidentes.

Repositorios relacionados: `tesis-plataform-backend` (API) y
`tesis_face_recognition_pipeline` (pipeline y worker).

## Stack

| Componente | Versión |
| --- | --- |
| Angular | 22 (componentes standalone y rutas con carga diferida) |
| TypeScript | 6.0 |
| Node.js | 22 o superior |
| npm | 11 |
| Pruebas | Vitest |

## Ejecución

```bash
npm ci
npm start
```

La aplicación queda en `http://localhost:4200` y se recarga al cambiar el código.

Con Docker:

```bash
docker build -t facecluster-frontend .
docker run --rm -p 4200:4200 facecluster-frontend
```

| Comando | Uso |
| --- | --- |
| `npm start` | Servidor de desarrollo (`ng serve`) |
| `npm run build` | Compilación de producción en `dist/` |
| `npm run watch` | Compilación de desarrollo que se repite con cada cambio |
| `npm test` | Pruebas unitarias |

Las pruebas de este trabajo están en `src/app/core/models/video-job-status.spec.ts` y
`src/app/features/monitor/monitor.spec.ts`. `app.spec.ts` y `shell.spec.ts` son las que
generó Angular CLI y fallan.

## Conexión con el backend

Todas las llamadas HTTP pasan por `ApiService`
(`src/app/core/services/api.service.ts`). La URL base es `http://localhost:8080/api`, así
que el backend debe estar corriendo en la misma máquina. El backend solo admite
peticiones desde `http://localhost:4200`.

## Vistas

| Ruta | Contenido |
| --- | --- |
| `/guards` | Selección del vigilante que inicia la sesión. Es la ruta inicial |
| `/monitor` | Cámaras, carga de videos y videos procesados |
| `/unique-faces` | Rostros detectados, con filtros por fecha, reportes y detecciones marcadas |
| `/reports` | Reportes de incidentes: creación, filtros y cambio de estado |
| `/marked` | Detecciones marcadas y el motivo |

El vigilante activo se guarda en `localStorage` (`SessionService`).

## Carga de videos

La carga se hace desde `/monitor` en tres pasos:

1. `POST /api/videos/upload-url` devuelve una URL prefirmada de S3.
2. El navegador sube el archivo a S3 con `PUT` y muestra el progreso. El bucket debe
   permitir en su configuración CORS las peticiones `PUT` desde el origen del frontend.
3. `POST /api/videos` registra el video en el backend, que lo envía a procesar.

Solo se aceptan archivos de video y hay que elegir la cámara a la que pertenece.

Cada video cargado aparece en `/monitor` con el estado de su trabajo. Mientras el trabajo
no termina, la vista consulta `GET /api/video-jobs/{jobId}` cada 5 segundos.

| Estado del backend | Texto en pantalla |
| --- | --- |
| `UPLOADED` | Registrado |
| `QUEUED` | En cola |
| `PROCESSING` | Procesando |
| `COMPLETED` | Completado |
| `FAILED` | Fallido, con el motivo que envía el backend |
| `QUEUE_ERROR` | No se pudo enviar a la cola |

Cuando el trabajo llega a `COMPLETED`, la vista carga los rostros de ese video: las
apariciones cuyo `faceId` empieza por el `jobId`. La lista de videos se guarda en
`localStorage`.

## Imágenes de rostros

Las imágenes llegan como URL prefirmadas de S3 que expiran y pueden borrarse del bucket.
La directiva `ImageFallbackDirective` oculta la imagen que no carga y muestra en su lugar
el mismo marcador que se usa cuando no hay imagen. El marcador recibe el mismo atributo de
encapsulación que la imagen para que le aplique el CSS del componente.

`timestamp` es la posición del rostro dentro del video, con el formato `00:01:23`.

## Estructura

| Carpeta | Contenido |
| --- | --- |
| `src/app/core/services` | `ApiService` y `SessionService` |
| `src/app/core/models` | Tipos de los datos del backend |
| `src/app/features` | Una carpeta por vista |
| `src/app/layout/shell` | Barra superior y menú lateral |
| `src/app/shared` | Directivas compartidas |
