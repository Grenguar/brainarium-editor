# Context7 verification register

Status: blocked, 2026-08-25.

Context7 was requested for this specification, but its configured connector rejected resolution attempts for Electron, CodeMirror, and OpenAI Codex because the API key was invalid. No Context7 response is used as evidence here.

Until access is restored, primary documentation is the evidence source:

- [Electron security guidance](https://www.electronjs.org/docs/latest/tutorial/security)
- [CodeMirror documentation](https://codemirror.net/docs/)
- [CommonMark specification](https://spec.commonmark.org/spec)
- [GitHub Flavored Markdown specification](https://github.github.com/gfm/)
- [Codex app-server README](https://github.com/openai/codex/blob/main/codex-rs/app-server/README.md)
- [Apple sandbox file-access guidance](https://developer.apple.com/documentation/security/accessing-files-from-the-macos-app-sandbox)

When credentials are repaired, record for each query: library identifier, resolved version, queried topic, source URL/excerpt reference, date, and resulting decision. Rerun Electron security/IPC/directory-dialog/Forge checks, CodeMirror transaction/decoration/IME checks, and Codex stdio/lifecycle/approval/schema-generation checks.
