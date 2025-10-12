# ML Service

Простой FastAPI-сервис, который выполняет health-check и загружает каталог товаров из внешнего API.

## Установка зависимостей

```bash
cd ml_service
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\\Scripts\\activate
pip install -r requirements.txt
```

## Запуск приложения

```bash
uvicorn ml_service.app:app --host 0.0.0.0 --port 8000
```

После запуска проверка здоровья доступна по адресу `http://localhost:8000/health` и возвращает:

```json
{"status": "ok"}
```

Для отладки вы можете запросить текущий каталог через `GET http://localhost:8000/catalog`.

## Настройка подключения к API каталога

Сервис использует переменные окружения для конфигурации:

- `CATALOG_API_BASE_URL` — базовый URL API каталога (по умолчанию `http://localhost:8080`).
- `CATALOG_REQUEST_TIMEOUT` — таймаут HTTP-запросов в секундах (по умолчанию `10`).
- `CATALOG_PAGE_SIZE` — размер страницы при постраничной загрузке (по умолчанию `100`).

Создайте файл `.env` в директории `ml_service` или экспортируйте переменные окружения перед запуском:

```bash
export CATALOG_API_BASE_URL="https://example.com"
export CATALOG_REQUEST_TIMEOUT=15
export CATALOG_PAGE_SIZE=50
```

## Как работает загрузка каталога

Модуль `catalog_loader.py` сначала пытается получить весь список товаров через `/api/products/all`. Если endpoint отсутствует, загрузка происходит постранично через `/api/products` с параметрами `page` и `pageSize` до тех пор, пока элементы не закончатся или не будет достигнута последняя страница.

## Персонализированные рекомендации

Для построения персонализированных рекомендаций используется факторизация матрицы взаимодействий (алгоритм `SVD` из библиотеки `surprise`). При старте контейнера скрипт `train_model.py` загружает все оценки пользователей, обучает модель и сохраняет предсказания в `user_recommendations.json`. Параметры обучения настраиваются через переменные окружения:

- `DATABASE_URL` — строка подключения к PostgreSQL. Если указана, рейтинги загружаются напрямую из таблицы `ratings`.
- `RATINGS_API_BASE_URL` — URL API, из которого можно выгрузить оценки (`/ratings/export`). Используется как резервный источник.
- `RATINGS_API_TOKEN` — необязательный токен, который передаётся в заголовке `x-export-token` при обращении к API.
- `RATINGS_REQUEST_TIMEOUT` — таймаут запросов к API рейтингов (в секундах, по умолчанию `10`).
- `RECOMMENDATIONS_OUTPUT_PATH` — путь к JSON-файлу с персональными рекомендациями (по умолчанию `user_recommendations.json` рядом с приложением).
- `NEIGHBORS_PATH` — путь к файлу с контент-бейз фолбэком (`product_neighbors.json`).

Пересчёт рекомендаций можно выполнить вручную:

```bash
cd ml_service
python train_model.py
```

API `/recs/personalized` возвращает список `{ "product_id": ..., "score": ... }` для конкретного пользователя. Если персональные данные отсутствуют, сервис использует контент-бейз фолбэк из `product_neighbors.json`.
