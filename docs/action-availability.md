# Action availability

Consequential UI actions use the server-owned `ActionAvailability` contract:

- `key`, `allowed`, and `disabledReason`;
- `targetLabel` and `consequence`;
- `approvalRequirement` (`none`, `confirmation`, or `required`);
- `requiredCapability` when authorization depends on a provider or product capability.

Unavailable relevant actions remain visible. Their persistent reason is connected with `aria-describedby`, and Fluent's
focusable-disabled behavior lets keyboard and screen-reader users inspect that reason. A tooltip is not the only reason
surface. Each mutation owns its pending state; unrelated actions remain available.

## Decision points

| Action | Server decision point | Current enforcement |
| --- | --- | --- |
| Assign | Control-plane assignment service | Work-item state and selected agent |
| Publish, run | Workflow service | Saved revision, validation, active immutable version |
| Retry, retry from here | Workflow journal projection | Failed activation, committed descendants, unresolved effects |
| Cancel, resume | Workflow journal projection | Terminal run state or pending wait |
| Resolve effect | Workflow journal projection | Unknown or conflicting durable effect |
| Connect, reconnect, refresh | Integration service | Provider connection state |
| Disconnect | Integration service impact query | Connection state plus affected workflow references |

The web client can add transient duplicate-submit protection, but it must not invent authorization or recovery policy.

## Asynchronous status

`AsyncStatus` is the visible polite live region for saves, validation, tests, publication, run creation, and run
mutations. Toasts supplement completion; they are not the only status surface. Retryable input remains mounted when a
request fails.