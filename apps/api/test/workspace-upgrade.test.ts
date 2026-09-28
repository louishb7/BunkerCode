import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdir, mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { LabRepository } from "../src/repository";
import { WorkspaceManager } from "../src/workspace";
import { projectRoot } from "../src/paths";

test("legacy surface upgrade preserves edited domain code and restoring its backup is not silently upgraded again", async () => {
  await mkdir(join(projectRoot(), ".bunkerlab"), { recursive: true });
  const root = await mkdtemp(
    join(projectRoot(), ".bunkerlab", "upgrade-test-"),
  );
  const repository = new LabRepository(root);
  const manager = new WorkspaceManager(root, repository);
  try {
    await manager.ensure("local", "orderdesk", "OrderDesk");
    const path = manager.path("local", "orderdesk");
    await rm(join(path, "surface.html"));
    await writeFile(
      join(path, "server.mjs"),
      await readFile(
        join(
          projectRoot(),
          "apps/api/test/fixtures/legacy-orderdesk-server.txt",
        ),
      ),
    );
    const customInventory = (
      await readFile(join(path, "inventory.mjs"), "utf8")
    ).replace('"naive"', '"atomic"');
    await writeFile(join(path, "inventory.mjs"), customInventory);
    await manager.upgradeSurface("local", "orderdesk");
    assert.equal(
      await readFile(join(path, "inventory.mjs"), "utf8"),
      customInventory,
    );
    assert.match(
      await readFile(join(path, "surface.html"), "utf8"),
      /Criar pedido/,
    );
    const checkpoints = repository.checkpoints("local", "orderdesk");
    const backup = checkpoints.find(
      (item) => item.message === "Antes de adicionar a surface",
    )!;
    assert.ok(backup);
    assert.equal(checkpoints[0]!.message, "Surface do sistema");
    await manager.restore("local", "orderdesk", backup);
    await assert.rejects(readFile(join(path, "surface.html")));
    await manager.upgradeSurface("local", "orderdesk");
    await assert.rejects(readFile(join(path, "surface.html")));
    assert.equal(
      await readFile(join(path, "inventory.mjs"), "utf8"),
      customInventory,
    );
  } finally {
    repository.close();
    await rm(root, { recursive: true, force: true });
  }
});

test("surface upgrades never overwrite a customized legacy server", async () => {
  const root = await mkdtemp(
    join(projectRoot(), ".bunkerlab", "upgrade-test-"),
  );
  const repository = new LabRepository(root);
  const manager = new WorkspaceManager(root, repository);
  try {
    await manager.ensure("local", "orderdesk", "OrderDesk");
    const path = manager.path("local", "orderdesk");
    await rm(join(path, "surface.html"));
    const custom =
      (await readFile(
        join(
          projectRoot(),
          "apps/api/test/fixtures/legacy-orderdesk-server.txt",
        ),
        "utf8",
      )) + "\n// Local custom server\n";
    await writeFile(join(path, "server.mjs"), custom);
    await manager.upgradeSurface("local", "orderdesk");
    assert.equal(await readFile(join(path, "server.mjs"), "utf8"), custom);
    await assert.rejects(readFile(join(path, "surface.html")));
    assert.equal(repository.checkpoints("local", "orderdesk").length, 1);
  } finally {
    repository.close();
    await rm(root, { recursive: true, force: true });
  }
});
