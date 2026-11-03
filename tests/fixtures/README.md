# Query fixtures

`ants-queries.json` is copied from the Ants query language
([ants-android](https://github.com/dergigi/ants) `grammar/fixtures/queries.json`, language version 1, MIT License, © dergigi).
`tests/query.test.ts` runs it against `src/services/QueryPlanner.ts`. Ants adds default kinds to
branches without a `kind:`; the test passes the fixture's `defaultKinds`, while the app uses none.
