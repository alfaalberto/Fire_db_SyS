# Señales y Sistemas — Plataforma Académica

Plataforma para publicar y proyectar las presentaciones interactivas del curso de
Señales y Sistemas (Oppenheim, Willsky y Nawab). Los alumnos consultan el temario
y abren las presentaciones; el docente las sube, las ordena y las proyecta en clase.

- **Next.js 15** (App Router), React 18 y Tailwind, desplegada en **Firebase App Hosting**.
- **Firestore** guarda el curso. Quien solo consulta lee por REST, sin descargar el SDK de Firebase.
- **Firebase Authentication** (Google) identifica al docente; solo él puede escribir.

## Puesta en marcha

Requiere Node 20 o posterior.

```bash
npm ci
npm run dev          # http://localhost:9004
```

Los identificadores del proyecto de Firebase están en `apphosting.yaml` y son los
que usa el código por omisión. Para apuntar a otro proyecto, copia `.env.example`
a `.env.local` y cambia los valores.

| Comando | Qué hace |
| --- | --- |
| `npm run dev` | Servidor de desarrollo |
| `npm run build` / `npm start` | Compilación y servidor de producción |
| `npm run check` | Tipos, ESLint y pruebas unitarias |
| `npm run test:e2e` | Pruebas de extremo a extremo (necesita `npm run build` antes) |

## Acceso del docente (se configura una sola vez)

1. **Consola de Firebase → Authentication → Método de acceso:** habilita **Google**.
   En *Configuración → Dominios autorizados* debe estar el dominio de la plataforma.
2. **Firestore → colección `admins`:** crea un documento cuyo **ID sea el correo del
   docente en minúsculas** (por ejemplo `nombre@ipn.mx`). El contenido no importa.
   Para dar acceso a otra persona, añade otro documento; para quitarlo, bórralo.
3. **Publica las reglas** de `firestore.rules`: pégalas en *Firestore → Reglas* y pulsa
   «Publicar», o ejecuta `firebase deploy --only firestore:rules`.

Con las reglas publicadas cualquiera puede leer el curso y solo las cuentas de
`admins` (con correo verificado) pueden modificarlo. Publícalas cuando esta versión
ya esté desplegada: a partir de ese momento la versión anterior, que escribía sin
identificarse, ya no puede guardar. Las reglas se escribieron para este esquema,
pero conviene probarlas con el simulador de reglas de la consola antes de
confiarles el contenido.

La clave de API de Firebase es pública por diseño. Aun así, en Google Cloud →
*Credenciales* conviene restringirla a los dominios de la plataforma.

## Migrar desde la versión anterior

La versión anterior guardaba todo el curso en un solo paquete (`meta/fullIndex`),
que cada visitante descargaba completo. La actual separa el temario
(`meta/outline`) del contenido de cada tema (`slides/{id}`).

1. En la versión anterior, pulsa «Guardar» y **exporta un respaldo**.
2. Despliega esta versión. Sigue leyendo el formato anterior, así que el curso se
   ve igual desde el primer momento.
3. Configura el acceso del docente y publica las reglas (sección anterior).
4. Entra con la cuenta de docente → menú **Docente → Mantenimiento → «Migrar al
   formato nuevo»**. No borra nada: copia cada tema a su documento y crea el temario.
5. En el mismo cuadro, «Analizar» muestra cuánto ocupa el formato anterior y permite
   borrar primero las copias sobrantes y, ya migrado y con respaldo, todo lo demás.

## Editar el curso

Con sesión de docente aparece **Docente → Modo edición**.

- Los cambios se guardan en un **borrador en este navegador**; los alumnos no ven
  nada hasta pulsar **Publicar**. «Descartar» vuelve a lo publicado.
- **Temario:** arrastrar para reordenar, y el menú «⋯» de cada tema para renombrar,
  añadir subtemas o eliminar. La numeración se actualiza sola.
- **Presentaciones:** subir uno o varios `.html`, arrastrarlos sobre el tema, pegar
  el código, reemplazar, reordenar, descargar o eliminar.
- **Docente → Exportar / Importar respaldo:** un archivo JSON con todo el curso.
- Si dos personas editan a la vez, al publicar se avisa del conflicto en lugar de
  sobrescribir.

En modo edición, cada presentación muestra los avisos de su revisión: texto fuera
del documento (por ejemplo, el guion que lo generó), falta de `<title>`, recursos
`http://`, errores de ejecución, fórmulas que dependen de la plataforma para
convertirse y si se está mostrando reducida porque no cabe a lo ancho.

## Cómo se muestran las presentaciones

Cada presentación es un archivo HTML completo, con sus estilos, su KaTeX y su
navegación. Se muestra **tal cual** dentro de un `iframe` aislado, sin hojas de
estilo ni guiones de la plataforma mezclados con los suyos: lo que se ve al abrir
el archivo en el navegador es lo que ve el alumno.

Lo único que se le añade es un puente (`src/lib/slide-bridge.runtime.js`) que:

