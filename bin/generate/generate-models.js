
export async function generateModels(ctx) {
  console.log(`Generating models`);
  const schema = await getSchema(ctx);
  console.log("GOT", schema)
}

async function getSchema({ cwd }) {
  const { schema } = await import(`${cwd}/+/schema.ts`);
  return schema
}
