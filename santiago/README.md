# Santiago — asynchronous web edition

A web app for playing the board game **Santiago** (Claudia Hely & Roman Pelek,
Amigo 2003) with 3–5 players, fully asynchronously:

- **Special-URL login** — each player gets a personal secret link; no accounts
  or passwords.
- **Asynchronous play** — the game state lives on the server; players act
  whenever they like and the page refreshes itself.
- **Email notifications** — players receive an email when the game starts,
  whenever it is their turn, and when the game ends.

## Rules implemented

The full 7-phase round structure from the official English rules:

1. **Bidding** — unique open bids (or pass) for pick order of the revealed
   plantation tiles.
2. **Canal Overseer change** — lowest bid (or first pass) takes the figure.
3. **Placing plantations** — in descending bid order, with yield markers
   (one fewer if you passed). In 3-player games the leftover tile is placed
   as a neutral plantation by the highest bidder.
4. **Bribing the Overseer** — propose a canal with a bribe, support someone
   else's proposal, or pass; the Overseer accepts one bribe or pays
   (highest bribe + 1) to build elsewhere.
5. **Extra irrigation** — each player's one free extra canal (max one per round).
6. **Drying** — non-irrigated plantations lose a yield marker or turn to desert.
7. **Income** — 3 Escudos per player.

The game ends after 11 rounds (3–4 players) or 9 rounds (5 players) with final
drying and scoring: connected same-crop areas pay (tiles × your markers).
Money is hidden information — players only see their own balance until the end.

## Running

```sh
cd santiago
npm install
npm start          # serves on PORT (default 5000)
npm test           # engine test-suite (node --test)
```

Open `http://localhost:5000/`, enter the players' names and email addresses,
and share the generated links (they are also emailed if SMTP is configured).

## Email configuration

Set these environment variables to enable real email delivery; without
`SMTP_HOST` the notifications are printed to the server console instead, and
the game stays fully playable via shared links.

| Variable | Meaning |
| --- | --- |
| `SMTP_HOST` | SMTP server hostname |
| `SMTP_PORT` | SMTP port (default 587) |
| `SMTP_SECURE` | `true` for implicit TLS (port 465) |
| `SMTP_USER` / `SMTP_PASS` | SMTP credentials (optional) |
| `MAIL_FROM` | From address (defaults to `SMTP_USER`) |
| `BASE_URL` | Public base URL used in email links, e.g. `https://santiago.example.com` |
| `SANTIAGO_DATA_DIR` | Where game JSON files are stored (default `./data`) |
| `PORT` | HTTP port (default 5000) |

Games are persisted as JSON files, one per game, and survive server restarts.
