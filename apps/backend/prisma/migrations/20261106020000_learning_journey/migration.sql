-- CreateTable
CREATE TABLE "LessonCompletion" (
    "userId" UUID NOT NULL,
    "courseId" VARCHAR(100) NOT NULL,
    "lessonSlug" VARCHAR(100) NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LessonCompletion_pkey" PRIMARY KEY ("userId","courseId","lessonSlug")
);

-- CreateTable
CREATE TABLE "LastLessonVisit" (
    "userId" UUID NOT NULL,
    "courseId" VARCHAR(100) NOT NULL,
    "lessonSlug" VARCHAR(100) NOT NULL,
    "visitedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LastLessonVisit_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "LearningPreferences" (
    "userId" UUID NOT NULL,
    "siteTheme" VARCHAR(10) NOT NULL DEFAULT 'bunkercode',
    "readingTone" INTEGER,
    "readingSize" INTEGER NOT NULL DEFAULT 17,

    CONSTRAINT "LearningPreferences_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "ApprovedSolution" (
    "userId" UUID NOT NULL,
    "courseId" VARCHAR(100) NOT NULL,
    "lessonSlug" VARCHAR(100) NOT NULL,
    "exerciseId" VARCHAR(100) NOT NULL,
    "revision" CHAR(64) NOT NULL,
    "source" TEXT NOT NULL,
    "approvedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApprovedSolution_pkey" PRIMARY KEY ("userId","courseId","lessonSlug","exerciseId","revision")
);

-- AddForeignKey
ALTER TABLE "LessonCompletion" ADD CONSTRAINT "LessonCompletion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LastLessonVisit" ADD CONSTRAINT "LastLessonVisit_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LearningPreferences" ADD CONSTRAINT "LearningPreferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovedSolution" ADD CONSTRAINT "ApprovedSolution_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Defense in depth for direct writes; the HTTP API validates the same bounds.
ALTER TABLE "LearningPreferences" ADD CONSTRAINT "LearningPreferences_values_check" CHECK (
  "siteTheme" IN ('bunkercode', 'light') AND
  ("readingTone" IS NULL OR "readingTone" BETWEEN 0 AND 5) AND
  "readingSize" BETWEEN 16 AND 21
);
ALTER TABLE "ApprovedSolution" ADD CONSTRAINT "ApprovedSolution_source_check" CHECK (octet_length("source") <= 65536);
