#!/bin/sh
set -eu

php artisan config:cache
php artisan route:cache
php artisan migrate --force --no-interaction

exec php artisan serve --host=0.0.0.0 --port="${PORT:-8000}"
