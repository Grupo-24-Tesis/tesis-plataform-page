export const IMAGES_MAX_AGE_MS = 10 * 60 * 1000;
export const FRESHNESS_CHECK_MS = 60 * 1000;

export class FreshnessTimer {
  private timer: ReturnType<typeof setTimeout> | undefined;
  private running = false;

  constructor(private readonly check: () => void) {}

  start(): void {
    this.running = true;
    this.schedule();
  }

  stop(): void {
    this.running = false;
    clearTimeout(this.timer);
  }

  private schedule(): void {
    this.timer = setTimeout(() => {
      if (!this.running) {
        return;
      }

      this.check();
      this.schedule();
    }, FRESHNESS_CHECK_MS);
  }
}
