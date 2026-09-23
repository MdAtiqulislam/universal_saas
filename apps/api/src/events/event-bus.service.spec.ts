import { Test, TestingModule } from '@nestjs/testing';
import { EventBusService } from './event-bus.service';
import { ApplicationEvent } from './interfaces/application-event.interface';

describe('EventBusService', () => {
  let eventBus: EventBusService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [EventBusService],
    }).compile();

    eventBus = module.get<EventBusService>(EventBusService);
  });

  it('1. should allow subscribing and publishing events to a subscriber', async () => {
    const handler = jest.fn();
    const event: ApplicationEvent = {
      eventName: 'TEST_EVENT',
      occurredAt: new Date(),
    };

    eventBus.subscribe('TEST_EVENT', handler);
    await eventBus.publish(event);

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(event);
  });

  it('2. should deliver published event to multiple subscribers', async () => {
    const handler1 = jest.fn();
    const handler2 = jest.fn();
    const event: ApplicationEvent = {
      eventName: 'BROADCAST_EVENT',
      occurredAt: new Date(),
    };

    eventBus.subscribe('BROADCAST_EVENT', handler1);
    eventBus.subscribe('BROADCAST_EVENT', handler2);

    await eventBus.publish(event);

    expect(handler1).toHaveBeenCalledTimes(1);
    expect(handler2).toHaveBeenCalledTimes(1);
  });

  it('3. should handle asynchronous subscriber execution', async () => {
    let flag = false;
    const asyncHandler = async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      flag = true;
    };

    eventBus.subscribe('ASYNC_EVENT', asyncHandler);
    await eventBus.publish({
      eventName: 'ASYNC_EVENT',
      occurredAt: new Date(),
    });

    expect(flag).toBe(true);
  });

  it('4. should isolate subscriber errors without crashing the publisher', async () => {
    const failingHandler = jest.fn().mockImplementation(() => {
      throw new Error('Subscriber crash!');
    });
    const succeedingHandler = jest.fn();

    eventBus.subscribe('FAULTY_EVENT', failingHandler);
    eventBus.subscribe('FAULTY_EVENT', succeedingHandler);

    await expect(
      eventBus.publish({ eventName: 'FAULTY_EVENT', occurredAt: new Date() }),
    ).resolves.not.toThrow();

    expect(failingHandler).toHaveBeenCalledTimes(1);
    expect(succeedingHandler).toHaveBeenCalledTimes(1);
  });

  it('5. should do nothing when publishing an event with no subscribers', async () => {
    await expect(
      eventBus.publish({
        eventName: 'UNSUBSCRIBED_EVENT',
        occurredAt: new Date(),
      }),
    ).resolves.not.toThrow();
  });
});
