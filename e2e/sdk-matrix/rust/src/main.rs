use std::{borrow::Cow, io, time::Duration};

fn main() {
    let dsn = std::env::var("SPICYTRACK_DSN").expect("SPICYTRACK_DSN is required");
    let mut options = sentry::ClientOptions::default();
    options.environment = Some(Cow::Borrowed("sdk-matrix"));
    options.release = Some(Cow::Borrowed("sdk-rust@0.49.1"));
    let guard = sentry::init((dsn, options));
    sentry::capture_error(&io::Error::other("Real Rust SDK compatibility probe"));
    guard.close(Some(Duration::from_secs(10)));
}
