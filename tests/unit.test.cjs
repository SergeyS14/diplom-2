const test = require('node:test');
const assert = require('node:assert/strict');
const { calcPoints, DEFAULT_AVATAR, parseAvatar, randomAvatar } = require('@quiz/shared');

const score = overrides => calcPoints({ isCorrect: true, base: 1000, timeLimitMs: 10000, timeMs: 5000, streak: 0, ...overrides });

test('Неверный ответ даёт ноль независимо от серии', () => assert.equal(score({ isCorrect: false, streak: 5 }), 0));
test('Скорость даёт от нуля до половины базовой стоимости', () => {
  assert.equal(score({ timeMs: 0 }), 1500);
  assert.equal(score({}), 1250);
  assert.equal(score({ timeMs: 12000 }), 1000);
});
test('Бонус серии ограничен пятью ответами', () => assert.equal(score({ streak: 20 }), 1500));
test('Старый или неполный аватар получает настройки по умолчанию', () => {
  assert.deepEqual(parseAvatar(null), DEFAULT_AVATAR);
  assert.deepEqual(parseAvatar({ eyes: 'unknown', hair: 'curly' }), { ...DEFAULT_AVATAR, hair: 'curly' });
});
test('Случайный аватар сохраняет все выбранные черты при чтении', () => {
  const avatar = randomAvatar();
  assert.deepEqual(parseAvatar(JSON.parse(JSON.stringify(avatar))), avatar);
});
