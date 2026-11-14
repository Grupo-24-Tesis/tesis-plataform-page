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

Para ejecutar todas las pruebas una sola vez, sin modo de observación:

```bash
npx ng test --watch=false
```

Los archivos `.spec.ts` están junto al código que prueban.

## Conexión con el backend

Todas las llamadas HTTP pasan por `ApiService`
(`src/app/core/services/api.service.ts`). La URL base es `http://localhost:8080/api`, así
que el backend debe estar corriendo en la misma máquina. El backend solo admite
peticiones desde `http://localhost:4200`.

## Vistas

| Ruta | Contenido |
| --- | --- |
| `/guards` | Selección del vigilante activo. Es la ruta inicial |
| `/monitor` | Cámaras, carga de videos, videos procesados y rostros de cada video, con opción de marcarlos |
| `/unique-faces` | Rostros detectados, con filtros por fecha, reportes y detecciones marcadas |
| `/reports` | Reportes de incidentes: creación, filtros y cambio de estado |
| `/marked` | Detecciones marcadas y el motivo |

Todas las rutas salvo `/guards` pasan por `activeGuardGuard`, que redirige a `/guards` si no hay un vigilante activo. El vigilante activo es lo único que se guarda en `localStorage` (`SessionService`). No es un inicio de sesión: ver Limitaciones conocidas.

Las vistas `/unique-faces`, `/marked` y `/reports` muestran estados de carga, de lista vacía y de error, y este último ofrece el botón Reintentar. `/monitor` muestra el error de carga y vuelve a consultar solo con el ciclo de actualización. El formulario de `/reports` valida el título, la descripción y la fecha del incidente, y exige la fecha y la descripción de la resolución cuando el estado es `solucionado`. Las marcas se guardan únicamente en el backend (`/api/marked`); en `/monitor`, un 409 al marcar una detección ya marcada vuelve a cargar la lista de marcas.

## Carga de videos

La carga se hace desde `/monitor` en tres pasos:

1. `POST /api/videos/upload-url` devuelve una URL prefirmada de S3.
2. El navegador sube el archivo a S3 con `PUT` y muestra el progreso real de la subida (`reportProgress` de `HttpClient`). El bucket debe
   permitir en su configuración CORS las peticiones `PUT` desde el origen del frontend.
3. `POST /api/videos` registra el video en el backend, que lo envía a procesar.

Solo se aceptan archivos de video y hay que elegir la cámara a la que pertenece.

`/monitor` carga los videos de la cámara seleccionada desde el backend con `GET /api/video-jobs?cameraId=`; no guarda la lista en el navegador. La vista se actualiza sola: cada 5 segundos mientras algún trabajo está en `UPLOADED`, `QUEUED` o `PROCESSING`, y cada 30 segundos en caso contrario.

| Estado del backend | Texto en pantalla |
| --- | --- |
| `UPLOADED` | Registrado |
| `QUEUED` | En cola |
| `PROCESSING` | Procesando |
| `COMPLETED` | Completado |
| `FAILED` | Fallido, con el motivo que envía el backend |
| `QUEUE_ERROR` | No se pudo enviar a la cola |

Cuando el trabajo está en `COMPLETED`, la vista carga sus rostros con
`GET /api/video-jobs/{jobId}/faces` y muestra la imagen de cada uno. Como las URL
prefirmadas expiran, vuelve a pedir los rostros de un video cuya carga tiene más de 10 minutos.

## Imágenes de rostros

Las imágenes llegan como URL prefirmadas de S3 que expiran y pueden borrarse del bucket. Los textos usan los términos Rostros detectados, Marcados, detecciones y las etiquetas MARCADO y SIN MARCAR. Toda la interfaz usa una sola fuente del sistema.
La directiva `ImageFallbackDirective` oculta la imagen que no carga y muestra en su lugar
el mismo marcador que se usa cuando no hay imagen. El marcador recibe el mismo atributo de
encapsulación que la imagen para que le aplique el CSS del componente.

`timestamp` es la posición del rostro dentro del video, con el formato `00:01:23`.

## Estructura

| Carpeta | Contenido |
| --- | --- |
| `src/app/core/services` | `ApiService`, `SessionService` y `apiErrorMessage`, que lee el campo `message` de los errores `{status, message}` del backend |
| `src/app/core/guards` | `activeGuardGuard` |
| `src/app/core/models` | Tipos de los datos del backend y el texto de cada estado de un trabajo |
| `src/app/features` | Una carpeta por vista |
| `src/app/layout/shell` | Barra superior y menú lateral |
| `src/app/shared` | Directivas compartidas |

## Limitaciones conocidas

- No hay autenticación. La selección del vigilante no es un inicio de sesión, y cualquier cliente que llegue al puerto del backend puede usar la API. El backend publica sus puertos solo en `127.0.0.1`.
- La identidad es por video. El sistema no reconoce a la misma persona en videos distintos y no identifica a las personas.
- La URL del backend (`http://localhost:8080/api`) está fija en `ApiService`.
