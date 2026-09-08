# Shopify Content Installer

Reusable, dependency-ordered Shopify content provisioning through the authenticated Shopify CLI.

Commands: `validate`, `pack`, `plan`, and `apply`. The default is to create missing resources and keep existing content.
Writes require an explicit destination and matching confirmation. Content replacement is opt-in per resource key.

See [the installation guide](../../docs/shopify-content-installation.md) for the manifest contract, authentication,
supported resources, failure handling, and the Fencing Club starter pack.

This package does not deploy or publish themes. Its source CLI runs under Node 24+ with the workspace's `tsx` runner.
