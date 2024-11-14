# Bluesky Counter Backend API

This is a simple bluesky user counter backend API.

## Usage

```ts
deno run --allow-net --unstable-kv index.ts
```

## Pushing to GHCR

```sh
docker buildx build --platform linux/amd64,linux/arm64 -t ghcr.io/espeon/bcounter-backend/backend:latest --push .
```