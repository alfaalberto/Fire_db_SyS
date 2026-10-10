/**
 * Árbol completo con el HTML incrustado. Es el formato de los respaldos
 * (Exportar/Importar) y del documento heredado `meta/fullIndex`.
 */
export interface IndexItem {
  id: string;
  title: string;
  children?: IndexItem[];
  content?: string[] | null;
  parentId?: string;
}

/** Metadatos de una presentación (un archivo HTML) dentro de un tema. */
export interface DeckMeta {
  /** Título tomado del `<title>` del archivo. */
  title: string;
  /** Tamaño del HTML en bytes UTF-8. */
  bytes: number;
}

/**
 * Nodo del temario SIN el HTML. Es lo único que se descarga al abrir la app;
 * el contenido de cada tema se pide por separado cuando se selecciona.
 */
export interface OutlineItem {
  id: string;
  title: string;
  children?: OutlineItem[];
  /** Presentaciones del tema, en orden. Ausente o vacío = tema sin contenido. */
  decks?: DeckMeta[];
  /** Revisión del contenido; cambia cada vez que se publica el tema. */
  rev?: number;
}

/** Posición dentro del curso: un tema y una de sus presentaciones. */
export interface CoursePosition {
  topicId: string;
  deck: number;
}
