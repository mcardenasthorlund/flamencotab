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

---

## ✨ Características

- **Editor de tablaturas** de 6 cuerdas con entrada rápida de trastes (0–24 y `X`).
- **Notación flamenca**:
  - Compás `|` y doble compás `||`.
  - Rasgueos (abanico, pulgar, alzapúa), golpe, flechas de dirección.
  - Ligaduras (slur) y **trémolo** (una nota repetida 4 veces).
- **Tandas de líneas (`lineSets`)**: añade, duplica, reordena y elimina tandas dentro de cada bloque.
- **Bloques**: reordenables, duplicables y con título editable por bloque.
- **Librería de acordes flamencos** en nomenclatura española (DO, RE, MI, FA, SOL, LA, SI) con posturas para palos típicos (Bulerías, Soleá, Tangos…) y acordes personalizados.
- **Importación de acordes** desde la librería a una columna seleccionada.
- **Autoguardado** con debounce (~500 ms), sin necesidad de botón de guardado.
- **Exportación / importación**: JSON y **PDF** (vía `html2canvas` + `jsPDF`).
- **Impresión** rediseñada: modal con orientación (vertical/apaisado), opción de mostrar título, palo/tonalidad y autor, y **pie de página con el nombre de la tablatura y el número de página** (`X / Y`) en Times New Roman.
- **PDF ligero y rápido**: imágenes comprimidas en JPEG de alta calidad (antes PNG, PDFs mucho más pequeños y rápidos de generar).
- **PWA con actualizaciones automáticas**: el service worker se registra al instante, comprueba actualizaciones en internet al arrancar, cada 30 s y al volver a la pestaña; descarga nuevas versiones automáticamente y **avisa con una ventana** de "Nueva versión disponible".
- **Responsive**: móvil (dial táctil de trastes), tablet y escritorio (teclado y flechas).
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
│   └── tab-list/          # Listado y gestión de tablaturas
├── shared/
│   ├── components/        # Header, footer, diálogos
│   ├── directives/        # Gestos táctiles
│   └── utils/             # Utilidades (arrays, archivos, render)
├── app.ts                 # Componente raíz
└── app.routes.ts          # Rutas (lazy-loading)
```

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

---

## 🖥️ Rutas

| Ruta | Vista |
| :--- | :--- |
| `/` → `/editor` | Editor de tablaturas |
| `/editor/:id` | Editor de una tablatura concreta |
| `/tabs` | Listado de tablaturas |
| `/library` | Biblioteca de acordes |

---

## 📄 Licencia

Proyecto privado / de uso personal. Distribución y uso según los términos establecidos por el autor.