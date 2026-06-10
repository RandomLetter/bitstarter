'use strict';
// Email templates shared by the Node server (lib/mailer.js) and the
// Cloudflare Worker (worker/index.js). Each returns { subject, text }.

function inviteEmail(game, player, link) {
  return {
    subject: 'You have been invited to a game of Santiago',
    text:
      `Hello ${player.name},\n\n`
      + `You are playing ${player.color} in a ${game.players.length}-player game of Santiago.\n\n`
      + `This is your personal link — keep it secret, it is your login:\n`
      + `${link}\n\n`
      + `The game is asynchronous: you will get an email whenever it is your turn.\n`,
  };
}

const PHASE_PROMPTS = {
  bidding: 'bid on the new plantations',
  placement: 'choose and place a plantation tile',
  lastTile: 'place the leftover neutral tile',
  bribe: 'propose or support a canal (or pass)',
  decision: 'decide where the canal is built (you are the Canal Overseer)',
  extra: 'decide whether to place your extra canal',
};

function yourTurnEmail(game, player, link) {
  return {
    subject: `Santiago: it's your turn (round ${game.round} of ${game.totalRounds})`,
    text:
      `Hello ${player.name},\n\n`
      + `It is your turn to ${PHASE_PROMPTS[game.phase] || 'act'}.\n\n`
      + `Play here: ${link}\n`,
  };
}

function gameOverEmail(game, player, link) {
  const lines = game.scores.map((s, i) => `${i + 1}. ${s.name} (${s.color}) — ${s.total} Escudos`);
  return {
    subject: 'Santiago: the game is over!',
    text:
      `Hello ${player.name},\n\nFinal scores:\n${lines.join('\n')}\n\n`
      + `See the final board: ${link}\n`,
  };
}

module.exports = { inviteEmail, yourTurnEmail, gameOverEmail };
