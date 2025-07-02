
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
  prompt: `Eres un desarrollador front-end y diseñador UI experto, especializado en refinar código HTML existente para presentaciones académicas y profesionales.

Tu tarea es tomar el siguiente fragmento de HTML y **mejorar** su presentación visual y completitud, **sin eliminar ni alterar la funcionalidad, estructura o estilos existentes.**

**Instrucciones Específicas:**

1.  **Renderizado de Contenido Especializado:**
    *   Si encuentras código LaTeX (delimitado por \`$...$\` o \`$$...$$\`), asegúrate de que esté bien formado para que la librería KaTeX (ya presente en la página) pueda renderizarlo.
    *   Si encuentras tablas en texto plano, conviértelas a etiquetas HTML estándar (\`<table>\`, \`<tr>\`, \`<td>\`, etc.) con un estilo limpio.

2.  **Mejora de Estilos (Aditiva):**
    *   Introduce CSS profesional y sutil dentro de una etiqueta \`<style>\` al principio del fragmento.
    *   Enfócate en mejorar: tipografía (legibilidad, jerarquía de tamaños), contraste de color, espaciado (márgenes y rellenos) y layout.
    *   **REGLA CLAVE:** No elimines atributos de estilo (\`style="..."\`) o clases CSS existentes. Tu trabajo es *añadir* nuevos estilos o sobreescribir propiedades específicas si es estrictamente necesario para la mejora visual.

3.  **Completar y Corregir HTML:**
    *   Si el HTML está estructuralmente incompleto (por ejemplo, etiquetas sin cerrar), corrígelo para que sea HTML válido.

**REGLAS CRÍTICAS E INVIOLABLES:**

*   **NO ELIMINAR SCRIPTS:** El código puede contener etiquetas \`<script>\`. Son VITALES para la interactividad. **NO DEBES eliminarlas ni modificarlas bajo ninguna circunstancia.**
*   **CONSERVAR INTERACTIVIDAD:** Todos los elementos interactivos (botones, animaciones, etc.) deben permanecer 100% funcionales.
*   **CONSERVAR ESTRUCTURA:** No alteres significativamente la estructura HTML (el árbol DOM). Realiza tus mejoras dentro de la estructura existente.
*   **NO AÑADIR LIBRERÍAS EXTERNAS:** No enlaces a ninguna librería externa de CSS o JS. El entorno ya provee KaTeX para las matemáticas.
*   **FORMATO DE SALIDA:** Tu respuesta DEBE ser ÚNICAMENTE el código HTML mejorado del fragmento. No incluyas \`<!DOCTYPE>\`, \`<html>\`, \`<head>\`, ni etiquetas \`<body>\`.

**Código a mejorar:**
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
