import { Prisma, PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { DEFAULT_AVATAR, OPTION_COLORS } from '@quiz/shared';

const client = new PrismaClient();

async function main() {
  await client.$transaction(async prisma => {
    if (await prisma.user.count()) return;
    await populate(prisma);
  });
}

async function populate(prisma: Prisma.TransactionClient) {
  const passwordHash = await bcrypt.hash('diplom123', 10);

  const admin = await prisma.user.create({
    data: {
      email: 'admin@quiz.local',
      passwordHash,
      name: 'Админ',
      nickname: 'Админ',
      role: 'ADMIN',
      emailVerified: true,
      avatar: { ...DEFAULT_AVATAR, glasses: 'sunglasses', hair: 'none', mouth: 'smirk' },
    },
  });

  const player = await prisma.user.create({
    data: {
      email: 'player@quiz.local',
      passwordHash,
      name: 'Игрок',
      nickname: 'Лиса',
      role: 'PLAYER',
      emailVerified: true,
      rating: 1120,
      gamesPlayed: 3,
      wins: 1,
      podiums: 2,
      totalScore: 4200,
      bestScore: 1800,
      correctAnswers: 11,
      bestStreak: 4,
      avatar: {
        ...DEFAULT_AVATAR,
        skin: '#E0AC69',
        glasses: 'sunglasses',
        facial: 'mustache',
        mouth: 'smirk',
        hair: 'curly',
        blush: true,
      },
      achievements: {
        create: [{ achievementId: 'first_game' }, { achievementId: 'first_win' }, { achievementId: 'podium' }],
      },
    },
  });

  await prisma.gameResult.createMany({
    data: [
      { userId: player.id, quizTitle: 'Большой квиз', score: 1800, place: 1, players: 4 },
      { userId: player.id, quizTitle: 'Большой квиз', score: 1400, place: 2, players: 6 },
      { userId: player.id, quizTitle: 'Большой квиз', score: 1000, place: 3, players: 5 },
    ],
  });

  const ad = await prisma.ad.create({
    data: {
      ownerId: admin.id,
      title: 'Пауза',
      body: 'Короткий перерыв. Код на экране всё ещё работает — новые игроки могут зайти.',
      cta: 'Сканируй QR',
      mediaUrl: '',
      durationSec: 14,
      type: 'IMAGE',
    },
  });

  const opt = (texts: [string, string, string, string], correct: number) =>
    texts.map((text, i) => ({
      text,
      isCorrect: i === correct,
      order: i + 1,
      color: OPTION_COLORS[i],
    }));

  const tf = (correctIsTrue: boolean) => [
    { text: 'Правда', isCorrect: correctIsTrue, order: 1, color: OPTION_COLORS[0] },
    { text: 'Ложь', isCorrect: !correctIsTrue, order: 2, color: OPTION_COLORS[1] },
  ];

  await prisma.quiz.create({
    data: {
      ownerId: admin.id,
      title: 'Большой квиз',
      description: 'Мир, история, кино, спорт, еда и наука. Эфир крутится сам, игроки заходят по QR.',
      isPublished: true,
      defaultQuestionTime: 18,
      rounds: {
        create: [
          {
            title: 'Мир и история',
            type: 'STANDARD',
            order: 1,
            showLeaderboard: true,
            adId: ad.id,
            questions: {
              create: [
                {
                  text: 'Какая столица Австралии?',
                  hint: 'Это не самый большой город страны.',
                  timeLimit: 18,
                  points: 1000,
                  order: 1,
                  options: { create: opt(['Сидней', 'Канберра', 'Мельбурн', 'Перт'], 1) },
                },
                {
                  text: 'В каком году человек впервые ступил на Луну?',
                  hint: 'Конец 1960-х, миссия Apollo.',
                  timeLimit: 18,
                  points: 1000,
                  order: 2,
                  options: { create: opt(['1957', '1975', '1969', '1961'], 2) },
                },
                {
                  text: 'Самая длинная река в мире?',
                  hint: 'Течёт по Африке.',
                  timeLimit: 16,
                  points: 1000,
                  order: 3,
                  options: { create: opt(['Волга', 'Дунай', 'Янцзы', 'Нил'], 3) },
                },
                {
                  text: 'Эйфелеву башню изначально планировали разобрать через 20 лет?',
                  hint: 'Её строили как временный павильон выставки.',
                  type: 'TRUE_FALSE',
                  timeLimit: 12,
                  points: 800,
                  order: 4,
                  options: { create: tf(true) },
                },
              ],
            },
          },
          {
            title: 'Кино, спорт, еда',
            type: 'STANDARD',
            order: 2,
            showLeaderboard: true,
            questions: {
              create: [
                {
                  text: 'Кто снял фильм «Титаник»?',
                  hint: 'Тот же режиссёр снял «Аватар».',
                  timeLimit: 16,
                  points: 1000,
                  order: 1,
                  options: { create: opt(['Стивен Спилберг', 'Джеймс Кэмерон', 'Кристофер Нолан', 'Ридли Скотт'], 1) },
                },
                {
                  text: 'Сколько игроков одной команды на поле в футболе?',
                  hint: 'Вратарь плюс десять полевых.',
                  timeLimit: 14,
                  points: 1000,
                  order: 2,
                  options: { create: opt(['7', '9', '11', '15'], 2) },
                },
                {
                  text: 'Из какой страны родом пицца?',
                  hint: 'Неаполь, Средиземноморье.',
                  timeLimit: 14,
                  points: 800,
                  order: 3,
                  options: { create: opt(['Франция', 'Греция', 'Испания', 'Италия'], 3) },
                },
                {
                  text: 'Какой напиток делают из ячменя и хмеля?',
                  hint: 'Его варят, а не настаивают на винограде.',
                  timeLimit: 14,
                  points: 800,
                  order: 4,
                  options: { create: opt(['Вино', 'Пиво', 'Сидр', 'Ром'], 1) },
                },
              ],
            },
          },
          {
            title: 'Наука и логика',
            type: 'FINAL',
            order: 3,
            showLeaderboard: true,
            questions: {
              create: [
                {
                  text: 'Сколько планет в Солнечной системе?',
                  hint: 'Плутон больше не считают планетой.',
                  timeLimit: 15,
                  points: 1200,
                  order: 1,
                  options: { create: opt(['9', '8', '7', '10'], 1) },
                },
                {
                  text: 'Что такое H₂O?',
                  hint: 'Два атома водорода и один кислорода.',
                  timeLimit: 12,
                  points: 800,
                  order: 2,
                  options: { create: opt(['Поваренная соль', 'Углекислый газ', 'Вода', 'Озон'], 2) },
                },
                {
                  text: 'У осьминога три сердца?',
                  hint: 'Два качают кровь к жабрам, одно — к телу.',
                  type: 'TRUE_FALSE',
                  timeLimit: 12,
                  points: 1000,
                  order: 3,
                  options: { create: tf(true) },
                },
                {
                  text: 'Свет распространяется быстрее звука?',
                  hint: 'Сначала молния, потом гром.',
                  type: 'TRUE_FALSE',
                  timeLimit: 10,
                  points: 800,
                  order: 4,
                  options: { create: tf(true) },
                },
              ],
            },
          },
        ],
      },
    },
  });

  await prisma.quiz.create({
    data: {
      title: 'Музыкальный блиц',
      ownerId: admin.id,
      isPublished: true,
      broadcastOrder: 200,
      rounds: {
        create: {
          title: 'Инструменты',
          order: 1,
          type: 'LIGHTNING',
          questions: {
            create: {
              text: 'У какого инструмента обычно 88 клавиш?',
              order: 1,
              timeLimit: 15,
              points: 1500,
              options: {
                create: [
                  { text: 'Фортепиано', isCorrect: true, order: 1 },
                  { text: 'Скрипка', isCorrect: false, order: 2 },
                  { text: 'Флейта', isCorrect: false, order: 3 },
                ],
              },
            },
          },
        },
      },
    },
  });

  console.log('Seed OK: player@quiz.local / diplom123, admin@quiz.local / diplom123. ТВ-пароль: show123');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await client.$disconnect();
  });
