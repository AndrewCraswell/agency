# Operations query model

Operations has three views: overview, runs, and work queue. The selected view and work-queue query are typed URL search
state so links, reloads, and browser navigation restore the same result.

The work-queue contract supports:

- text, status, repository, assignee, priority, and age filters;
- priority, created, updated, and identifier sorting in either direction;
- opaque cursor pagination and a bounded page size;
- aggregate counts for filters and a total result count.

The API performs filtering, stable sorting, and pagination. The DataGrid renders the returned page and does not recreate
server policy locally. Polling the overview or runs view does not reset or refetch work-queue state.