-- AlterTable
ALTER TABLE "questions" ADD COLUMN "hint" TEXT;

-- CreateTable
CREATE TABLE "game_results" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "quiz_title" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "place" INTEGER NOT NULL,
    "players" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "game_results_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "game_results_user_id_created_at_idx" ON "game_results"("user_id", "created_at");

-- AddForeignKey
ALTER TABLE "game_results" ADD CONSTRAINT "game_results_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
