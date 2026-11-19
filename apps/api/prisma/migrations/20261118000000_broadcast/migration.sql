ALTER TABLE "quizzes" ADD COLUMN "broadcast_order" INTEGER NOT NULL DEFAULT 100;
ALTER TABLE "session_answers" ADD COLUMN "cycle" INTEGER NOT NULL DEFAULT 1;
DROP INDEX "session_answers_session_id_player_id_question_id_key";
CREATE UNIQUE INDEX "session_answer_cycle_key" ON "session_answers" ("session_id","player_id","question_id","cycle");
-- Answers refer to the question and option as broadcast, even after studio edits.
ALTER TABLE "session_answers" DROP CONSTRAINT "session_answers_question_id_fkey",
                            DROP CONSTRAINT "session_answers_option_id_fkey";
