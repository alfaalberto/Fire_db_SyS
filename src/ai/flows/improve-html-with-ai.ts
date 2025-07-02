
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
  prompt: `Eres un asistente de programación experto en diseño web y frontend. Tu tarea es analizar el siguiente fragmento de código HTML de una diapositiva y mejorarlo.

**Instrucciones Clave:**

1.  **Completa el código:** Si el HTML está incompleto, complétalo para que sea válido y funcional.
2.  **Mejora la Estética:** Aplica un estilo visual profesional y académico.
    *   **Renderizado Correcto:** Asegúrate de que las ecuaciones matemáticas (usando delimitadores de KaTeX como \`$$...$$\` o \`$...$\`), tablas y figuras se vean como elementos visuales, no como código.
    *   **Estilos:** Utiliza CSS dentro de etiquetas \`<style>\` si es necesario para mejorar la tipografía, el espaciado y la paleta de colores. El diseño debe ser limpio y moderno.
3.  **REGLA CRÍTICA - NO ALTERAR FUNCIONALIDAD:**
    *   **Conserva los Scripts:** ¡NO elimines ni modifiques las etiquetas \`<script>\` existentes! Son esenciales para la interactividad.
    *   **Conserva la Interacción:** Todos los elementos interactivos (botones, animaciones, etc.) deben seguir funcionando exactamente igual que en el original.
4.  **RESTRICCIONES TÉCNICAS:**
    *   **No añadas librerías externas:** La página ya carga la librería KaTeX para matemáticas. No incluyas enlaces a MathJax u otras librerías.
    *   **Solo el fragmento:** Tu respuesta debe ser ÚNICAMENTE el código HTML mejorado para el \`<body>\`. NO incluyas \`<!DOCTYPE>\`, \`<html>\`, \`<head>\`, o \`<body>\` tags.

**Código a mejorar:**
\`\`\`html
{{{htmlContent}}}
\`\`\`

**Salida:** Proporciona únicamente el código HTML del fragmento mejorado.`,
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
