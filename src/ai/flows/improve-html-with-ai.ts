
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
  prompt: `Eres un asistente de IA especializado en la correcta visualización de notación matemática en HTML. Tu única tarea es procesar el siguiente fragmento de HTML y asegurarte de que todas las expresiones LaTeX se rendericen correctamente utilizando la librería KaTeX.

**Instrucciones precisas:**

1.  **Encuentra y corrige LaTeX:** Localiza todas las expresiones matemáticas escritas en LaTeX (delimitadas por \`$...$\`, \`$$...$$\`, \`\\(...\\)\`, o \`\\[...\\]\`).
2.  **Asegura la compatibilidad con KaTeX:** Corrige cualquier error de sintaxis dentro de las expresiones LaTeX para que sean válidas para KaTeX.
3.  **No alteres nada más:** Esta es la regla más importante. **NO DEBES** modificar, añadir o eliminar NADA del código HTML o CSS que no esté directamente relacionado con la corrección de las expresiones LaTeX.
    *   **NO** cambies estilos.
    *   **NO** cambies la estructura HTML (etiquetas, atributos, etc.).
    *   **NO** toques las etiquetas \`<script>\`. Son VITALES.
    *   **NO** añadas CSS nuevo.

**REGLA CRÍTICA:** Tu único objetivo es que el LaTeX se vea bien. Si el resto del código ya funciona, no lo toques. Tu respuesta debe ser ÚNICAMENTE el código HTML modificado.

**Código a procesar:**
\`\`\`html
{{{htmlContent}}}
\`\`\`
`,
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
