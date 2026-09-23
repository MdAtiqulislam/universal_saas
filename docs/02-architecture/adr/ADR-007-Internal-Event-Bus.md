# ADR-007: In-Process Application Event Bus Architecture

**Status:** ACCEPTED  
**Date:** 2026-08-28  
**Deciders:** Senior Software Architect, Systems Architect  
**Technical Milestone:** M06 — Audit Logging & System Event Bus Foundation

---

## Context & Problem Statement

To decouple business operations (e.g. creating organizations, updating roles, inviting members) from side-effect execution (audit logging, analytics, notification triggers), the application requires an event publishing mechanism.

We evaluated:

- **Option A:** External distributed message brokers (Kafka, RabbitMQ, Redis Streams).
- **Option B:** Direct synchronous service-to-service method calls (`AuditService.record()` invoked manually in every controller/service).
- **Option C:** Lightweight in-process event bus with error-isolated asynchronous dispatching.

---

## Decision Drivers

1. **Simplicity & Zero Operational Overhead in Early Milestones:** Avoid managing external broker clusters, connection pools, and broker schema registries before distributed requirements exist.
2. **Decoupled Architecture:** Domain services must not be tightly coupled to audit logging or notification implementations.
3. **Resilience & Error Isolation:** Failures in event subscribers (such as audit log database hiccups) must not fail the primary business transaction.
4. **Clean Evolution Path:** The event interface (`ApplicationEvent`, `EventBusService`) should allow seamless future migration to the Transactional Outbox Pattern and distributed brokers (Kafka/RabbitMQ) without refactoring domain services.

---

## Decision Outcome

**Chosen Option:** **Option C (In-process EventBusService with subscriber error isolation)**.

### Architectural Rules

1. **Contract:** Events implement `ApplicationEvent { readonly eventName: string; readonly occurredAt: Date; }`.
2. **Asynchronous Non-Blocking Dispatch:** `EventBusService.publish()` delivers events to registered subscribers in parallel with `Promise.all()`.
3. **Subscriber Error Isolation:** Subscriber exceptions are caught and logged, preventing subscriber errors from aborting calling domain flows.
4. **No Mutable Global State:** Tenant and actor contexts are explicitly carried on event payloads.

### Positive Consequences

- Zero external broker infrastructure required.
- Clear separation of concerns between domain services and side effects.
- Direct path to future Outbox pattern migration when distributed event guarantees are required.
