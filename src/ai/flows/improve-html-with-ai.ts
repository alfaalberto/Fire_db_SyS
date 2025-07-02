
// src/ai/flows/improve-html-with-ai.ts
'use server';

/**
 * @fileOverview This file defines a Genkit flow to improve HTML content using AI.
 *
 * - improveHtmlWithAI - A function that takes HTML content as input and returns improved HTML.
 * - ImproveHtmlWithAIInput - The input type for the improveHtmlWithAI function.
 * - ImproveHtmlWithAIOutput - The return type for the improveHtmlWithAI function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const ImproveHtmlWithAIInputSchema = z.object({
  htmlContent: z
    .string()
    .describe('The HTML content to be improved.'),
});
export type ImproveHtmlWithAIInput = z.infer<typeof ImproveHtmlWithAIInputSchema>;

const ImproveHtmlWithAIOutputSchema = z.object({
  improvedHtml: z
    .string()
    .describe('The improved HTML content.'),
});
export type ImproveHtmlWithAIOutput = z.infer<typeof ImproveHtmlWithAIOutputSchema>;

export async function improveHtmlWithAI(input: ImproveHtmlWithAIInput): Promise<ImproveHtmlWithAIOutput> {
  return improveHtmlWithAIFlow(input);
}

const improveHtmlWithAIPrompt = ai.definePrompt({
  name: 'improveHtmlWithAIPrompt',
  input: {schema: ImproveHtmlWithAIInputSchema},
  output: {schema: ImproveHtmlWithAIOutputSchema},
  prompt: `Eres un modelo de lenguaje de gran tamaño que funciona como asistente de programación embebido en un IDE. Tu tarea es revisar el siguiente CÓDIGO DE FRAGMENTO HTML de una diapositiva y realizar lo siguiente:

**Instrucciones Clave:**
1.  **Completa el código:** Si el fragmento de código HTML está incompleto, complétalo para asegurar que la diapositiva esté completamente funcional.
2.  **Mejora la visualización:** Mejora significativamente la representación visual del contenido para lograr una presentación clara, académica y profesional. Esto incluye:
    *   Asegurarte de que todas las figuras, ecuaciones y tablas se rendericen perfectamente, no como código LaTeX o texto plano.
    *   Aplicar estilos visuales profesionales (tipografía clara, contraste adecuado, buena organización visual, márgenes y espaciado equilibrados). Puedes usar etiquetas <style> si es necesario.
    *   Asegurar que el diseño sea responsivo.
3.  **CONSERVA LA FUNCIONALIDAD ORIGINAL (Regla Crítica):** Debes conservar estrictamente TODAS las funcionalidades originales del código.
    *   **Scripts:** Si el código original contiene etiquetas \`<script>\`, ¡DEBEN permanecer intactas en tu respuesta! No las elimines ni las modifiques, ya que controlan la interactividad.
    *   **Animaciones e Interacciones:** Las animaciones preexistentes y los elementos interactivos (botones, menús, etc.) deben seguir funcionando exactamente igual.
4.  **NO AÑADAS LIBRERÍAS EXTERNAS:**
    *   **Matemáticas:** La página ya carga la librería KaTeX. Para renderizar matemáticas, simplemente usa los delimitadores estándar como \`$$...$$\` para ecuaciones en bloque y \`$...$\` para ecuaciones en línea. NO añadas tus propias librerías de matemáticas como MathJax o un nuevo enlace a KaTeX.
    *   **Gráficos:** Si encuentras datos para graficar, usa librerías como Chart.js o Plotly, pero intégralas de forma que no requieran la importación de nuevas librerías en la cabecera del documento.
5.  **NO GENERES UN DOCUMENTO HTML COMPLETO:** Tu respuesta debe contener **ÚNICAMENTE el código HTML mejorado del FRAGMENTO**, listo para ser insertado dentro del \`<body>\` de una página. No incluyas \`<!DOCTYPE>\`, \`<html>\`, \`<head>\` o \`<body>\` tags.

**Código a revisar y mejorar:**
\`\`\`html
{{{htmlContent}}}
\`\`\`

**Respuesta final:** Proporciona únicamente el código HTML del fragmento corregido y mejorado, listo para ser integrado directamente en el proyecto.`,
});

const improveHtmlWithAIFlow = ai.defineFlow(
  {
    name: 'improveHtmlWithAIFlow',
    inputSchema: ImproveHtmlWithAIInputSchema,
    outputSchema: ImproveHtmlWithAIOutputSchema,
  },
  async input => {
    const {output} = await improveHtmlWithAIPrompt(input);
    return output!;
  }
);
