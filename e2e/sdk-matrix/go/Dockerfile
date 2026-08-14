FROM golang:1.26-alpine AS build
WORKDIR /fixture
COPY go.mod main.go ./
RUN go mod tidy && go build -o /sdk-probe .

FROM alpine:3.23
COPY --from=build /sdk-probe /sdk-probe
CMD ["/sdk-probe"]
