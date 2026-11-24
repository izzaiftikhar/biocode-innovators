# BioCode Innovators

**Research Wing — Research, courses and student publishing in one place.**

BioCode Innovators is a learning and research platform focused on bioinformatics, AI and data analytics.

## Features

- Responsive public website
- Course catalogue, modules and lecture player
- Student authentication and dashboard
- Assignments, quizzes and progress tracking
- Course certificates
- Internship enrollment, tasks, submissions and payment management
- Research publications and student journal
- Admin dashboard for platform management
- Admin-only analytics and reporting
- AI-powered bioinformatics chatbot
- Contact forms, feedback and email notifications

## Technology Stack

- Next.js 14 — App Router
- React 18
- TypeScript
- Tailwind CSS
- Supabase — Database and authentication
- Gemini API — Chatbot
- Nodemailer — Email notifications

## Run Locally

Requirements: Node.js and npm.

1. Clone the repository.
2. Install dependencies:

```bash
npm install
```

3. Create your local environment file:

```powershell
Copy-Item .env.example .env.local
```

4. Add your actual credentials to `.env.local`.
5. Start the development server:

```bash
npm run dev
```

Open http://localhost:3000.

## Environment Variables

See `.env.example` for the required variable names.

**Never commit `.env.local` or publish private API keys, database credentials, or email passwords.**

## Database Setup

The project uses Supabase. Configure your Supabase project and apply the SQL migrations in `supabase/migrations/` in their intended order.

## Deployment

The application can be deployed to Vercel.

1. Import the GitHub repository into Vercel.
2. Configure the required environment variables in Vercel project settings.
3. Deploy the application.

## Project Structure

- `src/app/` — Pages, layouts and API routes
- `src/components/` — Reusable UI components
- `src/lib/` — Application utilities and services
- `src/data/` — Content and chatbot knowledge
- `src/styles/` — Design tokens and styling
- `supabase/migrations/` — Database migrations
- `public/` — Static assets
