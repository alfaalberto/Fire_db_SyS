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
  prompt: `Eres un asistente de programación experto en diseño web. Tu tarea es mejorar el siguiente fragmento de código HTML, que será insertado dentro del <body> de una página. Presta especial atención a la representación visual y la funcionalidad.

**Reglas Críticas:**
1.  **NO generes un documento HTML completo.** Tu respuesta debe contener **ÚNICAMENTE el código que va dentro del <body>**. No incluyas \`<!DOCTYPE>\`, \`<html>\`, \`<head>\` o \`<body>\` tags.
2.  **MANTÉN la funcionalidad existente.** Si el código original contiene etiquetas \`<script>\` para interactividad, ¡DEBEN permanecer intactas en tu respuesta!
3.  **Las ecuaciones ya funcionan.** La página ya carga la librería KaTeX. Para renderizar matemáticas, simplemente usa los delimitadores estándar como \`$$...$$\` para ecuaciones en bloque y \`$...$\` para ecuaciones en línea. NO añadas tus propias librerías de matemáticas.

**Objetivos de Mejora Visual:**
1.  **Renderiza figuras y tablas:** Asegúrate de que las figuras, ecuaciones y tablas se muestren correctamente, no como código o texto plano.
2.  **Mejora la estética:** Aplica un formato visual profesional y académico:
    *   Usa tipografía clara y legible. Puedes usar fuentes como 'Inter', 'serif', 'sans-serif'.
    *   Aplica una paleta de colores armónica y profesional (por ejemplo, tonos oscuros para el fondo y colores brillantes pero no estridentes para los acentos).
    *   Asegura una buena distribución de elementos con márgenes y espaciado adecuados.
    *   Aplica estilos CSS directamente en el HTML usando etiquetas \`<style>\` dentro de tu fragmento si es necesario.
3.  **Asegura la responsividad:** El diseño debe adaptarse bien a diferentes tamaños de pantalla.

**Código a mejorar:**
\`\`\`html
{{{htmlContent}}}
\`\`\`

**Instrucción Final:** Proporciona únicamente el código HTML del fragmento mejorado, listo para ser integrado en el proyecto.`,
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
