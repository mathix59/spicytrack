<?php

require __DIR__ . '/vendor/autoload.php';

Sentry\init([
    'dsn' => getenv('SPICYTRACK_DSN'),
    'environment' => 'sdk-matrix',
    'release' => 'sdk-php@4.30.0',
]);
try {
    throw new RuntimeException('Real PHP SDK compatibility probe');
} catch (RuntimeException $error) {
    Sentry\captureException($error);
}
Sentry\flush(10);
