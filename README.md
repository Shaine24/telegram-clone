# Telegram Web

A Telegram-style, real-time web messenger built with **Next.js**, **Supabase** and **Tailwind CSS**, deployed on **Vercel**.

![Next.js](https://img.shields.io/badge/Next.js-16-black)
![React](https://img.shields.io/badge/React-19-149eca)
![Supabase](https://img.shields.io/badge/Supabase-Auth%20%2B%20Postgres%20%2B%20Realtime-3ecf8e)
![Vercel](https://img.shields.io/badge/Deploy-Vercel-black)

## Features

- Email + password sign-up and sign-in with Supabase Auth
- Search people by name or `@username` and start a direct chat
- Real-time message delivery and live chat-list updates
- Unread badges, read receipts, date separators and message grouping
- Emoji picker, in-conversation search, auto-growing composer
- Editable display name and avatar color
- Row-level security: only chat members can read a conversation
- Responsive Telegram-style dark UI (desktop + mobile)
- Demo-friendly onboarding with instant sign-ups

## Stack

| Layer | Technology |
| --- | --- |
| Frontend | Next.js 16 (App Router), React 19, Tailwind CSS 4 |
| Icons | lucide-react |
| Auth | Supabase Auth (email + password) |
| Database | Supabase Postgres with RLS |
| Realtime | Supabase Realtime (`postgres_changes`) |
| Hosting | Vercel |

## Local development

```bash
npm install
cp .env.example .env.local   # add your Supabase URL + anon key
npm run dev
```

Open <http://localhost:3000>.

### Database setup

Apply [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql) to your Supabase project (SQL editor or `supabase db push`). It creates:

- `profiles`, `chats`, `chat_members`, `messages`
- A trigger that creates a profile when a user signs up
- RPCs: `get_or_create_direct_chat`, `list_my_chats`, `search_users`, `mark_chat_read`
- Row-level security policies and the realtime publication for `messages`

For a frictionless demo, email confirmation is disabled in the Supabase Auth settings. Re-enable it for production.

## Environment variables

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

The anon key is safe to expose; all access is constrained by RLS.

## Deployment

```bash
vercel link
vercel env add NEXT_PUBLIC_SUPABASE_URL production
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
vercel --prod
```

## Project structure

```text
app/                    Next.js routes, layout, global styles, icon
components/             Auth screen, messenger, modals, avatar, logo
lib/                    Supabase client, types, formatting helpers
supabase/migrations/    SQL schema, RPCs, RLS and realtime setup
```

## Scripts

```bash
npm run dev     # local dev server
npm run build   # production build
npm run lint    # ESLint
npm start       # run the production build
```

---

Built as a Telegram-style demo. Not affiliated with Telegram.
