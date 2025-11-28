export default class Input {
    constructor(game) {
        this.game = game;
        this.mouse = { x: 0, y: 0, isDown: false };
    }

    init() {
        const canvas = this.game.canvas;

        // Mouse Events
        window.addEventListener('mousemove', (e) => {
            this.updateMousePos(e.clientX, e.clientY);
            if (this.game.state && this.game.state.handleMouseMove) {
                this.game.state.handleMouseMove(this.mouse.x, this.mouse.y);
            }
        });

        canvas.addEventListener('mousedown', (e) => {
            this.mouse.isDown = true;
            this.updateMousePos(e.clientX, e.clientY);
            if (this.game.state && this.game.state.handleMouseDown) {
                this.game.state.handleMouseDown(this.mouse.x, this.mouse.y);
            }
        });

        window.addEventListener('mouseup', () => {
            this.mouse.isDown = false;
            if (this.game.state && this.game.state.handleMouseUp) {
                this.game.state.handleMouseUp();
            }
        });

        // Touch Events
        canvas.addEventListener('touchstart', (e) => {
            e.preventDefault(); // Prevent scrolling
            if (e.touches.length > 0) {
                const touch = e.touches[0];
                this.mouse.isDown = true;
                this.updateMousePos(touch.clientX, touch.clientY);
                if (this.game.state && this.game.state.handleMouseDown) {
                    this.game.state.handleMouseDown(this.mouse.x, this.mouse.y);
                }
            }
        }, { passive: false });

        window.addEventListener('touchmove', (e) => {
            e.preventDefault();
            if (e.touches.length > 0) {
                const touch = e.touches[0];
                this.updateMousePos(touch.clientX, touch.clientY);
                if (this.game.state && this.game.state.handleMouseMove) {
                    this.game.state.handleMouseMove(this.mouse.x, this.mouse.y);
                }
            }
        }, { passive: false });

        window.addEventListener('touchend', (e) => {
            this.mouse.isDown = false;
            if (this.game.state && this.game.state.handleMouseUp) {
                this.game.state.handleMouseUp();
            }
        });
    }

    updateMousePos(clientX, clientY) {
        const canvas = this.game.canvas;
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;

        // Convert to Logical Coordinates (160x128)
        const logicalScale = this.game.config.scale;
        this.mouse.x = ((clientX - rect.left) * scaleX) / logicalScale;
        this.mouse.y = ((clientY - rect.top) * scaleY) / logicalScale;
    }

    handleCanvasClick() {
        // Deprecated, logic moved to handleMouseDown
    }
}
