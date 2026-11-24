# BioCode Innovators

**Research Wing — Research, courses and student publishing in one place.**

[Visit BioCode Innovators](https://biocode-innovators-plum.vercel.app)

BioCode Innovators is a learning and research platform focused on bioinformatics, artificial intelligence, and data analytics. It brings together online learning, research resources, student publishing, and internship opportunities in one platform.

## Features

- Responsive public website
- Course catalogue, modules, and lecture player
- Student authentication and dashboard
- Assignments, quizzes, and progress tracking
- Course completion certificates
- Internship enrollment and management
- Internship tasks, submissions, and payment management
- Research publications and student journal
- Admin dashboard for platform management
- Admin-only analytics and reporting
- AI-powered bioinformatics chatbot
- Contact forms, feedback, and email notifications

## Technology Stack

| Technology | Purpose |
|---|---|
| Next.js 14 | App Router and application framework |
| React 18 | User interface |
| TypeScript | Type-safe development |
| Tailwind CSS | Styling and responsive design |
| Supabase | Database and authentication |
| Gemini API | AI-powered chatbot |
| Nodemailer | Email notifications |

## Getting Started

### Requirements

- Node.js
- npm
- A Supabase project with the required configuration

### Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/izzaiftikhar/biocode-innovators.git
   ```

2. Navigate to the project directory:

   ```bash
   cd biocode-innovators
   ```

3. Install dependencies:

   ```bash
   npm install
   ```

4. Create your local environment file:

   ```powershell
   Copy-Item .env.example .env.local
   ```

5. Add your actual credentials and configuration to `.env.local`.

6. Start the development server:

   ```bash
   npm run dev
   ```

7. Open [http://localhost:3000](http://localhost:3000).

## Environment Variables

The `.env.example` file provides the environment variable names required for configuration.

Add your own credentials to `.env.local` for local development.

For production deployment, configure the required environment variables in your Vercel project settings.

**Security:** Never commit `.env.local` or expose private API keys, service-role keys, database credentials, or email passwords.

## Database Setup

BioCode Innovators uses Supabase for database and authentication services.

1. Configure your Supabase project.
2. Set the required Supabase environment variables.
3. Apply the SQL migrations located in `supabase/migrations/` in their intended order.
4. Configure authentication URLs and redirect URLs for your deployment domain.

## Deployment

The production application is deployed on Vercel.

**Live Website:**  
https://biocode-innovators-plum.vercel.app

**GitHub Repository:**  
https://github.com/izzaiftikhar/biocode-innovators

To deploy your own instance:

1. Import the GitHub repository into Vercel.
2. Configure the required environment variables.
3. Verify your Supabase configuration and authentication redirect URLs.
4. Deploy the application.

Vercel can automatically create new production deployments when changes are pushed to the connected `main` branch.

## Project Structure

```text
biocode-innovators/
├── public/                 # Static assets
├── src/
│   ├── app/                # Pages, layouts and API routes
│   ├── components/         # Reusable UI components
│   ├── lib/                # Application utilities and services
│   ├── data/               # Content and chatbot knowledge
│   └── styles/             # Design tokens and styling
├── supabase/
│   └── migrations/         # Database migrations
├── .env.example            # Environment variable template
├── .gitignore
├── package.json
├── package-lock.json
├── next.config.mjs
├── tailwind.config.ts
└── tsconfig.json
```

## Project Information

**BioCode Innovators**  
Research, learning, and student publishing in bioinformatics, AI, and data analytics.

- Website: https://biocode-innovators-plum.vercel.app
- GitHub: https://github.com/izzaiftikhar/biocode-innovators

**Code Your Future. Decode Biology.**