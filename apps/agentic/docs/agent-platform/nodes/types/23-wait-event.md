# Wait Event Node Review

Status: Implemented

Last reviewed: 2026-07-20

## Identity and intended job

The registry exposes `wait_event_github@1` as **Wait event (GitHub)** and `wait_event_linear@1` as **Wait event (Linear)**. Each node durably pauses a running workflow until one selected provider event arrives for one object in the workflow's sealed resource, or until its configured deadline.

The provider is part of the node type. Authors never select a provider or enter a correlation key. GitHub uses the workflow's locked repository binding. Linear requires a team chosen from sealed connected resources because a repository binding does not identify a Linear team.

## Configuration and ports

Both nodes require an event, an `objectIdPath` into the node input, a sealed resource binding, a bounded expiry, and an explicit timeout policy. The maximum wait is 30 days. The provider event catalog supplies the available event choices.

The required **Input** port accepts the object data used to resolve the provider object ID. **Event received** emits the normalized provider event. **Timed out** emits deadline, elapsed seconds, and a digest of the internal correlation key when timeout routing is selected. Provider authentication and duplicate delivery disposition remain ingress concerns rather than workflow branches.

## Authoring

The inspector shows Event, Object ID from input, Wait up to, and On timeout. GitHub shows the workflow repository as read-only. Linear shows only eligible teams and has no provider picker. Correlation and event JSON Schema are not exposed.

## Runtime and persistence

At suspension, the executor derives an internal key from provider, sealed resource ID, selected event key, and the object ID resolved from input. Provider webhook normalization derives the same key only after the existing authenticated receipt path accepts the delivery. Including the event key prevents another action on the same object from resuming the wait.

The journal transaction fences the running attempt, persists the deadline, marks the activation and run waiting, and releases the worker lease. A matching event atomically claims the pending unexpired record, succeeds the attempt, and creates downstream activations. Expiry uses the same locked record to choose one winner. Event resumption and timeout therefore remain durable across worker restart and cannot both schedule downstream work.

## Validation and evidence

Compilation requires the resource binding to be present in the workflow's sealed resources and to match the node's fixed provider. A routed timeout must have a connected **Timed out** edge; a failing timeout cannot have one. Runtime rejects a missing or non-string object ID.

Journal evidence records waiting, resumption, or timeout with the internal correlation digest. Focused executor, service, compiler, and journal tests cover derived correlation, provider webhook resumption, sealed bindings, event-versus-expiry predicates, and timeout routing.

## Remaining limits

The object ID path is a dot-path input rather than a schema field picker. Normalized provider events currently expose identity metadata rather than a provider-specific closed payload schema. Rejected and duplicate webhook deliveries are handled by ingress but are not yet shown as node-centered evidence.
