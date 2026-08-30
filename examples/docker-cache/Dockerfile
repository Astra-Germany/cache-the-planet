FROM docker.stirlingpdf.com/stirlingtools/stirling-pdf:latest as builder

RUN ls -la /usr/local/bin/stirling-pdf
RUN /usr/local/bin/stirling-pdf --version

FROM alpine:3.22

RUN apk add --no-cache ca-certificates

WORKDIR /app
COPY hello.txt .

CMD ["cat", "/app/hello.txt"]
