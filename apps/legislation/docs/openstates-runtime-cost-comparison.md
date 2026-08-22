# OpenStates scraper runtime and storage cost comparison

## Why this document exists

The legislation service plans to self-host the OpenStates scrapers because the hosted OpenStates API quota is too small for nationwide recurring synchronization. This document compares the three realistic places to run those scrapers while Trigger.dev remains the scheduler and workflow controller:

- Azure Container Apps Jobs
- AWS Fargate
- Cloudflare Containers

The first rollout will use Azure Container Apps Jobs because the PostgreSQL database, Blob storage, managed identity, network, and operational tooling already live in Azure. Cloudflare remains a credible later optimization if measured production workloads show a meaningful total saving.

This is a planning estimate, not an invoice forecast. Prices and assumptions were captured on **2026-08-19** and must be refreshed before a purchasing or migration decision.

## Proposed workload

Use one versioned scraper image and start parameterized job executions. Do not deploy one container application per scraper.

| Scraper lane | Intended frequency | Jurisdictions | Executions per day |
| --- | ---: | ---: | ---: |
| Bills | Every 30 minutes | 52 | 2,496 |
| Events | Every 2 hours | 52 | 624 |
| People and organizations | Daily | 52 | 52 |
| **Total** |  |  | **3,172** |

That is approximately **95,160 executions in a 30-day month**. The retained archives do not contain trustworthy publisher timestamps, so they cannot prove how many records change each day. Initial capacity planning must assume that a scraper may crawl its complete current session even when the resulting change set is small.

Before national rollout, a seven-day canary must record for every jurisdiction and lane:

- wall-clock duration and active CPU time;
- peak memory;
- requests made and bytes downloaded;
- artifacts and normalized records emitted;
- new, changed, and unchanged record counts;
- cache effectiveness;
- retry, throttle, parsing, and publisher errors.

## Compute pricing assumptions

The Azure and AWS estimates use **0.5 vCPU and 1 GiB RAM per execution**. Cloudflare does not currently offer that exact shape, so the table uses its **Basic** container with 0.25 vCPU, 1 GiB RAM, and 4 GB disk. A Cloudflare scraper may therefore run longer than the Azure or AWS equivalent.

Rates used:

| Provider | Meter used in estimate | Scale-to-zero and billing behavior |
| --- | --- | --- |
| Azure Container Apps Jobs, West US 2 | $0.1224 per vCPU-hour and $0.0144 per GiB-hour; monthly grant of 50 vCPU-hours and 100 GiB-hours | Per-second execution billing. A job has no compute charge when it has no running execution. |
| AWS Fargate, Linux x86, US West (Oregon) | $0.04048 per vCPU-hour and $0.004445 per GB-hour | Per-second billing with a one-minute minimum, including image-pull time. |
| Cloudflare Containers Basic | $0.018 per fully active 0.25-vCPU container-hour, $0.009 per provisioned GiB-hour, and $0.001008 per 4-GB disk-hour; $5 Workers Paid base | Ten-millisecond billing while the container is awake. CPU is charged on active use; provisioned memory and disk are charged while awake. It scales to zero after sleeping. |

Official pricing references:

