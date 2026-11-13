/**
 * Scene Variant Art — v2.0.0 (Foundry v13/v14)
 *
 * Cambia rápido el fondo de una escena entre las imágenes/videos de la misma carpeta.
 * - v14: el fondo vive en el Level (Level#background.src); se actualiza el nivel elegido.
 * - v13: se usa Scene#background.src.
 */

const MODULE_ID = "scene-variants";
const MEDIA_EXT = ["png", "jpg", "jpeg", "webp", "gif", "avif", "svg", "mp4", "m4v", "webm"];
const VIDEO_EXT = ["mp4", "m4v", "webm"];

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/* -------------------------------------------- */
/*  Helpers de escena / nivel                   */
/* -------------------------------------------- */

/** ¿Esta versión de Foundry maneja el fondo por Levels (v14+)? */
const usesLevels = scene => !!scene?.levels;

/** Niveles de la escena, ordenados por elevación. */
function getLevels(scene) {
  if (!usesLevels(scene)) return [];
  return Array.from(scene.levels).sort((a, b) =>
    (a.elevation?.bottom ?? 0) - (b.elevation?.bottom ?? 0) || (a.sort ?? 0) - (b.sort ?? 0));
}

/** Nivel por defecto: el que se está viendo (si la escena está en el canvas) o el inicial. */
function getDefaultLevel(scene) {
  if (!usesLevels(scene)) return null;
  if (canvas?.ready && canvas.scene === scene && canvas.level) return canvas.level;
  return scene.initialLevel ?? scene.firstLevel ?? null;
}

/** Fondo actual de una escena/nivel. */
function getBackgroundSrc(scene, level) {
  if (usesLevels(scene)) return level?.background?.src ?? null;
  return scene.background?.src ?? scene.img ?? null;
}

/** Separa "[source] ruta/archivo.png" en { source, dir }. */
function getDirAndSource(filePath) {
  let source = "data";
  let path = filePath;
  const match = filePath.match(/^\[(.*?)\]\s*(.*)/);
  if (match) {
    source = match[1];
    path = match[2];
  }
  if (/^https?:\/\//i.test(path)) return { source: null, dir: null }; // URL externa: no se puede explorar
  try { path = decodeURIComponent(path); } catch (e) { /* ruta ya decodificada */ }
  const lastSlash = path.lastIndexOf("/");
  const dir = lastSlash !== -1 ? path.substring(0, lastSlash + 1) : "";
  return { source, dir };
}

const normalizePath = p => {
  try { return decodeURIComponent(p ?? ""); } catch (e) { return p ?? ""; }
};

/* -------------------------------------------- */
/*  Ventana                                     */
/* -------------------------------------------- */

class SceneVariantSelector extends HandlebarsApplicationMixin(ApplicationV2) {
  constructor(scene, options = {}) {
    // id único por escena: una ventana por escena
    super(foundry.utils.mergeObject(options, { id: `scene-variant-selector-${scene.id}` }));
    this.scene = scene;
    this.levelId = getDefaultLevel(scene)?.id ?? null;
    this.images = null; // se carga en el primer render y cuando cambia el nivel
  }

  static DEFAULT_OPTIONS = {
    classes: ["scene-variants-window"],
    position: { width: 600, height: 500 },
    window: { title: "Scene Variant Art", icon: "fa-solid fa-images", resizable: true },
    actions: { pickVariant: SceneVariantSelector.#onPickVariant }
  };

  static PARTS = {
    content: { template: `modules/${MODULE_ID}/templates/scene-variant-selector.hbs`, scrollable: [".variants-grid"] }
  };

  get title() {
    return `Scene Variant Art — ${this.scene.name}`;
  }

  get level() {
    return usesLevels(this.scene) ? (this.scene.levels.get(this.levelId) ?? getDefaultLevel(this.scene)) : null;
  }

  /** Lista los archivos multimedia de la carpeta del fondo actual. */
  async #loadImages() {
    const bgImage = getBackgroundSrc(this.scene, this.level);
    if (!bgImage) return [];
    const { source, dir } = getDirAndSource(bgImage);
    if (!source || dir === null) return [];
    try {
      const FP = foundry.applications.apps.FilePicker.implementation;
      const result = await FP.browse(source, dir);
      return result.files
        .filter(file => MEDIA_EXT.includes(file.split("?")[0].split(".").pop().toLowerCase()))
        .map(file => {
          const name = normalizePath(file.split("/").pop());
          const ext = name.split(".").pop().toLowerCase();
          return { path: file, name, isVideo: VIDEO_EXT.includes(ext) };
        });
    } catch (err) {
      console.error(`${MODULE_ID} | Error explorando "${dir}":`, err);
      return [];
    }
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    if (this.images === null) this.images = await this.#loadImages();

    const current = normalizePath(getBackgroundSrc(this.scene, this.level));
    const levels = getLevels(this.scene);
    return Object.assign(context, {
      sceneName: this.scene.name,
      images: this.images.map(img => ({ ...img, active: normalizePath(img.path) === current })),
      // Selector de nivel solo si hay más de uno
      levels: levels.length > 1
        ? levels.map(l => ({ id: l.id, name: l.name || l.id, selected: l.id === this.level?.id }))
        : null
    });
  }

  _onRender(context, options) {
    super._onRender?.(context, options);
    const el = this.element;

    // Filtro por nombre: oculta/muestra sin re-renderizar (no pierde el foco del input)
    const search = el.querySelector(".search-filter");
    const applyFilter = () => {
      const q = search.value.toLowerCase();
      let visible = 0;
      for (const item of el.querySelectorAll(".image-variant")) {
        const show = item.dataset.name.toLowerCase().includes(q);
        item.hidden = !show;
        if (show) visible++;
      }
      el.querySelector(".no-matches")?.toggleAttribute("hidden", visible > 0 || !el.querySelector(".image-variant"));
    };
    search?.addEventListener("input", applyFilter);
    if (search?.value) applyFilter();

    // Cambio de nivel
    el.querySelector(".level-select")?.addEventListener("change", async event => {
      this.levelId = event.target.value;
      this.images = null;
      await this.render();
    });
  }

  /** Clic en una variante: cambia el fondo del nivel elegido. */
  static async #onPickVariant(event, target) {
    event.preventDefault();
    const path = target.dataset.path;
    if (!path) return;

    ui.notifications.info(`Cambiando fondo de escena a: ${normalizePath(path).split("/").pop()}`);
    try {
      if (usesLevels(this.scene)) {
        const level = this.level;
        if (!level) throw new Error("La escena no tiene niveles.");
        await this.scene.update({ levels: [{ _id: level.id, "background.src": path }] });
      } else {
        await this.scene.update({ "background.src": path });
      }
    } catch (err) {
      console.error(`${MODULE_ID} | No se pudo cambiar el fondo:`, err);
      ui.notifications.error("Scene Variant Art: no se pudo cambiar el fondo (ver consola).");
      return;
    }

    // Marca la imagen activa sin cerrar ni re-renderizar la ventana
    for (const item of this.element.querySelectorAll(".image-variant")) {
      item.classList.toggle("active", item === target);
    }
  }
}

