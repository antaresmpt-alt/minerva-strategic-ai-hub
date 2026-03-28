# Minerva Strategic AI Hub

**Repositorio:** [github.com/antaresmpt-alt/minerva-strategic-ai-hub](https://github.com/antaresmpt-alt/minerva-strategic-ai-hub)

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

1. El código está en GitHub (rama `main`): [antaresmpt-alt/minerva-strategic-ai-hub](https://github.com/antaresmpt-alt/minerva-strategic-ai-hub).
2. En [Vercel](https://vercel.com) → **Add New Project** → importa ese repositorio.
3. En **Settings → Environment Variables** añade `GEMINI_API_KEY` (y `GEMINI_MODEL` si lo usas).
4. Despliega (**Deploy**). Vercel detecta Next.js automáticamente.

## Git y GitHub

Clonar el proyecto:

```bash
git clone https://github.com/antaresmpt-alt/minerva-strategic-ai-hub.git
cd minerva-strategic-ai-hub
```

Remoto configurado (referencia):

```bash
git remote add origin https://github.com/antaresmpt-alt/minerva-strategic-ai-hub.git
git push -u origin main
```

(Si `origin` ya existe, usa `git remote set-url origin https://github.com/antaresmpt-alt/minerva-strategic-ai-hub.git`.)

### Autenticación en Windows

- **HTTPS**: GitHub suele pedir un [Personal Access Token](https://github.com/settings/tokens) como contraseña.
- **SSH**: configura una [SSH key](https://docs.github.com/en/authentication/connecting-to-github-with-ssh) y usa `git@github.com:antaresmpt-alt/minerva-strategic-ai-hub.git`.

## Stack

- Next.js 16, React 19, Tailwind CSS, shadcn/ui, Zustand, `@google/generative-ai`, jsPDF, react-markdown.

## Licencia

Privado / uso interno salvo que indiques lo contrario.
