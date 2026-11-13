# Scene Variant Art

Módulo para Foundry VTT que permite cambiar rápidamente el fondo de una escena entre las imágenes/videos que están en la **misma carpeta** que el fondo actual.

- Compatible con **Foundry v13 y v14** (verificado contra el código de v14 build 369).
- En v14 actualiza el fondo del **Level** (`Level#background.src`); si la escena tiene varios niveles aparece un selector.
- Formatos: png, jpg, jpeg, webp, gif, avif, svg, mp4, m4v, webm.

## Uso

Abre la ventana de variantes desde cualquiera de estos puntos (solo GM):

1. Botón **Arte Variante** en la cabecera de la pestaña *Escenas* (escena en pantalla).
2. Clic derecho sobre una escena (directorio o barra de navegación) → **Arte Variante**.
3. Botón **Variantes** en el encabezado de la configuración de escena.

Haz clic en una miniatura para aplicarla como fondo; el cuadro de búsqueda filtra por nombre de archivo.

## Instalación

Copia esta carpeta en `Data/modules/scene-variants` o usa la URL del manifest:

```
https://github.com/DeadlyPoisonK/Scene-Variant-Art/releases/latest/download/module.json
```

## Cambios

### 2.0.0
- Migrado de `Application` (V1) a `ApplicationV2` + Handlebars (`.hbs`).
- Fondo por **Levels** (v14); en v14 `Scene#background` está deprecado y `scene.update({"background.src"})` ya no cambia el fondo.
- Hooks actualizados: `getSceneContextOptions`, `getHeaderControlsSceneConfig`.
- `FilePicker` desde `foundry.applications.apps`.
- Filtro sin re-render, resaltado de la variante activa, soporte de rutas con espacios (`%20`).
- Eliminado el botón de la barra izquierda (el control `scenes` ya no existe desde v13).

## Licencia

MIT
