
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
  prompt: `Tu tarea principal y más importante es asegurar que TODAS las ecuaciones y variables matemáticas en el siguiente fragmento de HTML se rendericen correctamente y estén elegantemente estilizadas.

Instrucciones:

1.  **Identifica todo el contenido matemático:** Encuentra cada expresión LaTeX. Usualmente están encerradas en \`$ ... $\`, \`$$ ... $$\`, \`\\( ... \\)\`, o \`\\[ ... \\]\`.
2.  **Asegura la correcta renderización:** Corrige cualquier error de sintaxis dentro de las expresiones LaTeX para que sean compatibles con la librería KaTeX. El objetivo es una notación matemática perfecta.
3.  **Aplica estilos a las matemáticas:** Puedes y debes aplicar estilos a los elementos matemáticos para asegurar que estén bien formateados. Esto puede incluir centrar las ecuaciones de bloque (\`$$...$$\` o \`\\[...\\]\`) o asegurar que tengan márgenes adecuados. Las ecuaciones en línea (\`$...$\` o \`\\(...\\)\`) deben fluir naturalmente con el texto.
4.  **REGLA CRÍTICA: NO TOQUES NADA MÁS:** No modifiques ningún otro elemento HTML, CSS, o etiquetas \`<script>\`. La funcionalidad existente y el estilo general de la página DEBEN permanecer idénticos. Tu único trabajo es arreglar las matemáticas.
5.  **IMPORTANTE:** El código que recibes es un fragmento de \`<body>\`, no una página HTML completa. No añadas \`<html>\`, \`<head>\`, o \`<body>\` a tu respuesta. Mantén intactas las etiquetas \`<script>\` existentes, ya que son VITALES para la interactividad.

Tu respuesta debe ser únicamente el código HTML corregido.

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
