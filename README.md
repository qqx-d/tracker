# Daily Check-in Tracker

Приложение для ежедневных чек-инов с друзьями.

## Структура

```
frontend/   — React (Vite) — деплоится на GitHub Pages
backend/    — Deno Deploy API с Deno KV
icons/      — иконки навигации
```

## Быстрый старт

### Backend (Deno)

```bash
cd backend
deno run --allow-net --allow-read --unstable-kv main.ts
```

Backend запустится на `http://localhost:8000`.

### Frontend (React)

```bash
cd frontend
npm install
npm run dev
```

Фронтенд запустится на `http://localhost:5173` с прокси на бэкенд.

## Деплой

### GitHub Pages (Frontend)

1. Установи URL бэкенда в `frontend/src/api.js` (строка с `your-app.deno.dev`)
2. Собери фронтенд:
   ```bash
   cd frontend
   npm run build
   ```
3. Запуш содержимое `frontend/dist` в ветку `gh-pages`,
   или используй GitHub Actions (см. `.github/workflows/deploy.yml`)

### Deno Deploy (Backend)

1. Перейди на [dash.deno.com](https://dash.deno.com)
2. Создай новый проект
3. Подключи репозиторий → укажи entry point: `backend/main.ts`
4. Deno KV включится автоматически

## Фичи

- 📱 Мобильный UI
- 👥 Лобби с уникальным кодом для подключения
- ✅ Ежедневный чек-ин
- 📊 Статистика за последние 14 дней
- 🔥 Подсчёт streak'ов
- ❌ Пропущенный день = крестик в статистике
