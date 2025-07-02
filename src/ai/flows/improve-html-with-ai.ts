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
  prompt: `Eres un modelo de lenguaje de gran tamaño que funciona como asistente de programación embebido en un IDE. Tu tarea es completar y corregir el siguiente código, prestando especial atención a la representación visual. Específicamente, debes asegurarte de que:

1. **Las figuras, ecuaciones y tablas** se muestren correctamente renderizadas, no como código LaTeX o texto plano.
2. **El formato visual de la presentación** sea mejorado para obtener un aspecto profesional y académico. Esto implica:

   * Tipografía clara y adecuada para textos científicos.
   * Colores profesionales y armónicos.
   * Márgenes, espacios y distribución equilibrada de los elementos.
   * Efectos visuales elegantes para transiciones y animaciones que mejoren la experiencia del usuario sin distraer.
3. **Se mantengan intactas** todas las funcionalidades originales del código:

   * Interactividad del usuario (botones, controles, menús).
   * Animaciones preexistentes.
   * Interacciones dinámicas de elementos visuales.

Al corregir el código asegúrate de:

* Corregir errores de sintaxis y estructura.
* Integrar correctamente librerías para renderizar matemáticas (por ejemplo, MathJax o KaTeX).
* Emplear librerías profesionales para gráficos (como Chart.js, Plotly o similares).
* Asegurar responsividad en distintos dispositivos.

**Importante:** Proporciona ÚNICAMENTE el código HTML mejorado. NO incluyas explicaciones ni texto introductorio.

Aquí está el código a mejorar:
\`\`\`html
{{{htmlContent}}}
\`\`\``,
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
