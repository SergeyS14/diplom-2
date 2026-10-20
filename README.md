# Онлайн-квиз (диплом)

TV-экран + PWA игроков + NestJS. Подробный план: [`docs/PLAN.md`](docs/PLAN.md).

## Что умеет

- Эфир на ТВ: пароль показа, лобби с QR, раунды, вопросы, рейтинг, реклама, подиум. Код комнаты виден всё время игры
- Шоу крутится само (старт, вопросы, паузы, новый круг) — ведущий из аккаунта не нужен
- PWA: вход по QR/коду, регистрация, профиль, аватар, глобальный рейтинг
- Студия квизов — только у админа

Гость может зайти по коду без аккаунта. Рейтинг и медали — у подтверждённого игрока.

## Запуск

Нужны Node 20+ и **Docker Desktop**.

```bash
npm install
npm run setup
npm run dev
```

`setup` поднимает Postgres, Redis, Mailhog, накатывает миграции и seed.

| URL | Зачем |
|---|---|
| http://localhost:5173 | ТВ — пароль показа `show123` |
| http://localhost:5174 | Игрок (QR / код с экрана) |
| http://localhost:3000/api/health | API |
| http://localhost:8025 | Mailhog — письма подтверждения |

Демо:

- ТВ: пароль показа `show123`
- `player@quiz.local` / `diplom123` — игрок с аватаркой и медалями
- `admin@quiz.local` / `diplom123` — студия контента

Новая регистрация: письмо в Mailhog, ссылка `/verify?token=…`.

## Стек

Vue 3, Pinia, NestJS, Socket.IO, Prisma, PostgreSQL, Redis, Mailhog.
