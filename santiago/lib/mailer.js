'use strict';
// Email notifications. Configured entirely through environment variables:
//   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_SECURE, MAIL_FROM, BASE_URL
// If SMTP_HOST is not set, messages are logged to the console instead so the
// game remains fully playable in development (players share their links).

const emails = require('./emails');

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

async function send(to, { subject, text }) {
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
  await send(player.email, emails.inviteEmail(game, player, gameLink(req, player.token)));
}

async function sendYourTurn(req, game, player) {
  await send(player.email, emails.yourTurnEmail(game, player, gameLink(req, player.token)));
}

async function sendGameOver(req, game, player) {
  await send(player.email, emails.gameOverEmail(game, player, gameLink(req, player.token)));
}

module.exports = { init, sendInvite, sendYourTurn, sendGameOver };
