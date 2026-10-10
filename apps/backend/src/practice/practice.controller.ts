import { prepareFunctionTests } from "./function-tests";
import { compileAssessment } from "./assessment";
import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpException,
  Param,
  Post,
  Res,
  type OnApplicationShutdown,
} from "@nestjs/common";
import type { Response } from "express";
import { loadExercise } from "../content/exercise";
import {
  cancelRun,
  runCode,
  runnerStatus,
  stopRuns,
  RUN_LIMITS,
} from "./runner";
@Controller("practice")
export class PracticeController implements OnApplicationShutdown {
  @Get("runtime")
  @Header("Cache-Control", "no-store")
  async status() {
    return { ...(await runnerStatus()), limits: RUN_LIMITS };
  }
  @Post("runs")
  @Header("Cache-Control", "no-store")
  async run(
    @Body() body: unknown,
    @Res({ passthrough: true }) response: Response,
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
    const definition = loadExercise(course!, lesson!);
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
      return { ...result, revision, ...assessment };
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
