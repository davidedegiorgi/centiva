#!/bin/sh
set -eu

php artisan config:cache
php artisan route:cache
php artisan migrate --force --no-interaction

export PHP_CLI_SERVER_WORKERS="${PHP_CLI_SERVER_WORKERS:-4}"

exec php artisan serve --host=0.0.0.0 --port="${PORT:-8000}"
