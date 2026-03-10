ARG MAVEN_IMAGE=maven:3.9.9-eclipse-temurin-21
ARG JAVA_IMAGE=eclipse-temurin:21-jre-jammy

FROM ${MAVEN_IMAGE} AS builder
WORKDIR /build

COPY pom.xml ./
RUN mvn -q dependency:go-offline

COPY src ./src
RUN mvn -q -DskipTests package

FROM ${JAVA_IMAGE}
WORKDIR /app

COPY --from=builder /build/target/crseume-backend-0.0.1-SNAPSHOT.jar ./app.jar

EXPOSE 8080

ENTRYPOINT ["java", "-jar", "/app/app.jar"]
