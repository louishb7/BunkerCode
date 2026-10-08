# Union types

> **Exemplo inicial.** Conteúdo demonstrativo para provar leitura, exemplos e navegação. Escreva aqui seu próprio entendimento quando estudar o tema.

Uma union descreve alternativas possíveis. Antes de usar uma operação específica, o programa pode precisar distinguir qual alternativa recebeu.

```typescript
// ─── Tipos e Enums ───────────────────────────────────────────
type ID = string | number;

enum Status {
  Pending = "PENDING",
  Active = "ACTIVE",
  Done = "DONE",
}

interface User<T = unknown> {
  readonly id: ID;
  name: string;
  email?: string;
  status: Status;
  meta: T;
}

// ─── Classe genérica com decorator ───────────────────────────
function log(target: any, key: string, descriptor: PropertyDescriptor) {
  const original = descriptor.value;
  descriptor.value = function (...args: unknown[]) {
    console.log(`[log] ${key}(${args.join(", ")})`);
    return original.apply(this, args);
  };
}

class Repository<T extends { id: ID }> {
  private items = new Map<ID, T>();

  constructor(private readonly label: string = "repo") {}

  @log
  add(item: T): this {
    this.items.set(item.id, item);
    return this;
  }

  find(predicate: (item: T) => boolean): T | undefined {
    return [...this.items.values()].find(predicate);
  }

  get size(): number {
    return this.items.size;
  }

  *[Symbol.iterator](): Iterator<T> {
    yield* this.items.values();
  }
}

// ─── Async/Await + Promise + destructuring ───────────────────
async function fetchUser(id: ID): Promise<User<{ score: number }>> {
  await new Promise((r) => setTimeout(r, 100));
  return {
    id,
    name: "Ada Lovelace",
    email: "ada@example.com",
    status: Status.Active,
    meta: { score: 42 },
  };
}

// ─── Uso ─────────────────────────────────────────────────────
(async () => {
  const repo = new Repository<User>();
  const user = await fetchUser(1);
  repo.add(user);

  const { name, meta: { score } } = user;
  const found = repo.find((u) => u.status === Status.Active);

  console.log(`${name} tem score ${score} — encontrado: ${found?.name ?? "nada"}`);
  console.log(`Total: ${repo.size}`);
})();
```

## Uma pergunta para a revisão

Por que chamar `toFixed` antes da condição não serve para todos os valores aceitos pela função?

## Prática opcional

O exercício de reserva de estoque está disponível ao fim da lição. Ele usa decisões e retornos tipados; não avalia domínio de union types. Você pode ler esta lição sem abrir ou executar o exercício.

## Referência

- [TypeScript Handbook: Union Types](https://www.typescriptlang.org/docs/handbook/2/everyday-types.html#union-types)
