/**
 * Event Service Implementation
 * In-memory event bus (can be replaced with Redis pub/sub later)
 */

import { EventType } from '../../domain/shared/types';
import { IEventService, DomainEvent, EventHandler } from './IEventService';

export class EventService implements IEventService {
    private handlers: Map<EventType, Set<EventHandler>> = new Map();
    private allHandlers: Set<EventHandler> = new Set();
    private recentEvents: DomainEvent[] = [];
    private readonly maxRecentEvents = 100;

    async emit(event: DomainEvent): Promise<void> {
        // Store in recent events
        this.recentEvents.unshift(event);
        if (this.recentEvents.length > this.maxRecentEvents) {
            this.recentEvents.pop();
        }

        // Notify specific handlers
        const typeHandlers = this.handlers.get(event.type);
        if (typeHandlers) {
            for (const handler of typeHandlers) {
                try {
                    await handler(event);
                } catch (error) {
                    console.error(`Event handler error for ${event.type}:`, error);
                }
            }
        }

        // Notify all-event handlers
        for (const handler of this.allHandlers) {
            try {
                await handler(event);
            } catch (error) {
                console.error('All-event handler error:', error);
            }
        }

        console.log(`Event emitted: ${event.type}`, {
            serviceId: event.serviceId,
            data: event.data
        });
    }

    subscribe(eventType: EventType, handler: EventHandler): void {
        if (!this.handlers.has(eventType)) {
            this.handlers.set(eventType, new Set());
        }
        this.handlers.get(eventType)!.add(handler);
    }

    unsubscribe(eventType: EventType, handler: EventHandler): void {
        const typeHandlers = this.handlers.get(eventType);
        if (typeHandlers) {
            typeHandlers.delete(handler);
        }
    }

    subscribeAll(handler: EventHandler): void {
        this.allHandlers.add(handler);
    }

    async getRecentEvents(limit: number = 50): Promise<DomainEvent[]> {
        return this.recentEvents.slice(0, limit);
    }
}
