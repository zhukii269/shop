import Game from './src/core/Game.js';

window.addEventListener('DOMContentLoaded', async () => {
    const game = new Game();
    await game.init(); // Wait for assets to load

    // Expose game instance for debugging
    window.game = game;
});
