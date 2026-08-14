package main

import (
	"os"
	"time"

	"github.com/getsentry/sentry-go"
)

func main() {
	if err := sentry.Init(sentry.ClientOptions{
		Dsn:         os.Getenv("SPICYTRACK_DSN"),
		Environment: "sdk-matrix",
		Release:     "sdk-go@0.48.0",
	}); err != nil {
		panic(err)
	}
	event := sentry.NewEvent()
	event.Level = sentry.LevelError
	event.Exception = []sentry.Exception{{
		Type:       "ProbeError",
		Value:      "Real Go SDK compatibility probe",
		Stacktrace: sentry.NewStacktrace(),
	}}
	sentry.CaptureEvent(event)
	if !sentry.Flush(10 * time.Second) {
		panic("Go SDK failed to flush its event")
	}
}
