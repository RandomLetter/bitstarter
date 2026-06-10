'use strict';
// Email notifications. Configured entirely through environment variables:
//   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_SECURE, MAIL_FROM, BASE_URL
// If SMTP_HOST is not set, messages are logged to the console instead so the
// game remains fully playable in development (players share their links).

let transport = null;

function init() {
  if (!process.env.SMTP_HOST) {
    console.log('SMTP_HOST not set: email notifications will be logged to the console.');
    return;
  }
  const nodemailer = require('nodemailer');
  transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined,
  });
}

function baseUrl(req) {
  if (process.env.BASE_URL) return process.env.BASE_URL.replace(/\/$/, '');
  return `${req.protocol}://${req.get('host')}`;
}

async function send(to, subject, text) {
  if (!to) return;
  if (!transport) {
    console.log(`[mail -> ${to}] ${subject}\n${text}\n`);
    return;
  }
  try {
    await transport.sendMail({
      from: process.env.MAIL_FROM || process.env.SMTP_USER,
      to,
      subject,
      text,
    });
  } catch (err) {
    console.error(`Failed to send mail to ${to}:`, err.message);
  }
}

function gameLink(req, token) {
  return `${baseUrl(req)}/g/${token}`;
}

async function sendInvite(req, game, player) {
  await send(
    player.email,
    'You have been invited to a game of Santiago',
    `Hello ${player.name},\n\n`
    + `You are playing ${player.color} in a ${game.players.length}-player game of Santiago.\n\n`
    + `This is your personal link — keep it secret, it is your login:\n`
    + `${gameLink(req, player.token)}\n\n`
    + `The game is asynchronous: you will get an email whenever it is your turn.\n`,
  );
}

async function sendYourTurn(req, game, player) {
  const phaseNames = {
    bidding: 'bid on the new plantations',
    placement: 'choose and place a plantation tile',
    lastTile: 'place the leftover neutral tile',
    bribe: 'propose or support a canal (or pass)',
    decision: 'decide where the canal is built (you are the Canal Overseer)',
    extra: 'decide whether to place your extra canal',
  };
  await send(
    player.email,
    `Santiago: it's your turn (round ${game.round} of ${game.totalRounds})`,
    `Hello ${player.name},\n\n`
    + `It is your turn to ${phaseNames[game.phase] || 'act'}.\n\n`
    + `Play here: ${gameLink(req, player.token)}\n`,
  );
}

async function sendGameOver(req, game, player) {
  const lines = game.scores.map((s, i) => `${i + 1}. ${s.name} (${s.color}) — ${s.total} Escudos`);
  await send(
    player.email,
    'Santiago: the game is over!',
    `Hello ${player.name},\n\nFinal scores:\n${lines.join('\n')}\n\n`
    + `See the final board: ${gameLink(req, player.token)}\n`,
  );
}

module.exports = { init, sendInvite, sendYourTurn, sendGameOver };
