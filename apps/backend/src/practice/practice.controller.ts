import { PrismaService } from "../auth/prisma.service";
import { AuthService } from "../auth/auth.service";
import { RequireIdentity, type AuthenticatedRequest } from "../auth/auth.guard";
import { prepareFunctionTests } from "./function-tests";
import { compileAssessment } from "./assessment";
import {
  Body,
  Inject,
  Req,
  Controller,
  Delete,
  Get,
  Header,
  HttpException,
  Param,
  NotFoundException,
  Post,
  Res,
  type OnApplicationShutdown,
} from "@nestjs/common";
import type { Response } from "express";
import { ContentReader } from "../content/content-reader";
import {
  cancelRun,
  runCode,
  runnerStatus,
  stopRuns,
  RUN_LIMITS,
} from "./runner";
@RequireIdentity("STUDENT")
@Controller("practice")
export class PracticeController implements OnApplicationShutdown {
  constructor(
    @Inject(ContentReader) private readonly reader: ContentReader,
    @Inject(PrismaService) private readonly db: PrismaService,
    @Inject(AuthService) private readonly auth: AuthService,
  ) {}
  @Get("runtime")
  @Header("Cache-Control", "no-store")
  async status() {
    return { ...(await runnerStatus()), limits: RUN_LIMITS };
  }
  @Post("submissions")
  @Header("Cache-Control", "no-store")
  submit(
    @Body() body: unknown,
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.execute(body, request, response, true);
  }
  @Post("runs")
  @Header("Cache-Control", "no-store")
  run(
    @Body() body: unknown,
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.execute(body, request, response, false);
  }
  private async execute(
    body: unknown,
    request: AuthenticatedRequest,
    response: Response,
    submit: boolean,
  ) {
    if (!body || typeof body !== "object")
      throw new HttpException("Comando inválido.", 400);
    const value = body as Record<string, unknown>;
    const fields = [
      "id",
      "course",
      "lesson",
      "exercise",
      "revision",
      "source",
      "javascript",
    ];
    if (
      Object.keys(value).length !== fields.length ||
      !fields.every((key) => typeof value[key] === "string")
    )
      throw new HttpException("Campos de execução inválidos.", 400);
    const { id, course, lesson, exercise, revision, source, javascript } =
      value as Record<(typeof fields)[number], string>;
    if (
      !/^[0-9a-f]{8}-[0-9a-f-]{27}$/.test(id!) ||
      [source!, javascript!].some(
        (code) => Buffer.byteLength(code, "utf8") > RUN_LIMITS.codeBytes,
      )
    )
      throw new HttpException("Identidade ou tamanho de código inválido.", 400);
    const { exercise: definition } = this.reader.exercise(
      course!,
      lesson!,
      request.identity.role === "ADMIN",
    );
    if (
      !definition ||
      definition.id !== exercise ||
      definition.revision !== revision
    )
      throw new HttpException(
        "A definição mudou. Recarregue a lição antes de executar.",
        409,
      );
    const abort = new AbortController();
    const disconnect = () => {
      if (!response.writableEnded) abort.abort();
    };
    response.on("close", disconnect);
    try {
      const compiled = definition.tests
        ? await compileAssessment(source!, definition.language, abort.signal)
        : javascript!;
      const suite = definition.tests;
      const functions =
        suite?.kind === "function"
          ? prepareFunctionTests(compiled, suite)
          : undefined;
      const result = await runCode(
        id!,
        source!,
        functions?.program ?? compiled,
        abort.signal,
      );
      const assessment = functions
        ? functions.assess(result)
        : suite?.kind === "stdout"
          ? {
              assessment:
                result.state === "success" && result.stdout === suite.expected
                  ? "passed"
                  : "failed",
              testReport: {
                passed:
                  result.state === "success" && result.stdout === suite.expected
                    ? 1
                    : 0,
                total: 1,
                cases: [
                  {
                    name: "Saída exata",
                    passed:
                      result.state === "success" &&
                      result.stdout === suite.expected,
                    expected: suite.expected,
                    actual: result.stdout,
                  },
                ],
              },
            }
          : {};
      let approved = false;
      if (
        submit &&
        assessment.assessment === "passed" &&
        result.state === "success" &&
        !abort.signal.aborted
      ) {
        // Recheck session and published revision after execution; preview never creates student approval.
        await this.auth.authenticate(request.headers.authorization);
        let current;
        try {
          current = this.reader.exercise(course!, lesson!).exercise;
        } catch (error) {
          if (!(error instanceof NotFoundException)) throw error;
        }
        if (
          current &&
          (current.id !== exercise || current.revision !== revision)
        )
          throw new HttpException(
            "A definição mudou. Recarregue a lição antes de enviar.",
            409,
          );
        if (current) {
          const key = {
            userId: request.identity.id,
            courseId: course!,
            lessonSlug: lesson!,
          };
          const solutionKey = {
            ...key,
            exerciseId: exercise!,
            revision: revision!,
          };
          await this.db.$transaction([
            this.db.approvedSolution.upsert({
              where: {
                userId_courseId_lessonSlug_exerciseId_revision: solutionKey,
              },
              create: { ...solutionKey, source: source! },
              update: { source: source!, approvedAt: new Date() },
            }),
            this.db.lessonCompletion.createMany({
              data: [key],
              skipDuplicates: true,
            }),
          ]);
          approved = true;
        }
      }
      return {
        ...result,
        revision,
        ...assessment,
        ...(submit ? { approved } : {}),
      };
    } finally {
      response.off("close", disconnect);
    }
  }
  @Delete("runs/:id")
  @Header("Cache-Control", "no-store")
  cancel(@Param("id") id: string) {
    if (!/^[0-9a-f]{8}-[0-9a-f-]{27}$/.test(id))
      throw new HttpException("Identidade inválida.", 400);
    return cancelRun(id);
  }
  onApplicationShutdown() {
    return stopRuns();
  }
}
