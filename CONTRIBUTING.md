# Contributing to GIG (Get In Git)

First off, thank you for considering contributing to GIG! It's people like you that make this platform a great tool for connecting developers with paid open-source tasks.

## Getting Started

1. **Fork** the repository on GitHub.
2. **Clone** your fork locally:
   ```bash
   git clone https://github.com/YOUR-USERNAME/GIG.git
   cd GIG/alpha-v0.1
   ```
3. **Install dependencies**:
   ```bash
   npm install
   ```
4. **Set up environment variables**:
   Copy the example environment file and fill in your local values.
   ```bash
   cp .env.example .env.local
   ```
5. **Start the development server**:
   ```bash
   npm run dev
   ```

## Development Workflow

- Run the development server: `npm run dev`
- Run the test suite: `npm test`
- Run the linter: `npm run lint`

## Branch Naming Conventions

Please use descriptive branch names. We recommend the following prefixes:
- `feature/` for new features (e.g., `feature/user-profile`)
- `fix/` for bug fixes (e.g., `fix/login-crash`)
- `docs/` for documentation changes
- `chore/` for maintenance tasks

## Commit Message Conventions

We follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:
- `feat: add user profile page`
- `fix: resolve crash on login`
- `docs: update setup instructions`
- `chore: update dependencies`

## Pull Request Process

1. Ensure all tests and linters pass (`npm test`, `npm run lint`).
2. Update documentation if necessary.
3. Push your branch to your fork.
4. Open a Pull Request against the `main` branch.
5. Fill out the provided Pull Request template.
6. Await review from the maintainers.

## Code Style

- **TypeScript**: We use strict TypeScript. Ensure all new code is properly typed.
- **Tailwind CSS**: We use Tailwind CSS 4. Follow utility-first principles.
- **Next.js App Router**: This project uses Next.js 16 App Router conventions. Place page components in `page.tsx` and layout components in `layout.tsx` within the `app` directory.

## Database Changes

We use Supabase PostgreSQL. If your feature requires database schema changes:
1. Create a new migration file in `supabase/migrations/`.
2. Name the file with a timestamp prefix and descriptive name (e.g., `20250101000000_add_user_table.sql`).
3. Ensure both `up` and `down` migrations are considered or testable.

## Testing Expectations

We use **Vitest** for testing. 
- Write unit tests for all new utilities and complex components.
- Run `npm test` to ensure your changes do not break existing tests.

## Code of Conduct

By participating in this project, you agree to abide by our Code of Conduct. Please be respectful and constructive in all interactions.