- detecta la lámina actual para el indicador «3 / 11»;
- en **modo presentación**, hace que ← / → y RePág / AvPág (el presentador
  inalámbrico) avancen la presentación con su propio mecanismo y, al terminar,
  pasen a la siguiente. `Ctrl` + flecha salta de presentación y `Esc` termina;
- resuelve dentro del documento los enlaces `#ancla`;
- convierte con KaTeX las fórmulas que el archivo deja en crudo (delimitadores que
  su configuración no reconoce, texto añadido después de su único repaso, o KaTeX
  ausente). Una presentación que se convierte sola no se toca;
- mide lo que la presentación necesita y lo que deja libre, para mostrarla al
  tamaño que le conviene (ver más abajo);
- reenvía los errores de ejecución, que el docente ve en modo edición.

Entrar o salir del modo presentación no recarga la presentación ni pierde la lámina.

Los fragmentos sueltos (`<h1>…</h1><p>…</p>`, sin `<html>`) reciben una plantilla
de la plataforma con tipografía, tema claro u oscuro y KaTeX local.

### Tamaño con el que se muestran

La presentación se dibuja con el tamaño que le conviene y se escala hasta ocupar
el marco que le deja la plataforma. El puente mide y `src/lib/deck-fit.ts` decide:

- **No cabe a lo ancho** (una barra de botones en el teléfono): se dibuja con el
  ancho que necesita y se reduce hasta caber, con un mínimo del 60 %.
- **Queda pequeña** (una columna de 1200 px o una lámina 16:9 de medidas fijas en
  una pantalla de 1920): se amplía hasta aprovechar el marco. Solo consume el
  espacio que la presentación deja vacío: nunca hace que algo deje de caber ni
  obliga a desplazarse donde antes no hacía falta. Cuenta con su lámina más alta,
  así que el tamaño es el mismo en todas, y se recalcula al instante al cambiar la
  ventana o al entrar en modo presentación, sin recargar nada.

No se amplían las que ya ocupan la pantalla, las que se leen desplazándolas ni
aquellas cuyos márgenes dependen de la ventana (un `80vw`): en esas no hay nada
que aprovechar. Tampoco en marcos de menos de unos 1350 px de ancho, porque a una
presentación nunca se le da una ventana menor de 1280 px, la de un portátil; por
debajo cambiaría a su disposición de tableta.

Lo aprendido de cada presentación se recuerda en el navegador durante tres
semanas (`sys.tamanos` en `localStorage`), para que la siguiente vez aparezca ya
a su tamaño. Quien prefiera verla a tamaño real lo elige en «Más opciones».

### Recomendaciones para los archivos

- Empezar por `<!DOCTYPE html>` e incluir `<title>`: es el nombre de la pestaña.
- Subir el archivo `.html`, no el guion que lo genera.
- Cargar los recursos por `https://`.
- Si se usan `\(…\)` o `$…$`, declarar esos delimitadores en la llamada a
  `renderMathInElement`; en una cadena de JavaScript se escriben `'\\('` y `'\\)'`.
- No depender de `localStorage`: dentro del `iframe` aislado no está disponible.

## Seguridad

- El `iframe` usa `sandbox` **sin** `allow-same-origin`: el código de una
  presentación no puede leer la sesión del docente, el almacenamiento ni la página
  de la plataforma.
- Solo se escribe en Firestore con una sesión de `admins`; las reglas rechazan lo demás.
- `NEXT_PUBLIC_TRUST_SLIDES=false` quita los guiones de las presentaciones antes de
  mostrarlas (pierden su interactividad), por si alguna vez se publica contenido ajeno.

## Estructura

```
src/app/                  Página, tipografías y estilos globales
src/components/           Interfaz: temario, visor, modo presentación, edición
src/components/admin/     Menú del docente, editor de HTML y mantenimiento
src/hooks/                Estado del curso, sesión y ruta (#/t/<tema>/<n>)
src/lib/data/             Lectura por REST, caché en IndexedDB y almacén del curso
src/lib/admin/            Sesión de Google y publicación (carga diferida)
src/lib/slide-*.ts|js     Documento que recibe el iframe y puente
src/lib/deck-fit.ts       Tamaño con el que se muestra cada presentación
src/lib/tree.ts           Operaciones sobre el temario
e2e/                      Pruebas de extremo a extremo
firestore.rules           Reglas de acceso
public/katex/             KaTeX servido por la plataforma
```

## Pruebas

- `npm test`: pruebas unitarias (Vitest) de temario, formato de datos, publicación,
  construcción del documento y ajuste de tamaño.
- `npm run test:e2e`: Playwright contra `next start`, con Firestore y la sesión
  simulados en memoria; nunca tocan la base de datos real. Cubren la lectura, el
  modo presentación, la edición y publicación, la migración, el teléfono, las
  fórmulas en crudo y el ajuste de tamaño (reducir lo que no cabe y ampliar lo
  que queda pequeño).
