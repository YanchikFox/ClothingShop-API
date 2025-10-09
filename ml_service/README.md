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
