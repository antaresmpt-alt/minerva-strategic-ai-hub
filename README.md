# Minerva Strategic AI Hub

Aplicación web (Next.js App Router) de consultoría estratégica B2B con **Google Gemini**: análisis estratégico, generación de activos PMAX y estructura de slides, con chat de profundización y exportación a PDF.

## Requisitos

- Node.js 20+
- Cuenta en [Google AI Studio](https://aistudio.google.com/) con API key de Gemini

## Entorno local

```bash
npm install
cp .env.example .env.local
```

Edita `.env.local` y define:

- `GEMINI_API_KEY` — obligatorio
- `GEMINI_MODEL` — opcional (por defecto el proyecto usa un modelo reciente compatible con la API)

```bash
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000).

## Despliegue en Vercel

1. Sube el código a GitHub (rama `main`).
2. En [Vercel](https://vercel.com) → **Add New Project** → importa el repositorio.
3. En **Settings → Environment Variables** añade `GEMINI_API_KEY` (y `GEMINI_MODEL` si lo usas).
4. Despliega (**Deploy**). Vercel detecta Next.js automáticamente.

## Git y GitHub (primer push)

Si el remoto aún no existe:

1. Crea un repositorio vacío en GitHub (sin README si ya tienes commits locales).
2. En la carpeta del proyecto:

```bash
git remote add origin https://github.com/TU_USUARIO/TU_REPO.git
git push -u origin main
```

Sustituye `TU_USUARIO` y `TU_REPO` por tu usuario y nombre del repositorio.

### Autenticación en Windows

- **HTTPS**: GitHub suele pedir un [Personal Access Token](https://github.com/settings/tokens) como contraseña.
- **SSH**: configura una [SSH key](https://docs.github.com/en/authentication/connecting-to-github-with-ssh) y usa la URL `git@github.com:TU_USUARIO/TU_REPO.git`.

## Stack

- Next.js 16, React 19, Tailwind CSS, shadcn/ui, Zustand, `@google/generative-ai`, jsPDF, react-markdown.

## Licencia

Privado / uso interno salvo que indiques lo contrario.
