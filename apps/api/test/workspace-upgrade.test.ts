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
    const customInventory =
      (await readFile(join(path, "inventory.mjs"), "utf8")) +
      "\n// Custom domain code\n";
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

for (const edited of [false, true])
  test(`guidance upgrade preserves legacy code and respects local edits (${edited})`, async () => {
    const root = await mkdtemp(
      join(projectRoot(), ".bunkerlab", "guidance-test-"),
    );
    const repository = new LabRepository(root);
    const manager = new WorkspaceManager(root, repository);
    try {
      await manager.ensure("local", "orderdesk", "OrderDesk");
      const path = manager.path("local", "orderdesk");
      await rm(join(path, "order-store.mjs"));
      for (const file of ["inventory.mjs", "database.mjs", "README.md"])
        await writeFile(
          join(path, file),
          await readFile(
            join(
              projectRoot(),
              "apps/api/test/fixtures/legacy-guidance",
              file.replace(".mjs", ".txt"),
            ),
          ),
        );
      if (edited)
        await writeFile(join(path, "inventory.mjs"), "// My implementation\n");
      await manager.upgradeGuidance("local", "orderdesk");
      if (edited) {
        assert.equal(
          await readFile(join(path, "inventory.mjs"), "utf8"),
          "// My implementation\n",
        );
        await assert.rejects(readFile(join(path, "order-store.mjs")));
      } else {
        assert.doesNotMatch(
          await readFile(join(path, "inventory.mjs"), "utf8"),
          /strategy/,
        );
        const backup = repository
          .checkpoints("local", "orderdesk")
          .find((item) => item.kind === "backup")!;
        assert.ok(backup);
        await manager.restore("local", "orderdesk", backup);
        await manager.upgradeGuidance("local", "orderdesk");
        assert.match(
          await readFile(join(path, "inventory.mjs"), "utf8"),
          /strategy/,
        );
        assert.equal(
          repository.checkpoints("local", "orderdesk")[0]!.kind,
          "restore",
        );
      }
    } finally {
      repository.close();
      await rm(root, { recursive: true, force: true });
    }
  });
