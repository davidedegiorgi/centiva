FROM composer:2 AS vendor
WORKDIR /app
COPY composer.json composer.lock ./
RUN composer install --no-dev --no-interaction --no-scripts --prefer-dist

FROM php:8.4-cli-alpine
RUN apk add --no-cache libpq-dev \
    && docker-php-ext-install pdo_pgsql \
    && rm -rf /tmp/*
WORKDIR /app
COPY --from=vendor /app/vendor ./vendor
COPY . .
RUN php artisan package:discover --ansi \
    && chown -R www-data:www-data storage bootstrap/cache \
    && chmod +x docker/entrypoint.sh
USER www-data
EXPOSE 8000
ENTRYPOINT ["docker/entrypoint.sh"]
