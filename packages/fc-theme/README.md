# @repo/fc-theme

Fencing Club's Shopify Online Store theme.

## Layout

Shopify deploys the files in `assets/`, `blocks/`, `config/`, `layout/`, `locales/`, `sections/`, `snippets/`, and
`templates/`. The `Fencing Club/`, `images/`, and `FencingClubWebsite.pen` paths contain design source and reference
assets. `docs/` contains theme-specific research and implementation notes.

## Development

Authenticate the Shopify CLI, then start a development theme from the repository root:

```powershell
pnpm --filter @repo/fc-theme dev
```

This uploads to a development theme and watches local files. It does not publish the live theme.

Validate the Liquid theme locally:

```powershell
pnpm --filter @repo/fc-theme check:theme
```

The migrated theme currently has pre-existing Theme Check findings, so this command is not part of the monorepo lint
gate yet.

Create Shopify's uploadable theme ZIP:

```powershell
pnpm --filter @repo/fc-theme package
```

The ZIP contains only Shopify's standard theme directories. Generated ZIPs and local Shopify CLI state are ignored by
Git.

## Store synchronization

`pnpm --filter @repo/fc-theme pull` downloads a remote theme into this package. `pnpm --filter @repo/fc-theme push`
uploads local theme files. Review the selected store and theme before either operation; pushing does not publish a theme
unless explicit publish flags are supplied.
