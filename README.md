# Señales y Sistemas — Plataforma Académica

Plataforma interactiva para el curso de **Señales y Sistemas** basada en *Oppenheim, Willsky y Nawab*.

## Stack

- **Next.js 15** + React 18 + TypeScript
- **Tailwind CSS** con tema oscuro teal/cyan premium
- **Firebase Firestore** para persistencia de diapositivas
- **shadcn/ui** componentes accesibles con Radix UI
- **KaTeX / MathJax** para renderizado matemático
- **PWA** con service worker para soporte offline

## Inicio rápido

```bash
# 1. Instalar dependencias
npm install

# 2. Configurar variables de entorno
cp .env.example .env
# Edita .env con tus credenciales de Firebase

# 3. Ejecutar en desarrollo
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000).

## Scripts

| Comando | Descripción |
|---------|-------------|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Build de producción |
| `npm run start` | Servidor de producción |
| `npm run lint` | Linter |

## Estructura del proyecto

```
src/
├── app/            # Layout, page, error (App Router)
├── components/     # Componentes core y UI (shadcn)
├── hooks/          # Hooks personalizados
└── lib/            # Utils, tipos, Firebase, constantes (temario)
public/
├── sw.js           # Service worker
├── manifest.json   # PWA manifest
└── slide-iframe.css
```

## Licencia

Uso académico.
