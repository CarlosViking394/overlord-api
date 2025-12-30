/**
 * Event Service Interface
 * For pub/sub communication between services
 */

import { EventType } from '../../domain/shared/types';

export interface DomainEvent {
    type: EventType;
    serviceId?: string;
    timestamp: Date;
    data?: Record<string, unknown>;
}

export type EventHandler = (event: DomainEvent) => Promise<void>;

export interface IEventService {
    /**
     * Emit an event
     */
    emit(event: DomainEvent): Promise<void>;

    /**
     * Subscribe to events of a specific type
     */
    subscribe(eventType: EventType, handler: EventHandler): void;

    /**
     * Unsubscribe from events
     */
    unsubscribe(eventType: EventType, handler: EventHandler): void;

    /**
     * Subscribe to all events
     */
    subscribeAll(handler: EventHandler): void;

    /**
     * Get recent events
     */
    getRecentEvents(limit?: number): Promise<DomainEvent[]>;
}
