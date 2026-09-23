import { Injectable, Logger } from '@nestjs/common';
import { ApplicationEvent } from './interfaces/application-event.interface';

export type EventHandler<T extends ApplicationEvent = ApplicationEvent> = (
  event: T,
) => Promise<void> | void;

@Injectable()
export class EventBusService {
  private readonly logger = new Logger(EventBusService.name);
  private readonly handlers = new Map<string, EventHandler[]>();

  /**
   * Register a subscriber handler for a specific event name.
   */
  subscribe<T extends ApplicationEvent = ApplicationEvent>(
    eventName: string,
    handler: EventHandler<T>,
  ): void {
    const existing = this.handlers.get(eventName) || [];
    existing.push(handler as EventHandler);
    this.handlers.set(eventName, existing);
  }

  /**
   * Publish an application event to all registered subscribers.
   * Execution is isolated so subscriber failures do not crash the publisher.
   */
  async publish<T extends ApplicationEvent = ApplicationEvent>(
    event: T,
  ): Promise<void> {
    const subscribers = this.handlers.get(event.eventName) || [];
    if (subscribers.length === 0) {
      return;
    }

    // Execute handlers asynchronously with error isolation
    const executions = subscribers.map(async (handler) => {
      try {
        await handler(event);
      } catch (error: unknown) {
        const errMsg = error instanceof Error ? error.message : 'Unknown error';
        this.logger.error(
          `Error executing handler for event "${event.eventName}": ${errMsg}`,
          error instanceof Error ? error.stack : undefined,
        );
      }
    });

    await Promise.all(executions);
  }

  /**
   * Clear all registered handlers (used primarily for test isolation).
   */
  clear(): void {
    this.handlers.clear();
  }
}
