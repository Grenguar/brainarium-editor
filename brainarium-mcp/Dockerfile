FROM rust:1.88-bookworm AS build
WORKDIR /src

COPY rust ./rust
COPY brainarium-mcp/Cargo.toml brainarium-mcp/Cargo.lock ./brainarium-mcp/
COPY brainarium-mcp/src ./brainarium-mcp/src
WORKDIR /src/brainarium-mcp
RUN cargo build --release --locked

FROM debian:bookworm-slim
RUN useradd --create-home --uid 10001 brainarium
COPY --from=build /src/brainarium-mcp/target/release/brainarium-mcp /usr/local/bin/brainarium-mcp
USER brainarium
ENTRYPOINT ["brainarium-mcp"]
