# Workflow lifecycle

## Authoring and publication

A workflow has one mutable draft and, independently, zero or one active published version.

Every workflow is created with one required GitHub repository binding. Repository agents, repository data, GitHub
events, and GitHub actions inherit that workflow binding; individual steps cannot select or change the repository.
Provider-specific step entries also fix their provider identity. Non-repository resources such as Linear teams remain
explicit step bindings.

- Autosave updates the draft revision. It does not change the active version.
- Check and Test draft operate on the saved draft revision.
- Publish compiles an immutable execution package and makes that version active.
- Run published version always names and starts the active version. Invalid draft changes do not replace or disable an
  older active version.

The workflow repository, additional resource bindings, model selections, agent references, and step definitions are
sealed into the execution package.
Existing runs never read mutable draft configuration.

## Canonical run truth

The workflow execution journal is the only product run model. A run detail response projects:

- run state and immutable execution package;
- activations, attempts, waits, effects, data, and ordered events;
- one normalized outcome, current step, failure explanation, and server-owned actions.

There is no legacy run-detail fallback. Recovery mutations append or update journal state and preserve prior attempts and
evidence. Unknown provider effects must be resolved before retry can become available.