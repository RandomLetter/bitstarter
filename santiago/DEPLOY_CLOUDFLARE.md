# Deploying Santiago to Cloudflare at budoludo.com/santiago

The app ships with two interchangeable backends:

- `server.js` — Node/Express, JSON files on disk, SMTP email (for local play
  or a traditional VPS).
- `worker/index.js` — **Cloudflare Workers**, games in a **D1** database,
  email via the **Resend** HTTP API, static files served as Worker assets.
  This is the one you deploy to Cloudflare. Everything (engine, rules, UI,
  email texts) is shared between the two.

Workers + D1 both have generous free tiers; this app fits comfortably in them.

## 0. Prerequisites

- A Cloudflare account with the **budoludo.com zone added** (Dashboard →
  Add a domain → follow the nameserver instructions at your registrar, if you
  haven't already).
- Node 18+ locally, and this repo checked out.

All commands below run from the `santiago/` directory (`npm install` first).

## 1. Log in to Cloudflare

```sh
npx wrangler login
```

## 2. Create the D1 database and apply the schema

```sh
npx wrangler d1 create santiago
```

Copy the printed `database_id` into `wrangler.toml` (replacing
`REPLACE_WITH_YOUR_D1_DATABASE_ID`), then create the tables:

```sh
npx wrangler d1 execute santiago --remote --file=schema.sql
```

## 3. Set up email (Resend)

Workers can't speak SMTP, so the Worker sends mail through
[Resend](https://resend.com) (free tier: 3,000 emails/month — plenty for
turn notifications).

1. Create a Resend account and **add budoludo.com as a domain**; add the
   DKIM/SPF DNS records it shows you (one click if your DNS is already on
   Cloudflare).
2. Create an API key, then store it as a Worker secret:

```sh
npx wrangler secret put RESEND_API_KEY
```

The from-address is `MAIL_FROM` in `wrangler.toml`
(default `Santiago <santiago@budoludo.com>`).

If you skip this step everything still works — notification emails are
written to the Worker logs (`npx wrangler tail`) instead of being sent.

> Prefer SendGrid/Mailgun/Postmark? Swap the `fetch` call in `sendMail()`
> in `worker/index.js`; it's ~10 lines.

## 4. Make sure budoludo.com resolves through Cloudflare

The route `budoludo.com/santiago*` only fires if requests for budoludo.com
reach Cloudflare. If the apex has no DNS record yet, add a placeholder
**proxied** record so Cloudflare terminates the traffic:

- DNS → Add record → type `AAAA`, name `@`, value `100::`, proxy status
  **Proxied** (orange cloud).

(Anything you later host at the root of budoludo.com replaces this; the
`/santiago` route is untouched by it.)

## 5. Deploy

```sh
npx wrangler deploy
```

`wrangler.toml` already routes `budoludo.com/santiago*` to the Worker and
sets `BASE_PATH=/santiago` / `BASE_URL=https://budoludo.com/santiago`, so
that's it:

- **https://budoludo.com/santiago/** — create a game
- players get personal `https://budoludo.com/santiago/g/<token>` links by email

## 6. Operate

```sh
npx wrangler tail                          # live logs (incl. email fallback)
npx wrangler d1 execute santiago --remote \
  --command "SELECT id, created_at, version FROM games"   # list games
```

Games live in D1 permanently; delete old rows from `games`/`tokens` if you
ever care.

## Changing the path or domain

Everything is configuration: edit `BASE_PATH`, `BASE_URL`, `MAIL_FROM` and
the `[[routes]]` pattern in `wrangler.toml`. The frontend uses only relative
URLs, so it follows along automatically (it also works at a domain root with
`BASE_PATH = ""`).

## Why not run the Node server on Cloudflare?

Workers have no persistent filesystem (the JSON file store would vanish) and
no SMTP sockets (nodemailer won't run). The Worker backend replaces those two
pieces with D1 and an email API and keeps everything else identical. The
alternatives — Cloudflare Containers (requires a paid plan, still ephemeral
disk) or hosting the Node app elsewhere behind Cloudflare DNS — buy nothing
here.
