# sellbuy-back

Backend-сервис (Node.js) для проекта SellBuy: REST API на Express, база данных через Sequelize (PostgreSQL), realtime через Socket.IO, интеграции с web3 (проверка транзакций/выплаты), уведомления в Telegram и отправка email.

## Возможности (в общих чертах)

- API endpoints под `/api` (роутер в `rotes/router.js`)
- CRUD-эндпоинты для моделей (через `lib/express-crud.js`)
- Socket.IO сервер (см. `socket.js`)
- Фоновые интервальные задачи:
  - проверка статуса оплат/попыток (`OrderAttempt`)
  - публикация ордеров
  - автозавершение ордеров/выплат
  - чистка логов/сессий
- Telegram-уведомления (см. `lib/telegram.js`)
- Email отправка (см. `lib/email.js`, `lib/attemptMailer.js`)

## Стек

- **Node.js + Express**
- **Sequelize** (ORM)
- **PostgreSQL** (через `pg`)
- **Socket.IO**
- **web3**
- **dotenv** (выбор env-файла через `DOTENV_CONFIG_PATH`)
- **Jest** (тесты)

## Требования

- **Node.js** (рекомендуется LTS)
- **PostgreSQL**

## Быстрый старт

1) Установить зависимости:

```bash
npm i
```

2) Подготовить конфиг БД для миграций/Sequelize.

В папке `database/` есть пример `config.example.json`. Создайте на его основе `database/config.json` и заполните поля:

- `username`, `password`, `database`, `host`, `port`
- `dialect` должен быть `postgres`

3) Создать env-файл.

Скрипты запуска ожидают `.env.dev` и/или `.env.prod` в корне проекта:

- `npm run dev` использует `DOTENV_CONFIG_PATH=.env.dev`
- `npm run prod` использует `DOTENV_CONFIG_PATH=.env.prod`

4) Запустить миграции:

```bash
npm run db:migrate
```

5) Запустить сервер:

```bash
npm run dev
```

## Скрипты

- **`npm run dev`**: запуск через `nodemon` с `.env.dev`
- **`npm run devfan`**: то же, но с расширенным `DEBUG=...`
- **`npm run prod`**: запуск `node` с `.env.prod`
- **`npm run db:make`**: генерация миграции (внутренний тул в `database/migrations/tool/`)
- **`npm run db:migrate`**: применить миграции через `sequelize-cli`
- **`npm test`**: запуск Jest

## Переменные окружения

Ниже перечислены переменные, которые реально читаются кодом (поиск по `process.env.*`).

### Сервер/режим

- **`DB_ENV`**: окружение БД/режим (обычно `development` или `production`).
- **`PORT`**: порт основного HTTP API.
- **`SECURE_PORT`**: дополнительный порт (используется отдельный `app.listen`, см. `index.js`).
- **`SOCKET_PORT`**: порт Socket.IO (см. `socket.js`).
- **`AUTOPAY_INTERVAL`**: интервал (мс) для автозавершения ордеров/выплат (см. `index.js`).

### Внешние API

- **`API_URL`**: базовый URL внешнего API, используется в модулях `lib/*` и некоторых контроллерах.

### Telegram

- **`TELEGRAM_KEY`**: токен бота.
- **`TELEGRAM_CHAT_ID`**: основной чат/канал для уведомлений.
- **`TELEGRAM_SUPPORT_CHAT_ID`**: чат поддержки.
- **`TELEGRAM_MANAGER_CHAT_ID`**: чат менеджеров.
- **`TELEGRAM_CLUB_CHAT_ID`**: клубный чат.
- **`TELEGRAM_CLUB_ENG_CHAT_ID`**: клубный чат (EN).
- **`TELEGRAM_AMBASSADOR_CHAT_ID`**: чат амбассадоров.

### Email (SMTP)

- **`EMAIL_HOST`**: SMTP host.
- **`EMAIL_PORT`**: SMTP port.
- **`EMAIL_AUTH_USER`**: SMTP user.
- **`EMAIL_AUTH_PASS`**: SMTP password.
- **`EMAIL_TEST_DEV`**: адрес для тестовых отправок (используется в `controllers/adminPanel.controller.js`).

### Платежи / web3

- **`METAMASK_PRIV_KEY`**: приватный ключ для подписания/выплат (используется в `lib/payout.js`).

### Прочее

- **`RECAPTCHA_SECRET_KEY`**: секрет reCAPTCHA (см. `lib/lib.js`).
- **`DEREBIT_CLIENT_ID`**, **`DEREBIT_CLIENT_SECRET`**: доступ к Deribit (см. `lib/auth.js`).
- **`REF_FEE`**: реферальная комиссия/параметр (используется в контроллерах/скриптах).

## База данных

- Конфиг для Sequelize CLI берётся из `database/config.json` (см. `npm run db:migrate`).
- Модели лежат в `database/models/`.
- Инициализация подключения: `database/index.js`.

## Структура проекта (основное)

- `index.js` — точка входа, поднятие Express, CRUD и фоновые интервалы
- `rotes/router.js` — API роутер (опечатка в названии папки сохранена)
- `controllers/` — контроллеры
- `lib/` — бизнес-логика/интеграции
- `database/` — модели, миграции, конфиги
- `service_script/` — сервисные скрипты/утилиты
- `test/` — тесты

## Замечания по безопасности

- **Не коммитьте** `.env.dev` / `.env.prod` и приватные ключи.
- `METAMASK_PRIV_KEY` и `TELEGRAM_KEY` храните только в секретах окружения.

