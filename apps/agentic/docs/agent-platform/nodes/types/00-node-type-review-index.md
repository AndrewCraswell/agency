# Node Type Review Index

Status: Complete

Last reviewed: 2026-07-20

This directory contains one numbered, source-backed review for every workflow node kind registered in
`stepRegistry.ts`. Numbers follow registry declaration order and remain stable while the node kind exists.

Each review applies the Competitive Expert, UX Expert, and User Researcher perspectives from the parent
[workflow node design review](../workflow-node-design-review.md). The documents identify fixes; they do not claim that
those fixes are implemented.

Use the [node type development best practices](../node-type-development-best-practices.md) as the shared standard when
turning review findings into node contracts, implementation plans, and acceptance criteria.

## Reviews

- [Manual run](01-manual-trigger.md) (`manual_trigger`)
- [Set fields](02-set-fields.md) (`set_fields`)
- [Map fields](03-map-fields.md) (`map_fields`)
- [Validate](04-validate.md) (`validate`)
- [Compose Markdown](07-compose-markdown.md) (`compose_markdown`)
- [Collect](08-collect.md) (`collect`)
- [Repository data](09-repository-data.md) (`repository_data`)
- [Repository agent](10-repository-agent.md) (`repository_agent`)
- [AI model](11-ai-model.md) (`ai_model`)
- [Structured judgment](12-structured-judgment.md) (`structured_judgment`)
- [Provider event](13-provider-event.md) (`provider_event`)
- [Schedule](14-schedule.md) (`schedule`)
- [Provider data](15-provider-data.md) (`provider_data`)
- [Provider action](16-provider-action.md) (`provider_action`)
- [Condition](17-condition.md) (`condition`)
- [Switch](18-switch.md) (`switch`)
- [Exclusive merge](19-exclusive-merge.md) (`exclusive_merge`)
- [Join](20-join.md) (`join`)
- [For each](21-for-each.md) (`for_each`)
- [Repeat](22-bounded-loop.md) (`bounded_loop`)
- [Wait event](23-wait-event.md) (`wait_event_github`, `wait_event_linear`)
- [Invoke workflow](24-child-workflow.md) (`child_workflow`)
- [Delay](25-delay.md) (`delay`)

## Required review structure

Every node review must include:

- registry identity and intended job;
- current configuration, ports, runtime behavior, persistence, evidence, editor controls, and tests;
- representative success, invalid, boundary, failure, retry, timeout, and recovery behavior where applicable;
- separate Competitive Expert, UX Expert, and User Researcher judgments;
- P0/P1/P2 findings grounded in source or observed acceptance evidence;
- a recommended target contract and authoring experience;
- a concrete fix checklist with acceptance criteria;
- dependencies on shared platform changes and unresolved product decisions.
