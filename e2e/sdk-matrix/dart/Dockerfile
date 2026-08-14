FROM dart:stable AS build
WORKDIR /fixture
COPY pubspec.yaml ./
RUN dart pub get
COPY bin ./bin
RUN dart compile exe bin/main.dart -o /sdk-probe

FROM debian:bookworm-slim
COPY --from=build /sdk-probe /sdk-probe
CMD ["/sdk-probe"]
