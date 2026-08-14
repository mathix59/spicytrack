require "sentry-ruby"

Sentry.init do |config|
  config.dsn = ENV.fetch("SPICYTRACK_DSN")
  config.environment = "sdk-matrix"
  config.release = "sdk-ruby@6.7.0"
end

begin
  raise "Real Ruby SDK compatibility probe"
rescue RuntimeError => error
  Sentry.capture_exception(error)
end
Sentry.get_current_client.flush
