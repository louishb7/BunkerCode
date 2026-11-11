import {
  parseSqlSteps,
  sqlObject,
  sqlId,
  sqlVersion,
  publicSqlExercise,
} from "@bunkercode/content/sql";
import { evaluateSql, stopSqlRuns } from "./runner";
import { ContentReader } from "../content/content-reader";
import { lessonSqlPlacement } from "@bunkercode/content";
import {
  ConflictException,
  HttpException,
  BadRequestException,
  Inject,
  Injectable,
} from "@nestjs/common";
import { AuthService } from "../auth/auth.service";
import { LearningService } from "../learning/learning.service";
import { SqlContent, sqlRevision } from "./content";
import { dirname, join } from "node:path";
import type { OperationalConfig } from "../operational-profile";
export const SQL_CONFIG = Symbol("SQL_CONFIG");
export function sqlInput<T>(work: () => T): T {
  try {
    return work();
  } catch (error) {
    if (error instanceof Error && !("getStatus" in error))
      throw new BadRequestException(error.message);
    throw error;
  }
}
@Injectable()
export class SqlService {
  readonly content: SqlContent;
  private readonly recent = new Map<string, number[]>();
  onApplicationShutdown() {
    return stopSqlRuns();
  }
  private rate(userId: string) {
    const now = Date.now();
    for (const [id, events] of this.recent)
      if (events.at(-1)! < now - 60000) this.recent.delete(id);
    const events = (this.recent.get(userId) ?? []).filter(
      (at) => at > now - 60000,
    );
    if (events.length >= 6 || this.recent.size >= 1024)
      throw new HttpException(
        "Muitas verificações SQL. Aguarde um minuto.",
        429,
      );
    events.push(now);
    this.recent.set(userId, events);
  }
  assessment(id: string, version: number) {
    const root =
      this.config.profile === "authoring"
        ? this.content.root
        : process.env.BUNKERCODE_SQL_ASSESSMENT_DIR;
    if (!root)
      throw new HttpException(
        "Acervo privado de avaliação SQL não configurado.",
        503,
      );
    const store = new SqlContent(root);
    const definition = store.definition(id, version);
    const dataset = store.dataset(
      definition.dataset.id,
      definition.dataset.version,
    );
    if (
      JSON.stringify(publicSqlExercise(definition, dataset)) !==
      JSON.stringify(this.content.public(id, version))
    )
      throw new ConflictException(
        "Acervo privado e publicação SQL divergem. Nenhuma conclusão foi salva.",
      );
    return { definition, dataset };
  }
  async check(
    userId: string,
    body: unknown,
    signal?: AbortSignal,
    authorization?: string,
  ) {
    this.rate(userId);
    const input = sqlInput(() => {
      const b = sqlObject(body);
      sqlObject(
        b,
        "courseId" in b || "lessonSlug" in b
          ? ["exerciseId", "version", "steps", "courseId", "lessonSlug"]
          : ["exerciseId", "version", "steps"],
      );
      return {
        exerciseId: sqlId(b.exerciseId),
        version: sqlVersion(b.version),
        steps: parseSqlSteps(b.steps),
        ...("courseId" in b
          ? { courseId: sqlId(b.courseId), lessonSlug: sqlId(b.lessonSlug) }
          : {}),
      };
    });
    if (
      Buffer.byteLength(
        JSON.stringify({ format: 1, steps: input.steps }),
        "utf8",
      ) > 65536
    )
      throw new BadRequestException("Representação da solução excede 64 KiB.");
    if (authorization && (!input.courseId || !input.lessonSlug))
      throw new BadRequestException("Submit exige curso e lição publicados.");
    if (input.courseId && input.lessonSlug)
      this.binding(
        input.courseId,
        input.lessonSlug,
        input.exerciseId,
        input.version,
      );
    const assessment = this.assessment(input.exerciseId, input.version),
      revision = sqlRevision(assessment);
    const passed = await evaluateSql(
      assessment.definition,
      assessment.dataset,
      input.steps,
      signal,
    );
    if (!passed || !authorization) return { passed };
    const courseId = input.courseId!,
      lessonSlug = input.lessonSlug!;
    const saved = await this.learning.recordSqlApproval(
      userId,
      courseId,
      lessonSlug,
      input.exerciseId,
      revision,
      input.steps,
      async () => {
        const identity = await this.auth.authenticate(authorization);
        if (identity.id !== userId || signal?.aborted)
          throw new ConflictException(
            "Sessão ou avaliação mudou. Nenhuma conclusão foi confirmada.",
          );
        this.binding(courseId, lessonSlug, input.exerciseId, input.version);
        if (
          sqlRevision(this.assessment(input.exerciseId, input.version)) !==
          revision
        )
          throw new ConflictException(
            "Atividade mudou durante avaliação. Recarregue antes de enviar.",
          );
      },
    );
    return { passed, ...saved };
  }
  async solution(userId: string, courseId: string, lessonSlug: string) {
    const ref = lessonSqlPlacement(
      this.reader.lesson(courseId, lessonSlug).markdown,
    );
    if (!ref) return null;
    const revision = sqlRevision(this.assessment(ref.exerciseId, ref.version));
    return {
      solution: await this.learning.approvedSql(
        userId,
        courseId,
        lessonSlug,
        ref.exerciseId,
        revision,
      ),
    };
  }

  binding(courseId: string, lessonSlug: string, id: string, version: number) {
    const lesson = this.reader.lesson(courseId, lessonSlug);
    const ref = lessonSqlPlacement(lesson.markdown);
    if (!ref || ref.exerciseId !== id || ref.version !== version)
      throw new ConflictException(
        "Atividade ou versão não corresponde à lição publicada.",
      );
    return lesson;
  }
  constructor(
    @Inject(SQL_CONFIG) readonly config: OperationalConfig,
    @Inject(ContentReader) readonly reader: ContentReader,
    @Inject(LearningService) private readonly learning: LearningService,
    @Inject(AuthService) private readonly auth: AuthService,
  ) {
    this.content = new SqlContent(join(dirname(config.root), "sql"));
  }
}
