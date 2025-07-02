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
  prompt: `Actúa como un experto en desarrollo front-end especializado en visualizaciones científicas. Tu tarea es mejorar el siguiente código HTML.

**REQUISITOS ESTRICTOS:**
1.  **Renderizado de Ecuaciones con KaTeX:**
    * En el 
    * Cualquier ecuación en formato LaTeX (ej. 
2.  **Estilo Profesional:** Mejora el diseño general (CSS) para que sea más limpio, moderno y adecuado para un entorno académico.
3.  **Sin Pérdida de Contenido:** Conserva toda la funcionalidad, interactividad, animaciones y contenido textual original.
4.  **Salida Limpia:** Devuelve ÚNICAMENTE el código HTML mejorado. NO incluyas explicaciones ni texto introductorio.

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
