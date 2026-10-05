<script setup>
import variables from "./variables";
</script>

# Installation

Use the following docker-compose file:

```yaml
services:
  ryot-db:
    image: postgres:18-alpine # at-least version 15 is required
    restart: unless-stopped
    container_name: ryot-db
    volumes:
      - postgres_storage:/var/lib/postgresql
    environment:
      - TZ=Europe/Amsterdam
      - POSTGRES_DB=postgres
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=postgres

  ryot:
    image: ghcr.io/sorahn/ryot:latest # prefer a tested commit tag or digest
    pull_policy: always
    container_name: ryot
    restart: unless-stopped
    ports:
      - "8000:8000"
    environment:
      - TZ=Europe/Amsterdam
      - FRONTEND_URL=https://ryot.your-domain.com # IP address is fine too
      - DATABASE_URL=postgres://postgres:postgres@ryot-db:5432/postgres # REQUIRED
      - SERVER_ADMIN_ACCESS_TOKEN=28ebb3ae554fa9867ba0 # REQUIRED: set to a long random string

volumes:
  postgres_storage:
```

Some providers (eg: TMDB for movies, IGDB for video games) need access tokens. Please visit
the [configuration](./configuration.md) page for more information.

## Features in this fork

This modified GPLv3 fork enables the existing self-hosted Pro features by default.
No `SERVER_PRO_KEY` or subscription is required. See [feature availability](./concepts/pro-key.md)
for configuration requirements. This is not an official Ryot release.

## Releases

Fork builds are published to [GitHub Container Registry](https://github.com/sorahn/ryot/pkgs/container/ryot)
for AMD64 and ARM64. The `latest` and `develop` tags follow the fork's main branch;
prefer a tested commit tag or digest for deployment. Upstream images do not include
this fork's changes. Back up your database before upgrades.

## Telemetry

Ryot collects anonymous usage data to help me prioritize features. It uses a self-hosted
[Umami](https://umami.is) instance to collect this data. In addition to page views, a
few events are also tracked and you can find them in the [source code](https://github.com/IgnisDa/ryot/blob/aa89adabc377e6da7fb8c8d768325efc3667329f/apps/frontend/app/lib/hooks.ts#L199-L222).

You can opt out of this by setting a configuration parameter as described
[configuration guide](./configuration.md#important-parameters).
