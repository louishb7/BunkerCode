import { LabRepository } from "./repository";
import { dataRoot } from "./paths";
const repository = new LabRepository(dataRoot());
repository.close();
console.log("Migrations aplicadas.");
