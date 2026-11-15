# Piplex

Piplex is a lightweight search frontend powered by the Brave Search API.

## Deploy on Vercel

1. Import this GitHub repository into Vercel.
2. Keep the project root as the repository root.
3. Add the environment variable `BRAVE_SEARCH_API_KEY` in Vercel Project Settings → Environment Variables.
4. Redeploy after adding the key.

Get a key from the Brave Search API dashboard: https://api-dashboard.search.brave.com/

## Features

- Web, image, video, and news search
- Search suggestions
- Voice input (browser Speech Recognition support required)
- Light and dark themes
- AI Mode with cited answers (requires access to Brave's Answers API on your Brave plan)

The API key is used only by the serverless function in `api/search.js`. Do not put it in the HTML or commit it to GitHub.

## Local development

Install the Vercel CLI, add the key to a local `.env.local` file (never commit it), then run:

```bash
vercel dev
```
