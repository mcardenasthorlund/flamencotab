# FlamencoTab 🎸

<p align="center">
  <img src="flamenco-tab-pwa/public/icons/icon-192x192.png" width="120" alt="FlamencoTab" />
</p>

<p align="center">
  <strong>Editor de tablaturas de guitarra flamenca como PWA</strong> · sin backend · datos en local
  <br />
  ▶️ <a href="https://appflamencotab.ideasypruebas2.es">Probar la aplicación</a>
</p>

Editor de tablaturas de **guitarra flamenca** como **PWA**, sin backend y con todos los datos guardados en local.

Aplicación web progresiva (PWA) para crear, editar y guardar tablaturas de guitarra flamenca con notación específica del flamenco: rasgueos, alzapúa, golpes, ligaduras, compases y trémolo. Funciona sin conexión y se puede instalar en cualquier dispositivo.

> 🎯 **Filosofía:** sin cuentas, sin servidores, sin bases de datos remotas. Tu música vive en tu dispositivo (LocalStorage) y puedes exportarla/importarla como JSON.

> 🏷️ **Versión actual:** `0.6-beta`

---

## ✨ Características

- **Editor de tablaturas** de 6 cuerdas con entrada rápida de trastes (0–24 y `X`).
- **Notación flamenca**:
  - Compás `|` y doble compás `||`.
  - Rasgueos (abanico, pulgar, alzapúa), golpe, flechas de dirección.
  - Ligaduras (slur) y **trémolo** (una nota repetida 4 veces).
- **Tandas de líneas (`lineSets`)**: añade, duplica, reordena y elimina tandas dentro de cada bloque.
- **Ancho fijo de tanda (1340 px)**: al añadir o quitar columnas, el ancho total se mantiene constante (las notas se compactan o separan); cada tanda tiene su propia barra de scroll horizontal en pantallas estrechas.
- **Insertar / eliminar columnas desde la línea activa**: en la tanda de líneas que tiene la celda seleccionada, unos iconos permiten **insertar una columna antes o después** de la columna seleccionada y **eliminar esa columna** (con diálogo de confirmación). Solo se muestran en la línea activa.
- **Espaciado de ornamentos**: los ornamentos se dibujan a la derecha de la nota con una **separación fija** entre ellos y respecto a la nota. La columna se ensancha **solo lo necesario** para contenerlos, de modo que nunca se solapan con la columna siguiente y el espaciado de la izquierda no se altera.
- **Bloques**: reordenables, duplicables, con título editable por bloque y **colapsables/expandibles**.
- **Librería de acordes flamencos** en nomenclatura española (DO, RE, MI, FA, SOL, LA, SI) con posturas para palos típicos (Bulerías, Soleá, Tangos…) y acordes personalizados.
- **Importación de acordes** desde la librería a una columna seleccionada (botón "Acorde" en la barra de ornamentos).
- **Barra de ornamentos anclada** al top: permanece visible al hacer scroll, con tamaños de botones uniformes.
- **Autoguardado** con debounce (~500 ms), sin necesidad de botón de guardado.
- **Exportación / importación**: JSON y **PDF** (vía `html2canvas` + `jsPDF`).
- **Impresión** rediseñada: modal con orientación (vertical/apaisado), opción de mostrar título, palo/tonalidad y autor, y **pie de página con el nombre de la tablatura y el número de página** (`X / Y`) en Times New Roman.
- **PDF ligero y rápido**: imágenes comprimidas en JPEG de alta calidad (antes PNG, PDFs mucho más pequeños y rápidos de generar).
- **PWA con actualizaciones automáticas**: el service worker se registra al instante, comprueba actualizaciones en internet al arrancar, cada 30 s y al volver a la pestaña; descarga nuevas versiones automáticamente y **avisa con una ventana** de "Nueva versión disponible".
- **Responsive**: móvil (panel de notas con **desplazamiento horizontal** hasta ambos extremos y botón "Borrar" mostrado como **icono**; botones de la barra y ornamentos con solo icono), tablet y escritorio (teclado y flechas).
- **Panel de notas fijo**: un check "Panel de notas" permite forzar la visibilidad del dial de trastes en cualquier dispositivo (preferencia persistida en `localStorage`).
- **Sección de ayuda** (`/help`): guía de uso completa dentro de la app, con el catálogo de ornamentos, los atajos de teclado, la gestión de acordes y la exportación/impresión, ilustrada con diagramas SVG.
- **Solo en español**, tema claro con acento de marca azul `#2563EB`.

