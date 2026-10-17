# Bluumxsic · SP-Control (móvil)

App para el teléfono (Android y iPhone) con lo mismo que la de Windows: clientes con estados de pago por color,
planes familiares (administrador + 5), movimientos con calendario, tasa BCV, comprobante de pago obligatorio,
temas, modo cristal (Liquid Glass), Ajustes y respaldo `.json`. Es una **app web instalable (PWA)**:
no pasa por tiendas de apps y funciona sin internet una vez abierta.

## 1. Ponerla en internet (una sola vez)

Los teléfonos solo instalan una app web desde una dirección segura (https). Sube **el contenido de esta carpeta**
a cualquiera de estos servicios gratuitos:

- **Netlify**: entra a `app.netlify.com/drop` y arrastra la carpeta completa. Te da una dirección `https://….netlify.app`.
- **Cloudflare Pages** o **GitHub Pages**: crea un proyecto nuevo y sube los archivos tal cual (no necesita compilar nada).

Tus datos **no se suben**: se guardan solo en el teléfono. La dirección solo sirve para descargar la app.

## 2. Instalarla en el teléfono

- **Android (Chrome):** abre la dirección › menú ⋮ › **Instalar aplicación**. (También hay un botón en *Más › Instalar la app*.)
- **iPhone (Safari):** abre la dirección › botón Compartir › **Agregar a pantalla de inicio**.

## 3. Pasar datos entre la PC y el teléfono

Usa el mismo archivo de respaldo en los dos sentidos:

- **PC → teléfono:** en la app de Windows, *Respaldo › Exportar*. Pasa el `.json` al teléfono (WhatsApp, correo, nube, USB)
  y en el teléfono: *Más › Respaldo y comprobantes › Importar respaldo*.
- **Teléfono → PC:** *Más › Respaldo › Guardar / compartir respaldo* y en Windows *Respaldo › Importar*.

El respaldo incluye clientes, planes, movimientos y las fotos de los comprobantes. Los ajustes visuales (tema, cristal, fuente)
son de cada aparato y no se pisan.

## Cosas que conviene saber

- **Avisos de pago:** una app web no puede despertarse sola si está cerrada. Los avisos salen al abrirla (una vez al día,
  pasada la hora que elijas) y siempre ves el resumen en la pantalla *Resumen*. En Android con la app instalada, el sistema
  puede revisarla de vez en cuando. En iPhone las notificaciones del sistema solo funcionan con la app en la pantalla de inicio.
  Activa los permisos en *Más › Avisos de pago*.
- **Tasa BCV:** se consulta a DolarApi (tasa oficial). Un navegador no puede leer bcv.org.ve directamente, y si no hay
  internet la puedes escribir a mano tocando el recuadro de la tasa.
- **Copia de seguridad:** si el teléfono se pierde o borras los datos del navegador, se pierde lo guardado. Haz un respaldo de vez en cuando.
- **Comprobantes:** las fotos se reducen automáticamente (máx. 1800 px) para que el respaldo no pese demasiado.
  Se guardan como `2026-10 Octubre.jpg`, en una carpeta por cliente (y `_Planes/` para los administradores);
  se ven y comparten desde *Comprobantes*.

## Actualizar la app

Cuando cambies archivos, sube la carpeta otra vez y sube el número `VERSION` en `sw.js` (por ejemplo `bluumxsic-v1.5`) y `B.VERSION` en `js/util.js` (mismo número); en Más › Versión verás si quedó al día
para que los teléfonos descarguen la versión nueva.

## Probarla en tu PC antes de subirla

Con Python instalado: abre una terminal en esta carpeta y ejecuta `python -m http.server 8080`, luego entra a
`http://localhost:8080` en Chrome. (En el teléfono solo funciona desde una dirección https.)

## Versión 1.6
- Clientes con varias cuentas: casilla «Cada cuenta con su propia fecha de pago». El monto es por cuenta, cada cuenta tiene su fecha y se paga una por una (✔ Pagó en cada cuenta). El color del cliente sigue la fecha más próxima. Compatible con la app de PC v2.3.

## Versión 1.7 — Contraseña para el respaldo
- Al exportar, la app pregunta si quieres ponerle contraseña (mínimo 4 caracteres, con confirmación) o guardarlo sin ella.
- Con contraseña el archivo es `.bluumxsic` (cifrado AES-256-GCM). Sin contraseña sigue siendo `.zip`.
- Al importar un `.bluumxsic` se pide la contraseña; si te equivocas puedes reintentar.
- Es el mismo formato que la app de PC (v2.4): lo que protegas en un lado se abre en el otro.
- **Si olvidas la contraseña no hay forma de recuperar el respaldo.**
- El cifrado necesita que la app se abra por https (GitHub Pages lo cumple).
- Al actualizar, abre la app y revisa que abajo diga «Versión 1.7».

## Versión 1.8 — Mensaje de carga al importar
- Al elegir un respaldo aparece una pantalla con ruedita: «Archivo recibido» (con nombre y tamaño), «Leyendo el respaldo…» y «Importando…».
- Si el teléfono no entrega ningún archivo, ahora lo avisa en vez de quedarse callado.
- Si no ves ni «Archivo recibido», el teléfono no está pasando el archivo a la app: prueba elegirlo desde «Descargas»/«Archivos» y no desde la galería.

## Versión 1.9 — Movimientos, comprobantes y respaldo obligatorio con contraseña
- **Movimientos rediseñados:** cada movimiento tiene ahora una fila de botones propia («Comprobante» y «Eliminar») con espacio libre a la derecha, para que el botón ＋ flotante ya no choque con ellos.
- **Eliminar comprobantes:** al abrir una foto aparece «Eliminar». En «Ver todos los comprobantes» también salen las fotos sueltas sin registro (por ejemplo, pruebas de versiones viejas) para poder borrarlas. El movimiento que usaba la foto se queda, solo sin imagen.
- **Respaldo siempre con contraseña:** ya no existe «Sin contraseña» (mínimo 6 caracteres). Los respaldos antiguos .zip y .json se siguen importando.

## Versión 2.0 — Nombre fijo
- La app se llama **SP-Control** con el subtítulo **Allen.Inc (Ai)** (cabecera, título de la pestaña, nombre al instalarla y avisos).
- Se quitó la sección «Nombre y logo» de Más → Ajustes.
- Al actualizar, es posible que el teléfono siga mostrando el nombre anterior en el icono de la pantalla de inicio: si quieres que cambie, desinstala el acceso directo e instálala de nuevo (los datos no se pierden al reinstalar solo el acceso directo, pero haz antes un respaldo por seguridad).
