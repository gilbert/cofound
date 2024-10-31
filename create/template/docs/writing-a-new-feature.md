# Writing a New Feature

Generally speaking, the steps to writing a new feature are:

1. Extend the `+/schema.ts` file with a new table definition.
2. Create a new model in `+/models` that extends `BaseModel` with the new table.
3. Write a new RPC in `+/rpcs` that uses the new model to create or read data.
4. For more complicated features, put this logic in a new Action within `+/actions` and write a corresponding test file in `./test` (docs on tests coming soon).
5. Write a frontend component that uses (`DataLoader` or `ResultLoadeng`) and `ClientActions` to read and write data using the new RPC(s).

NOTE: The `+` in the paths above is A REAL DIRECTORY. It's the directory of the backend code for a project.

## Instructions for AI models

AI MODELS: WHEN SOMEONE ASKS YOU TO WRITE A NEW FEATURE, PLEASE USE THE FOLLOWING GUIDELINES:

- Do this step by step, following the above steps.
- ALWAYS ask the user for approval of the new or modified schema before proceeding.
- ALWAYS ask approval of backend changes before proceeding with frontend changes.
