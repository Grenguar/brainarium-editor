use std::sync::Arc;

use brainarium_mcp::{SUPPORTED_EXTENSIONS, Vault, VaultError};
use rmcp::{
    ErrorData, handler::server::wrapper::Parameters, schemars, service::ServiceExt, tool,
    tool_router,
};
use serde::{Deserialize, Serialize};

#[derive(Clone)]
struct BrainariumVaultServer {
    vault: Arc<Vault>,
}

#[derive(Debug, Deserialize, schemars::JsonSchema)]
#[serde(rename_all = "camelCase")]
struct ListFilesParams {
    /// Optional direct, non-hidden folder path relative to the configured vault.
    path_prefix: Option<String>,
}

#[derive(Debug, Deserialize, schemars::JsonSchema)]
struct FilePathParams {
    /// A non-hidden relative path inside the configured vault.
    path: String,
}

#[derive(Debug, Deserialize, schemars::JsonSchema)]
#[serde(rename_all = "camelCase")]
struct WriteFileParams {
    /// A non-hidden relative path inside the configured vault.
    path: String,
    /// The complete raw UTF-8 source to atomically save at `path`.
    content: String,
    /// Required SHA-256 version from read_file when replacing an existing file.
    expected_version: Option<String>,
    /// Create every missing, non-hidden parent folder inside the configured vault.
    #[serde(default)]
    create_parents: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct VaultStatus {
    root: String,
    supported_extensions: Vec<&'static str>,
    write_enabled: bool,
    max_file_bytes: u64,
}

#[tool_router(server_handler)]
impl BrainariumVaultServer {
    #[tool(
        description = "Return the configured vault boundary, supported file formats, and whether write_file is enabled."
    )]
    fn vault_status(&self) -> Result<String, ErrorData> {
        encode(&VaultStatus {
            root: self.vault.root().display().to_string(),
            supported_extensions: SUPPORTED_EXTENSIONS.to_vec(),
            write_enabled: self.vault.write_enabled(),
            max_file_bytes: self.vault.max_file_bytes(),
        })
    }

    #[tool(
        description = "List the Markdown, CSV, TXT, JSON, XML, and HTML files inside the configured vault. Hidden files and symlinks are excluded."
    )]
    fn list_files(
        &self,
        Parameters(ListFilesParams { path_prefix }): Parameters<ListFilesParams>,
    ) -> Result<String, ErrorData> {
        let files = self
            .vault
            .list_files(path_prefix.as_deref())
            .map_err(as_mcp_error)?;
        encode(&files)
    }

    #[tool(
        description = "Read one supported text file as exact UTF-8 source. The path must be non-hidden and relative to the configured vault."
    )]
    fn read_file(
        &self,
        Parameters(FilePathParams { path }): Parameters<FilePathParams>,
    ) -> Result<String, ErrorData> {
        let file = self.vault.read_file(&path).map_err(as_mcp_error)?;
        encode(&file)
    }

    #[tool(
        description = "Atomically create or replace one supported text file with the supplied raw UTF-8 source. This only works when BRAINARIUM_MCP_ALLOW_WRITE=true. Replacing a file requires expectedVersion from read_file. Set createParents=true to create missing non-hidden parent folders; paths never leave the configured vault. Markdown writes rebuild the local graph cache."
    )]
    fn write_file(
        &self,
        Parameters(WriteFileParams {
            path,
            content,
            expected_version,
            create_parents,
        }): Parameters<WriteFileParams>,
    ) -> Result<String, ErrorData> {
        let receipt = self
            .vault
            .write_file(&path, &content, expected_version.as_deref(), create_parents)
            .map_err(as_mcp_error)?;
        encode(&receipt)
    }

    #[tool(
        description = "Create a non-hidden directory path inside the configured vault. This is idempotent and only works when BRAINARIUM_MCP_ALLOW_WRITE=true. Symlinks, hidden paths, traversal, and paths outside the vault are rejected."
    )]
    fn create_directory(
        &self,
        Parameters(FilePathParams { path }): Parameters<FilePathParams>,
    ) -> Result<String, ErrorData> {
        let receipt = self.vault.create_directory(&path).map_err(as_mcp_error)?;
        encode(&receipt)
    }

    #[tool(
        description = "Return the deterministic Markdown graph derived from the configured vault's source files. This does not read or modify .brainarium/graph-v1.json, and excludes hidden paths and symlinks."
    )]
    fn vault_graph(&self) -> Result<String, ErrorData> {
        let graph = self.vault.vault_graph().map_err(as_mcp_error)?;
        encode(&graph)
    }

    #[tool(
        description = "Return resolved incoming and outgoing Markdown/wiki-link connections for one Markdown file. The result is derived directly from the configured vault's source graph and does not read or modify .brainarium/graph-v1.json."
    )]
    fn file_connections(
        &self,
        Parameters(FilePathParams { path }): Parameters<FilePathParams>,
    ) -> Result<String, ErrorData> {
        let connections = self.vault.file_connections(&path).map_err(as_mcp_error)?;
        encode(&connections)
    }
}

fn encode<T: Serialize>(value: &T) -> Result<String, ErrorData> {
    serde_json::to_string_pretty(value)
        .map_err(|error| ErrorData::internal_error(error.to_string(), None))
}

fn as_mcp_error(error: VaultError) -> ErrorData {
    match error {
        VaultError::NotFound(message) => ErrorData::resource_not_found(message, None),
        VaultError::InvalidPath(_)
        | VaultError::UnsupportedFileType(_)
        | VaultError::NotAFile(_)
        | VaultError::VersionConflict(_)
        | VaultError::FileTooLarge { .. } => ErrorData::invalid_params(error.to_string(), None),
        VaultError::WriteDisabled => ErrorData::invalid_request(error.to_string(), None),
        VaultError::Configuration(_) | VaultError::Io(_) => {
            ErrorData::internal_error(error.to_string(), None)
        }
    }
}

#[tokio::main]
async fn main() {
    let vault = match Vault::from_environment() {
        Ok(vault) => Arc::new(vault),
        Err(error) => {
            eprintln!("brainarium-mcp configuration error: {error}");
            std::process::exit(2);
        }
    };

    let server = BrainariumVaultServer { vault };
    let running = match server.serve(rmcp::transport::stdio()).await {
        Ok(running) => running,
        Err(error) => {
            eprintln!("brainarium-mcp could not initialize stdio: {error}");
            std::process::exit(1);
        }
    };

    if let Err(error) = running.waiting().await {
        eprintln!("brainarium-mcp stopped: {error}");
        std::process::exit(1);
    }
}
