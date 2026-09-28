# æme

## Getting started

Start the local database:

```bash
docker compose up -d
```

Copy the env file and install dependencies:

```bash
cp .dev.vars.example .dev.vars
yarn install
```

Push the schema to the local database:

```bash
yarn db:push
```

Start the dev server:

```bash
yarn dev
```
