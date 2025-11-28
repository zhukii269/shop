import Loop from './Loop.js';
import Renderer from '../view/Renderer.js';
import UIManager from '../view/UI.js';
import GameState from '../model/GameState.js';
import Input from './Input.js';

export default class Game {
    constructor() {
        this.canvas = document.getElementById('game-canvas');
        this.ctx = this.canvas.getContext('2d');

        // Fixed Logical Resolution (Retro Game Boy Advance style)
        const logicalWidth = 240;
        const logicalHeight = 160;

        this.config = {
            tileSize: 16,
            width: logicalWidth,
            height: logicalHeight,
            scale: 1 // Placeholder, updated in handleResize
        };

        // Handle Resize
        window.addEventListener('resize', () => this.handleResize());

        // Initial Resize
        this.handleResize();

        // Systems
        this.state = new GameState(this);
        this.renderer = new Renderer(this);
        this.ui = new UIManager(this);
        this.input = new Input(this);
        this.loop = new Loop(this.update.bind(this), this.render.bind(this));

        this.effects = []; // Visual effects
        this.selectedEntity = null; // Currently selected entity (e.g. employee)
        this.isRunning = false;
    }

    handleResize() {
        // Calculate scale to fit window while maintaining aspect ratio
        const scaleX = window.innerWidth / this.config.width;
        const scaleY = window.innerHeight / this.config.height;

        // Use the smaller scale to ensure it fits entirely (contain)
        let scale = Math.min(scaleX, scaleY);

        // Ensure minimum scale of 1
        scale = Math.max(scale, 1);

        this.config.scale = scale;

        // Set Canvas Size to the SCALED size
        this.canvas.width = this.config.width * scale;
        this.canvas.height = this.config.height * scale;

        // Scale context so drawing operations use logical coordinates
        this.ctx.scale(scale, scale);

        // Disable smoothing for pixel art look
        this.ctx.imageSmoothingEnabled = false;

        // Force render
        if (!this.isRunning && this.renderer) {
            this.render();
        }
    }

    addEffect(effect) {
        effect.maxLife = effect.life;
        this.effects.push(effect);
    }

    async init() {
        console.log('Game Initializing...');

        // Initialize systems
        this.ui.init();
        this.input.init();
        await this.renderer.init(); // Wait for assets to load

        // Start Loop
        this.loop.start();

        console.log('Game Initialized.');
    }

    startNewGame() {
        console.log('Starting New Game...');
        this.selectedEntity = null; // Ensure no selection on start
        this.state.initNewGame();
        this.ui.showScreen('hud');
        this.ui.showDialog("欢迎成为「街角衣铺」的经理！你将负责店铺整体运营，初始配备 1 名全能店员，一起把小店经营起来吧～");
        this.isRunning = true;
    }

    loadGame(slotId = 1) {
        console.log(`Loading Game from slot ${slotId}...`);
        this.selectedEntity = null; // Ensure no selection on load
        if (this.state.loadGame(slotId)) {
            this.ui.showScreen('hud');
            this.isRunning = true;
        } else {
            alert('没有找到存档！');
        }
    }

    update(dt) {
        if (!this.isRunning || this.isPaused) return;

        // In EDIT mode, we don't update game logic (time, entities), but we still render
        if (this.state.mode === 'EDIT') {
            // Only update effects if needed, or just skip entirely
            return;
        }

        this.state.update(dt);

        // Update Effects
        this.effects.forEach(e => {
            e.life -= dt;
            if (e.update) e.update(dt);
            if (e.type === 'floating_text') {
                e.y -= 10 * dt; // Float up
            }
        });
        this.effects = this.effects.filter(e => e.life > 0);
    }

    togglePause() {
        this.isPaused = !this.isPaused;
        this.ui.togglePauseMenu(this.isPaused);
    }

    render() {
        // Clear screen with light background
        this.ctx.fillStyle = '#f5f5f5';
        this.ctx.fillRect(0, 0, this.config.width, this.config.height);

        if (this.isRunning) {
            this.renderer.render(this.state);
        }
    }
}
