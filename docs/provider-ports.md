# Provider ports

Provider integrations are split into discovery and execution ports. Workflow services depend on these normalized ports,
not on provider-specific API branches.

## Discovery

`ProviderResourcePort` discovers bindable resources for one provider and resource type. The integration service supplies
a connection-scoped transport and persists the normalized resource identifiers, names, and capabilities returned by the
port.

## Events

Provider resource ports advertise the workflow events supported by that adapter. Each definition supplies a stable
normalized event key and a customer-facing label. The integration API aggregates these definitions for authoring, so
the workflow editor does not maintain provider-specific event lists or defaults.

The same port normalizes forwarded webhook object types and actions into its advertised keys. Published triggers retain
the sealed resource type and external resource ID, and incoming events must match that resource scope as well as the
provider and event key. Adding or changing a provider event therefore stays within its adapter and does not require a
workflow service or editor branch.

## Execution

`ProviderExecutionPort` performs reads and actions for one provider and resource type. The workflow executor retains
ownership of operation validation, sealed resource lookup, and durable effect reservation. It passes the selected port:

- a connection-scoped request transport;
- the validated operation name;
- the immutable resource binding; and
- the normalized query or action request.

Default GitHub and Linear adapters translate those values into REST or GraphQL calls. Tests may inject fixture adapters
through `ProviderExecutionPortResolver`; adding another provider does not require another branch in the workflow
executor.

Provider actions remain subject to the journal protocol: reserve, begin dispatch, execute through the port, then confirm
or classify an unknown outcome. Adapter substitution must not bypass this sequence.