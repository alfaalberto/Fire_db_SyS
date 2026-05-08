export function sanitizeHtml(input: string): string {
  if (!input) return '';
  let out = input;
  const preservedScripts: string[] = [];
  out = out.replace(/<script\b[^>]*type\s*=\s*['"]math\/tex[^>]*>[\s\S]*?<\/script>/gi, (match) => {
    preservedScripts.push(match);
    return `__PRESERVED_MATH_SCRIPT_${preservedScripts.length - 1}__`;
  });
  out = out.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  out = out.replace(/\son[a-z]+\s*=\s*"[^"]*"/gi, '');
  out = out.replace(/\son[a-z]+\s*=\s*'[^']*'/gi, '');
  out = out.replace(/\son[a-z]+\s*=\s*[^\s>]+/gi, '');
  out = out.replace(/__PRESERVED_MATH_SCRIPT_(\d+)__/g, (_, idx) => {
    const i = Number(idx);
    return Number.isFinite(i) && preservedScripts[i] ? preservedScripts[i] : '';
  });
  return out;
}
