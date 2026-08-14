FROM maven:3.9-eclipse-temurin-21-alpine AS build
WORKDIR /fixture
COPY pom.xml ./
RUN mvn --batch-mode dependency:go-offline
COPY src ./src
RUN mvn --batch-mode package

FROM eclipse-temurin:21-jre-alpine
COPY --from=build /fixture/target/sdk-probe-1.0.0.jar /sdk-probe.jar
CMD ["java", "-jar", "/sdk-probe.jar"]
