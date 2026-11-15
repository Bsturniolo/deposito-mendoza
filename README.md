# Depósito Mendoza — Gestión

App para manejar el depósito: **stock por modelo y talle**, ventas, compras con factura, **muestras dejadas a clientes**, gastos e inversión, balance mensual/anual y calendario. Tiene un **chat para cargar todo por mensaje** ("vendí 2 bolt 42 a Juan 85000") que se interpreta en el mismo dispositivo, sin internet y sin costo.

Funciona en Windows (instalador) y en el celular (app web instalable), con la misma base que Gestión del Negocio.

- Versión para el celular: https://bsturniolo.github.io/deposito-mendoza/
- Instalador de Windows: https://github.com/Bsturniolo/deposito-mendoza/releases/latest/download/Deposito-Mendoza-Instalador.exe

## Estructura
- `app/` — la app (HTML/CSS/JS sin framework). Es la misma en la PC y en el celular.
  - `app.js` datos, sincronización, navegación y editor de talles
  - `vistas.js` pantallas y formularios (inicio, stock, ventas, compras, muestras, calendario, gastos, balance, ajustes)
  - `mensaje.js` chat "Cargar por mensaje": interpreta el texto y carga ventas, entradas, salidas, muestras, cobros, gastos y recordatorios
  - `ejemplos.js` datos de ejemplo (se borran con un botón)
- `app/config.js` — configuración de Firebase. Vacía = modo prueba (los datos quedan solo en ese dispositivo).
- `src/cloud.js` — sincronización (Firebase Auth + Firestore). Se empaqueta en `app/cloud.js`.
- `main.js`, `preload.js` — app de escritorio (Electron) con respaldo diario en Documentos.
- `firestore.rules` — todos los usuarios habilitados comparten los datos del negocio.

## Comandos
```
npm install
npm start               # abrir la app de escritorio
npm run build:cloud     # reempaquetar src/cloud.js
npm run dist:win        # instalador de Windows
npx firebase-tools deploy --only firestore:rules
```
Cada push a `main` publica la versión web (GitHub Pages). Cuando cambia la versión en `package.json`, GitHub arma el instalador y lo deja en Releases.

## Conectar la sincronización (una sola vez)
1. Crear un proyecto en https://console.firebase.google.com (plan gratis).
2. **Authentication** → Sign-in method → activar *Correo electrónico/contraseña*. En *Users*, crear un usuario por persona (papá, mamá, Bautista).
3. **Firestore Database** → crear base. En la colección `miembros`, crear un documento por persona cuyo ID sea su email y con el campo `negocio` = `deposito-mendoza`.
4. Publicar las reglas: `npx firebase-tools deploy --only firestore:rules` (o pegar `firestore.rules` en la consola).
5. **Configuración del proyecto** → *Tus apps* → agregar app web y copiar el `firebaseConfig` en `app/config.js` (o pegarlo en la app, en Ajustes → Sincronización).

## Ejemplos de mensajes para el chat
- `vendí 2 bolt 42 a Juan 85000` · `vendí 3 xr 41 a 75 mil c/u por transferencia` · `vendí high boots 43 a Pérez a cuenta`
- `entraron 10 xr 40 y 5 xr 41` · `llegaron bolt 2 del 40 y 3 del 42` · `salieron 2 bolt 44 rotos`
- `dejé muestra high boots 43 a Constructora Andes` · `busqué la muestra de Constructora Andes`
- `me pagó Bodega Los Álamos` · `gasté 20000 de nafta` · `pagué el alquiler 350.000`
- `el lunes a las 10 visitar obra Pérez` · `mañana pagar factura a Ringo 276000`
- Preguntas: `¿cuánto hay de bolt?` · `¿cuánto vendí este mes?` · `¿quién me debe?` · `¿qué muestras hay afuera?`

Si al mensaje le falta algo (por ejemplo el talle), la app abre el formulario ya completado para terminarlo. Todo lo cargado por mensaje se puede deshacer desde el chat.