---

## 🛠️ Stack tecnológico

| Tecnología | Uso |
| :--- | :--- |
| [Angular](https://angular.dev) (22.x, standalone) | Framework principal |
| TypeScript | Lenguaje |
| RxJS | Reactividad y streams |
| SCSS | Estilos (sin librerías de UI de terceros) |
| LocalStorage | Persistencia local |
| Angular Service Worker | Funcionamiento offline y PWA |
| `html2canvas` + `jsPDF` | Exportación a PDF/imagen |

**Sin backend.** Todos los datos se almacenan localmente en el navegador bajo claves con prefijo `flamenco_*`.

---

## 📁 Estructura del proyecto

```text
src/app/
├── core/
│   ├── models/            # Modelos de datos (tab, chord, ornament)
│   ├── services/          # TabStorage, ChordLibrary, PwaUpdate
│   └── constants/         # Constantes (guitarra, ornamentos, notas, versión)
├── features/
│   ├── tab-editor/        # Editor (canvas, cuerdas, ornamentos, acordes, impresión)
│   ├── chord-library/     # Biblioteca de acordes (tarjetas + formulario)
│   ├── tab-list/          # Listado y gestión de tablaturas
│   └── help/              # Guía de uso (página de ayuda)
├── shared/
│   ├── components/        # Header, footer, diálogos
│   ├── directives/        # Gestos táctiles
│   └── utils/             # Utilidades (arrays, archivos, render)
├── app.ts                 # Componente raíz
└── app.routes.ts          # Rutas (lazy-loading)
```

> Los recursos estáticos (iconos PWA y las ilustraciones de la guía) viven en `public/` y se sirven desde la raíz; las imágenes de la ayuda están en `public/assets/help/`.

---

## 🚀 Instalación y desarrollo

Requisitos: **Node.js 24+** y **npm 12+**.

```bash
# 1. Instalar dependencias
npm install

# 2. Servidor de desarrollo
npm start            # o: ng serve

# 3. Abrir en el navegador
#    http://localhost:4200
```

---

## 📦 Build de producción

```bash
npm run build        # o: ng build
```

El resultado se genera en `dist/flamenco-tab-pwa/`. Para servir el build con soporte PWA es necesario un servidor estático con **fallback a `index.html`** para las rutas SPA (p. ej. `/editor/...`).

```bash
npx http-server dist/flamenco-tab-pwa -p 8080
```

---

## 🧪 Tests

```bash
npm test             # o: ng test
```

---

## 🗂️ Persistencia (LocalStorage)

| Clave | Contenido |
| :--- | :--- |
| `flamenco_tabs_index` | IDs de todas las tablaturas |
| `flamenco_tab_{id}` | Contenido de cada tablatura (JSON) |
| `flamenco_custom_chords` | Acordes creados por el usuario |
| `flamenco_active_tab_id` | Última tablatura editada (restauración de sesión) |
| `flamenco_show_fret_dial` | Preferencia de mostrar siempre el panel de trastes |

---

## 🖥️ Rutas

| Ruta | Vista |
| :--- | :--- |
| `/` → `/tabs` | Redirige al listado de tablaturas |
| `/tabs` | Listado de tablaturas |
| `/editor` | Editor (nueva tablatura o la última editada) |
| `/editor/:id` | Editor de una tablatura concreta |
| `/library` | Biblioteca de acordes |
| `/help` | Guía de uso |

---

## 📖 Guía de uso

La aplicación incluye una guía completa en la ruta `/help`, accesible desde el enlace **Ayuda** de la cabecera. Cubre:

- Primeros pasos y estructura de la aplicación.
- El editor: barra superior, bloques, tandas de líneas y columnas.
- Introducción de notas y panel de notas.
- Ornamentos flamencos (catálogo, ligaduras y trémolo).
- Gestión de acordes.
- Exportación, importación e impresión.
- Instalación como PWA, datos locales y atajos de teclado.

Las ilustraciones de la guía son diagramas SVG ubicados en `public/assets/help/`.

---

## 📄 Licencia

Proyecto privado / de uso personal. Distribución y uso según los términos establecidos por el autor.