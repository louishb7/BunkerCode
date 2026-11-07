import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../auth/prisma.service";
import { ContentReader } from "../content/content-reader";

export function preferencesInput(body: unknown) {
  if (!body || typeof body !== "object" || Array.isArray(body))
    throw new BadRequestException("Preferências inválidas.");
  const v = body as Record<string, unknown>;
  if (
    Object.keys(v).length !== 3 ||
    !["siteTheme", "readingTone", "readingSize"].every((key) =>
      Object.hasOwn(v, key),
    ) ||
    (v.siteTheme !== "bunkercode" && v.siteTheme !== "light") ||
    (v.readingTone !== null &&
      (!Number.isInteger(v.readingTone) ||
        Number(v.readingTone) < 0 ||
        Number(v.readingTone) > 5)) ||
    !Number.isInteger(v.readingSize) ||
    Number(v.readingSize) < 16 ||
    Number(v.readingSize) > 21
  )
    throw new BadRequestException("Preferências inválidas.");
  return {
    siteTheme: v.siteTheme as "bunkercode" | "light",
    readingTone: v.readingTone as number | null,
    readingSize: v.readingSize as number,
  };
}
export function emptyInput(body: unknown) {
  if (
    !body ||
    typeof body !== "object" ||
    Array.isArray(body) ||
    Object.keys(body).length
  )
    throw new BadRequestException("Envie um objeto vazio.");
}
const preferenceFields = {
  siteTheme: true,
  readingTone: true,
  readingSize: true,
} as const;
@Injectable()
export class LearningService {
  constructor(
    @Inject(PrismaService) private readonly db: PrismaService,
    @Inject(ContentReader) private readonly reader: ContentReader,
  ) {}
  async summary(userId: string) {
    const courses = this.reader.list().map((c) => this.reader.course(c.id));
    const [records, visit] = await Promise.all([
      this.db.lessonCompletion.findMany({
        where: { userId },
        select: { courseId: true, lessonSlug: true },
      }),
      this.db.lastLessonVisit.findUnique({ where: { userId } }),
    ]);
    const progress = courses.map((c) => {
      const completed = c.lessons
        .filter((l) =>
          records.some((r) => r.courseId === c.id && r.lessonSlug === l.slug),
        )
        .map((l) => l.slug);
      return {
        courseId: c.id,
        total: c.lessons.length,
        lessons: c.lessons.map((l) => l.slug),
        completed,
      };
    });
    const course = courses.find((c) => c.id === visit?.courseId);
    const target =
      course?.lessons.find((l) => l.slug === visit?.lessonSlug) ??
      course?.lessons[0];
    return {
      courses: progress,
      resume:
        course && target ? { course: course.id, slug: target.slug } : null,
    };
  }
  async visit(userId: string, courseId: string, lessonSlug: string) {
    this.reader.lesson(courseId, lessonSlug); // Always the published projection, including ADMIN.
    await this.db
      .$executeRaw`INSERT INTO "LastLessonVisit" ("userId", "courseId", "lessonSlug", "visitedAt")
      VALUES (${userId}::uuid, ${courseId}, ${lessonSlug}, clock_timestamp())
      ON CONFLICT ("userId") DO UPDATE SET "courseId" = EXCLUDED."courseId", "lessonSlug" = EXCLUDED."lessonSlug", "visitedAt" = clock_timestamp()`;
    return { saved: true };
  }
  async complete(userId: string, courseId: string, lessonSlug: string) {
    this.reader.lesson(courseId, lessonSlug);
    if (this.reader.exercise(courseId, lessonSlug).exercise)
      throw new ConflictException(
        "Esta lição exige Submit aprovado; a leitura não aprova o exercício.",
      );
    await this.db.lessonCompletion.createMany({
      data: [{ userId, courseId, lessonSlug }],
      skipDuplicates: true,
    });
    return { completed: true };
  }
  preferences(userId: string) {
    return this.db.learningPreferences.findUnique({
      where: { userId },
      select: preferenceFields,
    });
  }
  savePreferences(userId: string, body: unknown, initialize: boolean) {
    const data = preferencesInput(body);
    return this.db.learningPreferences.upsert({
      where: { userId },
      create: { userId, ...data },
      update: initialize ? { userId } : data,
      select: preferenceFields,
    });
  }
  async solution(userId: string, courseId: string, lessonSlug: string) {
    const { exercise } = this.reader.exercise(courseId, lessonSlug);
    if (!exercise) throw new NotFoundException("Exercício não encontrado.");
    const solution = await this.db.approvedSolution.findUnique({
      where: {
        userId_courseId_lessonSlug_exerciseId_revision: {
          userId,
          courseId,
          lessonSlug,
          exerciseId: exercise.id,
          revision: exercise.revision,
        },
      },
      select: { source: true, revision: true, approvedAt: true },
    });
    return { solution };
  }
}
