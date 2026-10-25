# Local Docker disk hygiene

Mandatory for this repository and its linked worktrees. Keep useful development,
test, release and recovery resources; prevent redundant local artifacts accumulating.
The database-preservation rules in `AGENTS.md` always take precedence.

## Before creating anything

1. Read the site-completion tracker and inspect the current worktrees and workflow.
   Check `docker context show`, `docker ps -a`, `docker image ls`, `docker system df`,
   registered builders, and available host disk space. Never dump container environment
   variables, populated application specs, credentials or customer data.
2. Reuse an existing image for the exact source/platform when its build evidence is
   valid. Use existing dependencies, shared layers and a single suitable builder.
   A second tag on the same image is not a second full image; do not sum tag sizes.
3. Build/test only what is required. The release runner currently validates a complete
   four-image manifest: do not bypass required API/worker/migration checks or alter
   release semantics to save space. Reuse valid release evidence where supported.
4. Keep build contexts small using the existing `.dockerignore`. Do not copy local
   dependencies, build outputs, caches, secrets or archives into the context. Avoid
   `--no-cache`, extra builders/platforms and exported image tarballs without a reason.
5. Give disposable test resources a unique task name/label and use `--rm` where
   appropriate. Choose task-scoped temporary storage deliberately; an anonymous
   PostgreSQL volume is still a database, not disposable merely because it has no name.
   Record cleanup ownership and use `try/finally` for temporary resources.

## Required retention review

Preserve all images referenced by running **or stopped** containers; actual current
production/staging component digests; pending releases or ongoing investigations;
the agreed rollback targets (normally the two preceding successful deployments);
recent builds being reviewed; useful base/database/tool images; and other tasks'
resources. Recheck the deployed component digests: one release may combine an API
from one commit and workers/migration from another. A tracker alone may be stale.

Also inspect linked-worktree HEADs and current build/release receipts. Historical
receipts remain evidence; their existence does not require every superseded local
image to remain forever. Confirm that a historical release is superseded and outside
active/rollback/testing retention before deleting its local copy. Preserve remote
registry images and release/recovery receipts during local disk maintenance.

Neither age, a dangling tag, nor Docker's "reclaimable" classification proves lack
of value. Protect recent useful caches: deleting them only to download/rebuild them
immediately wastes disk writes and time. If a resource's role is unknown, retain it
and report the uncertainty instead of guessing.

## Bounded cleanup at task completion

- Remove only explicitly reviewed, superseded project image references. Immediately
  before each removal, recheck image ID/tags, protected digests and all container
  references. Use `docker image rm` with exact references and **no force**. Stop if
  Docker refuses, references change, or another task acquires the image.
- Review build-cache age and actual reuse, not just creation time. With no conflicting
  build, the conservative maintenance command below targets unshared, inactive cache
  not used for at least 24 hours while preserving package-manager cache mounts:

  ```powershell
  docker buildx prune --builder desktop-linux --force --filter "until=24h" --filter "inuse=false" --filter "shared=false" --filter "type!=exec.cachemount"
  ```

  Confirm the actual builder/context first; `desktop-linux` is this machine's current
  local builder, not a portable assumption. Change the age/scope only with evidence
  that the additional cache is redundant. Keep warm dependency/build layers needed
  by the current workflow. Review growing cache usage rather than allowing unlimited
  accumulation; do not install an indiscriminate scheduled prune.
- A stopped, unregistered BuildKit container/cache volume may be redundant. Verify
  the container image, stopped state, registered-builder endpoints, exact volume and
  `/var/lib/buildkit` mount, and absence of any other consumer. Only then remove that
  specific abandoned builder container and its verified **build-cache-only** volume.
  This is not permission to delete anonymous database volumes or other data volumes.
- Do not remove other tasks' stopped containers, database storage, backups, registry
  images, source worktrees, dependencies or application outputs as an incidental
  "cleanup". Deleting application/test databases follows the separate database rules.
- Never use blanket `docker system prune -a`, broad image/container/volume pruning,
  `docker compose down -v`, forced removal, factory reset, or direct Docker/WSL/VHDX
  deletion. Do not stop Docker or all WSL distributions to force disk compaction
  during an unrelated workflow. Use supported maintenance only after checking impact.

## Evidence and completion

Record selected IDs/tags, retention reasons, successful removals and before/after
Docker totals. Keep receipts small and free of secrets; do not create a full image
backup merely to delete a redundant copy. Verify retained images and container/data
volume identities afterward. Report both Docker-reclaimed space and host free space:
Docker Desktop's virtual disk may release host space asynchronously, so logical image
sizes and VHDX file length are not evidence of physical bytes reclaimed on Windows.

This policy is an agent/reviewer requirement, not background automation. Do not claim
that a Markdown rule automatically enforces Docker's garbage-collection settings.

References: [Docker resource pruning](https://docs.docker.com/engine/manage-resources/pruning/)
and [Buildx prune filters](https://docs.docker.com/reference/cli/docker/buildx/prune/).
