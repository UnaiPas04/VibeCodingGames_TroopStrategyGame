// Results of an online match: ranking with every player's score. The room stays open:
// "Back to lobby" prepares the next match, "Main menu" leaves the room.

import { VIEW } from '../config.js';
import { session } from './session.js';

/** @param {import('../main.js').Game} game */
export function createOnlineResultsScene(game) {
  const list = /** @type {HTMLElement} */ (document.querySelector('[data-net-results]'));
  /** @type {{id: string, name: string, color: string, score: number}[]} */
  let results = [];

  return {
    name: 'results',
    /** @param {{ranking: typeof results}} data */
    enter(data) {
      results = data?.ranking ?? [];
      const best = results[0]?.score ?? 0;
      const winners = results.filter((r) => r.score === best);
      game.ui.set('results-title', winners.length > 1 ? 'Draw!' : `${winners[0]?.name ?? 'Nobody'} wins!`);
      list.replaceChildren(
        ...results.map((r) => {
          const li = document.createElement('li');
          li.style.setProperty('--player', r.color);
          li.textContent = `${r.name}${r.id === session.room?.selfId ? ' (you)' : ''}: ${r.score}`;
          return li;
        })
      );
      game.ui.show('results');
    },
    update() {
      game.ui.navigate(game.input);
    },
    render(/** @type {CanvasRenderingContext2D} */ ctx) {
      ctx.fillStyle = VIEW.background;
      ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    },
    debugState: () => ({ results: results.map((r) => ({ name: r.name, score: r.score })) })
  };
}
