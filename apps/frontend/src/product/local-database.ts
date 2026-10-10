// Schema 2 adds stores without rewriting or deleting schema-1 drafts.
export function localDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("bunkercode-practice", 2);
    let settled = false;
    const timer = window.setTimeout(() => {
      settled = true;
      reject(new Error("Armazenamento local indisponível."));
    }, 4000);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("drafts")) {
        db.createObjectStore("drafts", { keyPath: "key" }).createIndex(
          "scope",
          "scope",
        );
      }
      if (!db.objectStoreNames.contains("activity"))
        db.createObjectStore("activity", { keyPath: "key" });
      if (!db.objectStoreNames.contains("submissions")) {
        db.createObjectStore("submissions", { keyPath: "id" }).createIndex(
          "scope",
          "scope",
        );
      }
    };
    request.onerror = () => {
      clearTimeout(timer);
      settled = true;
      reject(request.error);
    };
    request.onblocked = () => {
      clearTimeout(timer);
      settled = true;
      reject(
        new Error(
          "Feche abas antigas para atualizar o armazenamento local. Seus dados foram preservados.",
        ),
      );
    };
    request.onsuccess = () => {
      clearTimeout(timer);
      if (settled) request.result.close();
      else {
        settled = true;
        request.result.onversionchange = () => request.result.close();
        resolve(request.result);
      }
    };
  });
}
