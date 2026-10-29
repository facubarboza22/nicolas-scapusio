# Marca: copérnico

Propuesta del 2026-10-27. Nada de esto está aprobado todavía por Nicolás.

## Nombre

**copérnico**: Copérnico (el que puso el Sol en el centro y cambió cómo se miraba todo) + **Nico**, el profe. Todo en minúscula: "copér" en azul marino y "nico" en azul birome, así el juego se lee sin explicarlo y sin mayúsculas (pedido de Facundo, 2026-10-27).

- Ícono: el Sol (amarillo resaltador, sin rayos, 2026-10-27) y un planeta rojo en su órbita. Es la idea de Copérnico dibujada como en un pizarrón.
- Archivos: [`docs/marca/logo.png`](marca/logo.png) (sobre papel y sobre marino) y [`docs/marca/foto-de-perfil.png`](marca/foto-de-perfil.png) (1080×1080, Instagram la recorta en círculo).
- El logo de los posts sale de `orbit` y `logo()` en `scripts/render/slide.html`: si se cambia ahí, cambia en todo.

- Usuario de Instagram: **@copernico.clases** (cuenta creada por Facundo el 2026-10-27).
- Nombre visible del perfil: `Lic. Nicolas Scapusio` (lo eligió Facundo).
- Foto de perfil: por ahora el logo (`docs/marca/foto-de-perfil.png`, subido el 2026-10-27). Se reemplaza por una foto de Nicolás cuando la haya: el que contrata clases elige a una persona.
- Bio (cargada el 2026-10-27):

  ```
  Matemática y Física, paso a paso 🪐
  Un ejercicio nuevo cada semana
  Clases particulares: escribime por mensaje 📩
  ```

## Idea visual: el cuaderno

El cuaderno cuadriculado es lo que cualquier estudiante tiene abierto cuando no entiende un ejercicio. La cuenta se ve como ese cuaderno, corregido por un profe que explica bien.

| Elemento | Qué es | Color |
|---|---|---|
| Papel | Hoja cuadriculada (cuadros de 54 px) con margen rojo | `#f8f5ee`, cuadrícula `#cddcee`, margen `#e8a39b` |
| Tinta | Texto principal | Azul marino `#1c2a4a` |
| Birome | Detalles, "nico", notas a mano | Azul `#2a5bd7` |
| Resaltador | Marca lo que hay que mirar primero | Amarillo `#ffe14d` |
| Corrección | Círculos, tachados, ✓ y ✗ | Rojo `#d8443a` |
| Pizarrón | Placas de color (portada, cierre) | Marino `#1c2a4a` con cuadrícula clara |

Física usa el mismo cuaderno con naranja `#ef7b2d` en lugar del azul birome (`"theme": "fisica"` en `slides.json`), para que se distinga de un vistazo qué materia es.

## Letras

- **Bricolage Grotesque**: títulos y cuentas. Gruesa, joven, números grandes y claros.
- **Atkinson Hyperlegible**: textos. Fue diseñada para que se lea bien, que es justo lo que pedimos de un profe.
- **Kalam**: las notas "a mano" del profe (como escritas con birome).

Todas son de Google Fonts, gratis.

## La voz

- El profe Nico habla en primera persona, con voseo uruguayo, como en una clase particular: directo, con paciencia, sin hacer sentir mal a nadie por equivocarse.
- El error es parte del contenido: "si te dio 20, hiciste la suma primero" explica el error, no se burla.
- Toda cuenta, fórmula y unidad se verifica antes de publicar (se calcula, no se escribe de memoria).
- Pendiente: `docs/escritura.md` con las reglas completas, cuando Nicolás confirme el tono.

## Formatos

| Formato | Para qué | Ritmo propuesto |
|---|---|---|
| Reel "pregunta rápida" | Gente nueva: un ejercicio que parece fácil, el error típico, la solución y un desafío para comentar | 2 por semana |
| Carrusel "paso a paso" | Que guarden el post: un tema explicado en 5 placas | 1 por semana |
| Historias | Encuestas ("¿cuánto da?"), respuesta al desafío del reel, recordatorio de clases | Varias por semana (a mano, el publicador todavía no sube historias) |

Cada reel termina con dos invitaciones: **seguir la cuenta** (un ejercicio nuevo cada semana) y, más chico, **clases particulares por mensaje directo**.
