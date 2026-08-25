"""Exec the Rust server without touching its stdin or stdout protocol stream."""

from __future__ import annotations

import os
from pathlib import Path


def main() -> None:
    project_root = Path(__file__).resolve().parents[2]
    explicit_binary = os.environ.get("BRAINARIUM_MCP_BINARY")
    binary = Path(explicit_binary) if explicit_binary else project_root / "target" / "release" / "brainarium-mcp"

    if binary.is_file():
        os.execv(str(binary), [str(binary)])

    cargo = os.environ.get("CARGO", "cargo")
    os.execvp(
        cargo,
        [
            cargo,
            "run",
            "--quiet",
            "--release",
            "--manifest-path",
            str(project_root / "Cargo.toml"),
            "--",
        ],
    )
