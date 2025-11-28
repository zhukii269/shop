export default class Loop {
    constructor(updateFn, renderFn) {
        this.updateFn = updateFn;
        this.renderFn = renderFn;

        this.lastTime = 0;
        this.accumulator = 0;
        this.step = 1 / 60; // Fixed time step 60fps
        this.rafId = null;
    }

    start() {
        this.lastTime = performance.now();
        this.rafId = requestAnimationFrame(this.frame.bind(this));
    }

    stop() {
        if (this.rafId) {
            cancelAnimationFrame(this.rafId);
            this.rafId = null;
        }
    }

    frame(currentTime) {
        const deltaTime = (currentTime - this.lastTime) / 1000; // Convert to seconds
        this.lastTime = currentTime;

        // Cap deltaTime to prevent spiral of death if tab is inactive
        const safeDelta = Math.min(deltaTime, 0.1);

        this.accumulator += safeDelta;

        while (this.accumulator >= this.step) {
            this.updateFn(this.step);
            this.accumulator -= this.step;
        }

        this.renderFn();

        this.rafId = requestAnimationFrame(this.frame.bind(this));
    }
}