- [Azure Container Apps pricing](https://azure.microsoft.com/en-us/pricing/details/container-apps/)
- [AWS Fargate pricing](https://aws.amazon.com/fargate/pricing/)
- [Cloudflare Containers pricing](https://developers.cloudflare.com/containers/pricing/)
- [Trigger.dev pricing](https://trigger.dev/pricing)

## Monthly compute scenarios

These figures assume all 95,160 scheduled executions start. They do not include log ingestion, public IP or NAT charges, cross-cloud transfer, database charges, or storage operations.

| Mean execution duration | Azure Container Apps Jobs | AWS Fargate | Cloudflare Basic Containers |
| ---: | ---: | ---: | ---: |
| 1 minute | about $112 | about $39 | about $49 |
| 3 minutes | about $352 | about $117 | about $138 |
| 5 minutes | about $592 | about $196 | about $226 |
| 10 minutes | about $1,191 | about $391 | about $448 |

Interpretation:

- AWS is cheapest on the normalized raw compute meters.
- Cloudflare Basic is close to AWS but supplies half the vCPU. If that doubles scraper duration, the advantage shrinks substantially.
- Azure is the most expensive compute option in this model, but it avoids moving source artifacts across clouds and reuses the existing identity, Blob, network, database, and monitoring environment.
- Short executions favor Azure and Cloudflare because Fargate has a one-minute minimum.
- Network-bound work may favor Cloudflare because CPU is charged only while active, but memory and disk remain provisioned while the container is awake.

## Trigger.dev orchestration cost

Trigger.dev should start and supervise the external container jobs, not run the Python scrapers inside Trigger workers. A parent can checkpoint while waiting for a callback or durable status poll, so the external job's wall time does not need to become Trigger compute time.

At 95,160 invocations per month:

| Active Trigger work per execution | Approximate invocation plus `small-1x` compute |
| ---: | ---: |
| 1 second | about $5.60 per month |
| 5 seconds | about $18.50 per month |

The Pro plan currently includes $50 of usage credit. Existing ingestion work shares that credit, so the actual incremental charge must be measured in the Trigger dashboard. Waitpoint time is excluded from managed compute billing.

## Storage comparison

The live Azure Blob account held approximately **306.8 GB** on 2026-08-19. Capacity-only estimates at that footprint are:

| Storage | Monthly capacity estimate | Important exclusions |
| --- | ---: | --- |
| Azure Blob Hot LRS, West US 2 | about $5.65 | Transactions, retrieval, replication changes, and monitoring |
| AWS S3 Standard, US West (Oregon) | about $7.06 | Requests and transfers back to Azure |
| Cloudflare R2 Standard | about $4.45 after the 10-GB free allowance | Class A and Class B operations |

References:

- [Azure Blob Storage pricing](https://azure.microsoft.com/en-us/pricing/details/storage/blobs/)
- [Amazon S3 pricing](https://aws.amazon.com/s3/pricing/)
- [Cloudflare R2 pricing](https://developers.cloudflare.com/r2/pricing/)

R2's capacity saving at the present corpus size is only about one or two dollars per month. Moving the authoritative store for that saving alone would not be worthwhile. Its free egress could become material if the corpus grows substantially or serves high public download volume.

## Cross-cloud costs and operational effects

Running compute outside Azure while retaining Azure Blob and PostgreSQL can add:

- Azure outbound data-transfer charges;
- public networking or private-connectivity configuration;
- additional secrets and workload identity systems;
- higher request latency and more failure boundaries;
- duplicate logs, alerts, budgets, and incident procedures;
- artifact staging or replication costs.

Those costs are not included in the compute table and can outweigh a small meter-price advantage.

## Current decision

Start with this architecture:

1. Trigger.dev creates a bounded, phase-shifted wave of scraper executions.
2. Each execution starts the same Azure Container Apps Job image with jurisdiction, scraper lane, session, and checkpoint parameters.
3. The job writes immutable source artifacts to Azure Blob and normalized records to PostgreSQL through bounded ingestion APIs or transactions.
4. A callback or checkpointed Trigger poll records completion, metrics, and retry state.
5. Publisher-specific concurrency and cooldown policies remain durable and globally enforced.

## When to reconsider Cloudflare

Evaluate Cloudflare Containers after at least seven days of representative Azure canary data. A migration deserves a proof-of-concept when all of these are true:

- scraper images run without incompatible native or browser dependencies;
- Cloudflare Basic or another available instance type achieves acceptable p95 duration;
- total compute, Worker, Durable Object, logging, and network cost is at least 20% below Azure;
- Azure egress does not erase the saving, or an intentional R2 replication plan has been approved;
- execution isolation, retry behavior, observability, and regional placement meet the same operational requirements;
- the team accepts the additional cloud control plane.

Use measured active CPU, memory, duration, and transfer data in that decision. Do not decide from list prices alone.

## Refresh checklist

Before revisiting this comparison:

1. Update the price date and all retail meters.
2. Replace the duration scenarios with measured p50 and p95 values by scraper lane.
3. Include actual Azure Blob egress and operation counts.
4. Include Trigger invocation and compute usage from the billing export.
5. Include logging, registry, NAT or public IP, and monitoring charges.
6. Model retry amplification for the least reliable publishers.
7. Compare a complete monthly bill, not only vCPU rates.
