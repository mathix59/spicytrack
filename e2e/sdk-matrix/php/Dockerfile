FROM composer:2 AS dependencies
WORKDIR /fixture
COPY composer.json ./
RUN composer install --no-dev --no-interaction --no-progress --prefer-dist \
  --ignore-platform-req=ext-curl --ignore-platform-req=ext-mbstring

FROM php:8.4-cli-alpine
RUN apk add --no-cache curl-dev oniguruma-dev \
  && docker-php-ext-install curl mbstring
WORKDIR /fixture
COPY --from=dependencies /fixture/vendor ./vendor
COPY main.php ./
CMD ["php", "main.php"]
