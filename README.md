# Охотничий минимум — официальный тренажер

Приложение работает только на официальном банке вопросов Минприроды РФ (`data/official_bank.json`).

## Fail-fast поведение

- Если `data/official_bank.json` или `data/official_bank.hash` отсутствуют/повреждены, API отвечает `503` и UI показывает `SYSTEM NOT READY`.
- Любое несоответствие hash или схемы считается критической ошибкой целостности.

## Команды

```bash
npm install
npm run update:official      # скачать и обновить официальный банк
npm run verify:integrity     # проверить hash + schema + versions
npm run dev                  # локальный запуск
npm run build && npm start   # production
npm run build:pages          # собрать статику для GitHub Pages
```

## Официальный источник

Настраивается в `config/official-source.json`.

## Контроль целостности

- `data/official_bank.json` — текущий официальный банк
- `data/official_bank.hash` — SHA-256 банка
- `data/official_versions.json` — immutable история версий

## Деплой на бесплатный GitHub Pages

1. Загрузите официальный банк:
```bash
npm run update:official
npm run verify:integrity
```
2. Запушьте репозиторий в GitHub на ветку `main`.
3. В GitHub: `Settings -> Pages -> Source: GitHub Actions`.
4. Workflow `Deploy GitHub Pages` из `.github/workflows/deploy-pages.yml` опубликует сайт.

Если банк отсутствует, опубликованный сайт корректно показывает `SYSTEM NOT READY`.
