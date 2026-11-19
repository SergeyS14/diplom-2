const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { once } = require('node:events');
const { PrismaClient } = require('@prisma/client');
const { NestFactory } = require('@nestjs/core');
const { JwtService } = require('@nestjs/jwt');
const { io } = require('socket.io-client');
const { WS_EVENTS: events } = require('@quiz/shared');
const { AppModule } = require('../apps/api/dist/app.module');
const { GameService } = require('../apps/api/dist/game/game.service');

test('Эфир через HTTP, Socket.IO и PostgreSQL', { timeout: 90000 }, async t => {
  assert.ok(process.env.TEST_DATABASE_URL, 'Задайте TEST_DATABASE_URL для тестового PostgreSQL');
  const url = new URL(process.env.TEST_DATABASE_URL);
  const schema = 'quiz_test_' + randomUUID().replaceAll('-', '');
  url.searchParams.set('schema', schema);
  process.env.DATABASE_URL = url.href;
  process.env.TV_PASSWORD = 'test-screen';
  execFileSync(process.execPath, [require.resolve('prisma/build/index.js'), 'migrate', 'deploy', '--schema', 'apps/api/prisma/schema.prisma']);
  const db = new PrismaClient();
  const app = await NestFactory.create(AppModule, { logger: false });
  const sockets = [];
  let room;
  t.after(async () => {
    if (room) clearTimeout(room.timer);
    sockets.forEach(socket => socket.close());
    await app.close();
    await db.$executeRawUnsafe('DROP SCHEMA "' + schema + '" CASCADE');
    await db.$disconnect();
  });
  app.setGlobalPrefix('api');
  app.enableCors();
  await app.listen(0, '127.0.0.1');
  const origin = await app.getUrl();
  const jwt = app.get(JwtService);
  const game = app.get(GameService);
  const admin = await db.user.create({ data: { name: 'Редактор', email: 'test@example.org', passwordHash: '-', role: 'ADMIN', emailVerified: true } });
  const token = jwt.sign({ sub: admin.id });
  async function request(path, method = 'GET', data, access = token) {
    const response = await fetch(origin + '/api' + path, { method, headers: { Authorization: 'Bearer ' + access, 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    assert.ok(response.ok, await response.clone().text());
    return response.json();
  }
  async function connect() {
    const socket = io(origin, { reconnection: false, forceNew: true });
    sockets.push(socket);
    await once(socket, 'connect');
    return socket;
  }
  await t.test('Студия закрыта для игрока', async () => {
    const player = await db.user.create({ data: { name: 'Игрок', email: 'player@example.org', passwordHash: '-', emailVerified: true } });
    const res = await fetch(origin + '/api/studio/quizzes', { headers: { Authorization: 'Bearer ' + jwt.sign({ sub: player.id }) } });
    assert.equal(res.status, 403);
  });
  async function publish(title, order) {
    const quiz = await request('/studio/quizzes', 'POST', { title });
    await request('/studio/rounds/' + quiz.rounds[0].id + '/questions', 'POST', {});
    return request('/studio/quizzes/' + quiz.id, 'PATCH', { broadcastOrder: order, isPublished: true });
  }
  const second = await publish('Второй', 20);
  const first = await publish('Первый', 10);
  const firstQuestionId = first.rounds[0].questions[0].id;
  const picture = 'https://example.org/quiz-image.svg';
  await t.test('Студия сохраняет, очищает и проверяет ссылку на иллюстрацию', async () => {
    const path = '/studio/questions/' + firstQuestionId;
    const rejected = await fetch(origin + '/api' + path, {
      method: 'PATCH',
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ mediaUrl: '/image.svg' }),
    });
    assert.equal(rejected.status, 400);
    const saved = await request(path, 'PATCH', { mediaUrl: ' ' + picture + ' ' });
    assert.equal(saved.rounds[0].questions[0].mediaUrl, picture);
    const cleared = await request(path, 'PATCH', { mediaUrl: null });
    assert.equal(cleared.rounds[0].questions[0].mediaUrl, null);
    await request(path, 'PATCH', { mediaUrl: picture });
  });
  const tv = await connect();
  const create = await tv.emitWithAck(events.ROOM_CREATE, { tvPassword: 'test-screen' });
  assert.equal(create.ok, true, create.error);
  room = game.getRoomBySocket(tv.id);
  await t.test('Очередь стартует на ТВ без игроков и ведущего', async () => {
    assert.equal(room.quizId, first.id);
    await once(tv, events.ROUND_SHOW);
    assert.equal(room.players.size, 0);
    assert.ok(!room.timeline.some(beat => beat.kind === 'ad'));
  });
  await game.advance(room);
  const player = await connect();
  const pendingQuestion = once(player, events.QUESTION_SHOW);
  const joined = await player.emitWithAck(events.ROOM_JOIN, { code: room.code, role: 'player', nickname: 'Лиса' });
  assert.equal(joined.ok, true);
  const [question] = await pendingQuestion;
  const answer = { questionId: question.questionId, optionId: question.options[0].id, clientTs: Date.now() };
  await t.test('Поздний вход, ответ и защита от повторного ответа', async () => {
    assert.equal(question.mediaUrl, picture);
    assert.equal(question.options.some(option => 'isCorrect' in option), false);
    assert.equal((await player.emitWithAck(events.ANSWER_SUBMIT, answer)).ok, true);
    assert.equal((await player.emitWithAck(events.ANSWER_SUBMIT, answer)).code, 'ALREADY_ANSWERED');
  });
  await t.test('Второй ТВ получает вопрос и итоги при входе на сцену результатов', async () => {
    await game.reveal(room);
    const screen = await connect();
    const received = [];
    screen.onAny((event, payload) => received.push({ event, payload }));
    const ack = await screen.emitWithAck(events.ROOM_JOIN, { code: room.code, role: 'tv', tvPassword: 'test-screen' });
    assert.equal(ack.data.state.status, 'reveal');
    const replay = received.filter(({ event }) => [events.QUESTION_SHOW, events.QUESTION_REVEAL].includes(event));
    assert.deepEqual(replay.map(message => message.event), [events.QUESTION_SHOW, events.QUESTION_REVEAL]);
    assert.deepEqual(replay[0].payload, question);
    assert.equal(replay[1].payload.questionId, question.questionId);
    assert.equal(replay[1].payload.stats.find(stat => stat.optionId === answer.optionId).count, 1);
  });
  await t.test('Редактор назначает рекламу следующему квизу', async () => {
    const ad = await request('/studio/ads', 'POST', { title: 'Партнёр', durationSec: 5 });
    await request('/studio/ads/' + ad.id, 'PATCH', { title: 'Премьера' });
    await request('/studio/rounds/' + second.rounds[0].id, 'PATCH', { adId: ad.id });
    await game.finish(room);
    await game.beginNextLoop(room);
    assert.equal(room.quizId, second.id);
    assert.equal(room.timeline.find(beat => beat.kind === 'ad').ad.title, 'Премьера');
    assert.equal(room.players.get(joined.data.playerId).score, 0);
  });
  await t.test('Тот же игрок отвечает на тот же вопрос в следующем круге', async () => {
    await game.finish(room);
    await game.beginNextLoop(room);
    assert.equal(room.quizId, first.id);
    await game.startGame(tv.id);
    await game.advance(room);
    assert.equal((await player.emitWithAck(events.ANSWER_SUBMIT, answer)).ok, true);
    const answers = await db.sessionAnswer.findMany({ where: { playerId: joined.data.playerId }, orderBy: { cycle: 'asc' } });
    assert.deepEqual(answers.map(row => row.cycle), [1, 3]);
  });
  await t.test('Панель эфира показывает активную комнату', async () => {
    const shows = await request('/studio/broadcasts');
    assert.deepEqual(shows.map(show => [show.code, show.title, show.players]), [[room.code, first.title, 1]]);
  });
  await t.test('Отдельный запуск ТВ создаёт независимую комнату', async () => {
    const screen = await connect();
    const created = await screen.emitWithAck(events.ROOM_CREATE, { tvPassword: 'test-screen' });
    assert.equal(created.ok, true);
    const other = game.getRoomBySocket(screen.id);
    try {
      assert.notEqual(created.data.code, room.code);
      assert.equal(other.players.size, 0);
      assert.equal(room.players.size, 1);
      assert.equal(other.status, 'lobby');
      assert.equal(room.status, 'question');
    } finally {
      clearTimeout(other.timer);
    }
  });
  if (process.env.TEST_BROWSER) {
    await t.test('Мобильный редактор и студия сохраняют изменения, иллюстрация видна игроку и ТВ', async () => {
      const { chromium } = require('playwright-core');
      const { createServer } = await import('vite');
      process.env.VITE_API_URL = origin;
      const vite = await createServer({ root: 'apps/player', server: { host: '127.0.0.1', port: 0 }, logLevel: 'error' });
      await vite.listen();
      const tvVite = await createServer({ root: 'apps/tv', server: { host: '127.0.0.1', port: 0 }, logLevel: 'error' });
      await tvVite.listen();
      let browser;
      let browserRoom;
      try {
        browser = await chromium.launch({ executablePath: process.env.TEST_BROWSER });
        const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
        page.setDefaultTimeout(7000);
        await page.addInitScript(token => localStorage.setItem('quiz_access', token), token);
        const base = 'http://127.0.0.1:' + vite.httpServer.address().port;
        await page.goto(base + '/me');
        await page.getByRole('button', { name: 'Причёска' }).click();
        await page.getByRole('button', { name: 'кудри' }).click();
        await page.getByRole('button', { name: 'Сохранить профиль' }).click();
        await page.getByText('Сохранено', { exact: true }).waitFor();
        await page.reload();
        await page.getByRole('button', { name: 'Причёска' }).click();
        assert.equal(await page.getByRole('button', { name: 'кудри' }).getAttribute('aria-pressed'), 'true');
        await page.getByRole('link', { name: 'Студия' }).click();
        await page.getByRole('link', { name: /Первый/ }).click();
        await page.getByLabel('Позиция в эфире').fill('7');
        await page.getByRole('button', { name: 'Сохранить карточку' }).click();
        await page.getByText('Квиз сохранён').waitFor();
        assert.equal((await request('/studio/quizzes/' + first.id)).broadcastOrder, 7);
        const imageUrl = base + '/favicon.svg';
        await page.getByLabel('Ссылка на картинку').fill(imageUrl);
        await page.getByRole('button', { name: 'Сохранить вопрос' }).click();
        await page.getByText('Вопрос сохранён').waitFor();
        await page.reload();
        assert.equal(await page.getByLabel('Ссылка на картинку').inputValue(), imageUrl);

        const tvPage = await browser.newPage();
        await tvPage.goto('http://127.0.0.1:' + tvVite.httpServer.address().port);
        await tvPage.getByPlaceholder('Пароль показа').fill('test-screen');
        await tvPage.getByRole('button', { name: 'Начать показ' }).click();
        const code = await tvPage.getByText('Код комнаты', { exact: true }).locator('xpath=following-sibling::p').innerText();
        browserRoom = game.rooms.get(code);

        const guest = await browser.newPage({ viewport: { width: 390, height: 844 } });
        await guest.goto(base + '/join/' + code);
        await guest.getByPlaceholder('Твой ник').fill('Тест иллюстрации');
        await guest.getByRole('button', { name: 'Войти в игру', exact: true }).click();
        await guest.waitForURL('**/play');
        await game.startGame([...browserRoom.tvSocketIds][0]);
        await game.advance(browserRoom);
        for (const client of [guest, tvPage]) {
          const loaded = await client.getByAltText('Иллюстрация к вопросу').evaluate(async img => {
            await img.decode();
            return img.naturalWidth > 0;
          });
          assert.equal(loaded, true);
        }

      } finally {
        if (browserRoom) clearTimeout(browserRoom.timer);
        await browser?.close();
        await tvVite.close();
        await vite.close();
      }
    });
  }

});
