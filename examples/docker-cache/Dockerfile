FROM alpine:3.22

RUN apk add --no-cache ca-certificates

WORKDIR /app
COPY hello.txt .

CMD ["cat", "/app/hello.txt"]
