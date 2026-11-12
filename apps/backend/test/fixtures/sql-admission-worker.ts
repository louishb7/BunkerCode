import { SqlAdmission, type SqlAction } from "../../src/sql/admission";
const admission = new SqlAdmission();
async function main() {
  const [operation, user, action] = process.argv.slice(2);
  try {
    const result =
      operation === "claim"
        ? await admission.claim()
        : await admission.consume(user!, action as SqlAction);
    console.log(JSON.stringify({ status: 200, owner: result }));
  } catch (error) {
    console.log(
      JSON.stringify({
        status:
          error instanceof Error && "status" in error ? error.status : 500,
      }),
    );
  } finally {
    await admission.close();
  }
}
void main();