/** Abre (o trae al frente) la ventana de una escena. */
function openSceneVariantSelector(scene) {
  if (!scene) {
    ui.notifications.warn("No hay ninguna escena disponible.");
    return;
  }
  const appId = `scene-variant-selector-${scene.id}`;
  const existing = foundry.applications.instances.get(appId);
  if (existing) {
    existing.bringToFront();
    return;
  }
  new SceneVariantSelector(scene).render({ force: true });
}

/* -------------------------------------------- */
/*  Hooks                                       */
/* -------------------------------------------- */

// 1) Botón en la cabecera de la pestaña de Escenas (abre la escena activa en el canvas)
Hooks.on("renderSceneDirectory", (app, html) => {
  if (!game.user.isGM) return;
  const element = html instanceof HTMLElement ? html : html[0];
  const actions = element?.querySelector(".header-actions.action-buttons");
  if (!actions || actions.querySelector(".scene-variant-btn")) return;

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "scene-variant-btn";
  btn.innerHTML = '<i class="fa-solid fa-images" inert></i> <span>Arte Variante</span>';
  btn.dataset.tooltip = "Arte Variante de la escena en pantalla";
  btn.addEventListener("click", () => openSceneVariantSelector(canvas.scene));
  actions.appendChild(btn);
});

// 2) Menú contextual (clic derecho): lo dispara tanto el directorio de escenas
//    (data-entry-id) como la barra de navegación de escenas (data-scene-id).
Hooks.on("getSceneContextOptions", (app, menuItems) => {
  menuItems.push({
    label: "Arte Variante",
    icon: "fa-solid fa-images",
    visible: () => game.user.isGM,
    onClick: (event, li) => {
      const sceneId = li?.dataset?.entryId ?? li?.dataset?.sceneId;
      openSceneVariantSelector(game.scenes.get(sceneId));
    }
  });
});

// 3) Botón en el encabezado de la configuración de escena (SceneConfig, ApplicationV2)
Hooks.on("getHeaderControlsSceneConfig", (app, controls) => {
  controls.unshift({
    action: "sceneVariants",
    icon: "fa-solid fa-images",
    label: "Variantes",
    onClick: () => openSceneVariantSelector(app.document)
  });
});

Hooks.once("ready", () => console.log(`${MODULE_ID} | Listo (Foundry ${game.version}).`));
