//! Filesystem boundary and source-preserving operations for Brainarium MCP.
//!
//! The configured vault is canonicalized once when the server starts. Every
//! tool path is then resolved from that canonical root, rejects traversal and
//! symlinks, and is restricted to the formats Brainarium currently supports.

use std::{
    fmt,
    fs::{self, OpenOptions},
    io::{self, Write},
    path::{Component, Path, PathBuf},
    time::{SystemTime, UNIX_EPOCH},
};

use sha2::{Digest, Sha256};

pub const SUPPORTED_EXTENSIONS: [&str; 6] = ["md", "csv", "txt", "json", "xml", "html"];
pub const DEFAULT_MAX_FILE_BYTES: u64 = 5 * 1024 * 1024;
pub const MAX_CONFIGURED_FILE_BYTES: u64 = 64 * 1024 * 1024;

#[derive(Debug)]
pub enum VaultError {
    Configuration(String),
    InvalidPath(String),
    UnsupportedFileType(String),
    NotFound(String),
    NotAFile(String),
    VersionConflict(String),
    WriteDisabled,
    FileTooLarge { requested: u64, maximum: u64 },
    Io(io::Error),
}

impl fmt::Display for VaultError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Configuration(message)
            | Self::InvalidPath(message)
            | Self::UnsupportedFileType(message)
            | Self::NotFound(message)
            | Self::NotAFile(message)
            | Self::VersionConflict(message) => formatter.write_str(message),
            Self::WriteDisabled => formatter
                .write_str("writing is disabled; set BRAINARIUM_MCP_ALLOW_WRITE=true to enable it"),
            Self::FileTooLarge { requested, maximum } => write!(
                formatter,
                "file content is {requested} bytes, above this server's {maximum}-byte limit"
            ),
            Self::Io(error) => error.fmt(formatter),
        }
    }
}

impl std::error::Error for VaultError {}

impl From<io::Error> for VaultError {
    fn from(error: io::Error) -> Self {
        Self::Io(error)
    }
}

#[derive(Debug, Clone, serde::Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct FileInfo {
    pub path: String,
    pub extension: String,
    pub size_bytes: u64,
    pub modified_unix_ms: Option<u128>,
}

#[derive(Debug, Clone, serde::Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct FileContent {
    pub path: String,
    pub content: String,
    pub size_bytes: u64,
    pub version: String,
}

#[derive(Debug, Clone, serde::Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct WriteReceipt {
    pub path: String,
    pub size_bytes: u64,
    pub created: bool,
    pub graph_rebuilt: bool,
    pub version: String,
}

#[derive(Debug, Clone)]
pub struct Vault {
    root: PathBuf,
    write_enabled: bool,
    max_file_bytes: u64,
}

impl Vault {
    pub fn from_environment() -> Result<Self, VaultError> {
        let vault = std::env::var("BRAINARIUM_VAULT").map_err(|_| {
            VaultError::Configuration(
                "BRAINARIUM_VAULT must contain the absolute path to one vault directory".into(),
            )
        })?;
        let write_enabled = std::env::var("BRAINARIUM_MCP_ALLOW_WRITE")
            .ok()
            .is_some_and(|value| value.eq_ignore_ascii_case("true"));
        let max_file_bytes = std::env::var("BRAINARIUM_MCP_MAX_FILE_BYTES")
            .ok()
            .map(|value| {
                value.parse::<u64>().map_err(|_| {
                    VaultError::Configuration(
                        "BRAINARIUM_MCP_MAX_FILE_BYTES must be a positive integer".into(),
                    )
                })
            })
            .transpose()?
            .unwrap_or(DEFAULT_MAX_FILE_BYTES);

        Self::open(vault, write_enabled, max_file_bytes)
    }

    pub fn open(
        root: impl AsRef<Path>,
        write_enabled: bool,
        max_file_bytes: u64,
    ) -> Result<Self, VaultError> {
        if max_file_bytes == 0 || max_file_bytes > MAX_CONFIGURED_FILE_BYTES {
            return Err(VaultError::Configuration(format!(
                "maximum file size must be between 1 and {MAX_CONFIGURED_FILE_BYTES} bytes"
            )));
        }

        let root = fs::canonicalize(root.as_ref()).map_err(|error| {
            VaultError::Configuration(format!(
                "could not open configured vault {}: {error}",
                root.as_ref().display()
            ))
        })?;
        if !root.is_dir() {
            return Err(VaultError::Configuration(
                "BRAINARIUM_VAULT must point to a directory".into(),
            ));
        }

        Ok(Self {
            root,
            write_enabled,
            max_file_bytes,
        })
    }

    pub fn root(&self) -> &Path {
        &self.root
    }

    pub fn write_enabled(&self) -> bool {
        self.write_enabled
    }

    pub fn max_file_bytes(&self) -> u64 {
        self.max_file_bytes
    }

    pub fn list_files(&self, path_prefix: Option<&str>) -> Result<Vec<FileInfo>, VaultError> {
        let start = match path_prefix.filter(|prefix| !prefix.trim().is_empty()) {
            Some(prefix) => self.resolve_existing_directory(prefix)?,
            None => self.root.clone(),
        };

        let mut files = Vec::new();
        self.collect_files(&start, &mut files)?;
        files.sort_by(|left, right| left.path.cmp(&right.path));
        Ok(files)
    }

    pub fn read_file(&self, path: &str) -> Result<FileContent, VaultError> {
        let resolved = self.resolve_existing_file(path)?;
        let bytes = fs::read(&resolved)?;
        self.enforce_size(bytes.len() as u64)?;
        let content = String::from_utf8(bytes.clone()).map_err(|_| {
            VaultError::Configuration(format!(
                "{} is not valid UTF-8 text",
                self.relative_display(&resolved)
            ))
        })?;

        Ok(FileContent {
            path: self.relative_display(&resolved),
            content,
            size_bytes: bytes.len() as u64,
            version: version_for(&bytes),
        })
    }

    pub fn write_file(
        &self,
        path: &str,
        content: &str,
        expected_version: Option<&str>,
    ) -> Result<WriteReceipt, VaultError> {
        if !self.write_enabled {
            return Err(VaultError::WriteDisabled);
        }
        self.enforce_size(content.len() as u64)?;

        let (destination, created) = self.resolve_writable_file(path)?;
        let parent = destination.parent().ok_or_else(|| {
            VaultError::InvalidPath("a vault file must have a parent directory".into())
        })?;
        self.assert_directory_without_symlink(parent)?;

        if !created {
            let current = fs::read(&destination)?;
            let actual_version = version_for(&current);
            let expected_version = expected_version.ok_or_else(|| {
                VaultError::VersionConflict(
                    "read the current file and provide its version before replacing it".into(),
                )
            })?;
            if actual_version != expected_version {
                return Err(VaultError::VersionConflict(
                    "this file changed since it was read; read it again before writing".into(),
                ));
            }
        }

        let temporary = self.temporary_path(parent, destination.file_name().unwrap_or_default())?;
        let write_result = Self::write_atomically(&temporary, &destination, content.as_bytes());
        if write_result.is_err() {
            let _ = fs::remove_file(&temporary);
        }
        write_result?;

        let graph_rebuilt =
            is_markdown(&destination) && brainarium_indexer::index_vault(&self.root).is_ok();

        Ok(WriteReceipt {
            path: self.relative_display(&destination),
            size_bytes: content.len() as u64,
            created,
            graph_rebuilt,
            version: version_for(content.as_bytes()),
        })
    }

    fn collect_files(
        &self,
        directory: &Path,
        output: &mut Vec<FileInfo>,
    ) -> Result<(), VaultError> {
        for entry in fs::read_dir(directory)? {
            let entry = entry?;
            let file_type = entry.file_type()?;
            let name = entry.file_name();
            if name.to_string_lossy().starts_with('.') || file_type.is_symlink() {
                continue;
            }
            let path = entry.path();
            if file_type.is_dir() {
                self.collect_files(&path, output)?;
                continue;
            }
            if !file_type.is_file() || !is_supported_file(&path) {
                continue;
            }
            let metadata = entry.metadata()?;
            output.push(FileInfo {
                path: self.relative_display(&path),
                extension: extension_for(&path).expect("supported file has an extension"),
                size_bytes: metadata.len(),
                modified_unix_ms: metadata
                    .modified()
                    .ok()
                    .and_then(|time| time.duration_since(UNIX_EPOCH).ok())
                    .map(|duration| duration.as_millis()),
            });
        }
        Ok(())
    }

    fn resolve_existing_directory(&self, user_path: &str) -> Result<PathBuf, VaultError> {
        let relative = validate_relative_path(user_path)?;
        self.reject_symlink_components(&relative, false)?;
        let candidate = self.root.join(&relative);
        let canonical = fs::canonicalize(&candidate).map_err(|error| match error.kind() {
            io::ErrorKind::NotFound => VaultError::NotFound(format!("{user_path} does not exist")),
            _ => VaultError::Io(error),
        })?;
        if !canonical.starts_with(&self.root) || !canonical.is_dir() {
            return Err(VaultError::InvalidPath(format!(
                "{user_path} is not a directory inside the configured vault"
            )));
        }
        Ok(canonical)
    }

    fn resolve_existing_file(&self, user_path: &str) -> Result<PathBuf, VaultError> {
        let relative = validate_relative_path(user_path)?;
        self.assert_supported_path(&relative)?;
        self.reject_symlink_components(&relative, false)?;
        let candidate = self.root.join(&relative);
        let canonical = fs::canonicalize(&candidate).map_err(|error| match error.kind() {
            io::ErrorKind::NotFound => VaultError::NotFound(format!("{user_path} does not exist")),
            _ => VaultError::Io(error),
        })?;
        if !canonical.starts_with(&self.root) {
            return Err(VaultError::InvalidPath(format!(
                "{user_path} resolves outside the configured vault"
            )));
        }
        if !canonical.is_file() {
            return Err(VaultError::NotAFile(format!("{user_path} is not a file")));
        }
        Ok(canonical)
    }

    fn resolve_writable_file(&self, user_path: &str) -> Result<(PathBuf, bool), VaultError> {
        let relative = validate_relative_path(user_path)?;
        self.assert_supported_path(&relative)?;
        self.reject_symlink_components(&relative, true)?;
        let candidate = self.root.join(&relative);
        let parent = candidate.parent().ok_or_else(|| {
            VaultError::InvalidPath("a vault file must have a parent directory".into())
        })?;
        let canonical_parent = fs::canonicalize(parent).map_err(|error| match error.kind() {
            io::ErrorKind::NotFound => VaultError::NotFound(format!(
                "the parent directory for {user_path} does not exist; create it explicitly first"
            )),
            _ => VaultError::Io(error),
        })?;
        if !canonical_parent.starts_with(&self.root) || !canonical_parent.is_dir() {
            return Err(VaultError::InvalidPath(format!(
                "{user_path} is not inside the configured vault"
            )));
        }

        let destination =
            canonical_parent.join(relative.file_name().ok_or_else(|| {
                VaultError::InvalidPath("a vault file must have a filename".into())
            })?);
        let created = match fs::symlink_metadata(&destination) {
            Ok(metadata) => {
                if metadata.file_type().is_symlink() {
                    return Err(VaultError::InvalidPath(format!(
                        "{user_path} is a symlink and cannot be written"
                    )));
                }
                if !metadata.is_file() {
                    return Err(VaultError::NotAFile(format!("{user_path} is not a file")));
                }
                false
            }
            Err(error) if error.kind() == io::ErrorKind::NotFound => true,
            Err(error) => return Err(VaultError::Io(error)),
        };
        Ok((destination, created))
    }

    fn reject_symlink_components(
        &self,
        relative: &Path,
        allow_missing_final: bool,
    ) -> Result<(), VaultError> {
        let components: Vec<_> = relative.components().collect();
        let mut current = self.root.clone();
        for (index, component) in components.iter().enumerate() {
            let Component::Normal(name) = component else {
                return Err(VaultError::InvalidPath(
                    "path must be a clean relative path".into(),
                ));
            };
            current.push(name);
            match fs::symlink_metadata(&current) {
                Ok(metadata) if metadata.file_type().is_symlink() => {
                    return Err(VaultError::InvalidPath(
                        "symlink paths are not available through Brainarium MCP".into(),
                    ));
                }
                Ok(_) => {}
                Err(error)
                    if allow_missing_final
                        && index + 1 == components.len()
                        && error.kind() == io::ErrorKind::NotFound =>
                {
                    return Ok(());
                }
                Err(error) if error.kind() == io::ErrorKind::NotFound => {
                    return Err(VaultError::NotFound(format!(
                        "{} does not exist",
                        relative.display()
                    )));
                }
                Err(error) => return Err(VaultError::Io(error)),
            }
        }
        Ok(())
    }

    fn assert_directory_without_symlink(&self, directory: &Path) -> Result<(), VaultError> {
        let metadata = fs::symlink_metadata(directory)?;
        if metadata.file_type().is_symlink() || !metadata.is_dir() {
            return Err(VaultError::InvalidPath(
                "the target directory is not a direct vault directory".into(),
            ));
        }
        let canonical = fs::canonicalize(directory)?;
        if !canonical.starts_with(&self.root) {
            return Err(VaultError::InvalidPath(
                "the target directory is outside the configured vault".into(),
            ));
        }
        Ok(())
    }

    fn assert_supported_path(&self, path: &Path) -> Result<(), VaultError> {
        if is_supported_file(path) {
            return Ok(());
        }
        Err(VaultError::UnsupportedFileType(format!(
            "{} is not supported; use one of: {}",
            path.display(),
            SUPPORTED_EXTENSIONS.join(", ")
        )))
    }

    fn enforce_size(&self, size: u64) -> Result<(), VaultError> {
        if size > self.max_file_bytes {
            return Err(VaultError::FileTooLarge {
                requested: size,
                maximum: self.max_file_bytes,
            });
        }
        Ok(())
    }

    fn temporary_path(
        &self,
        parent: &Path,
        file_name: &std::ffi::OsStr,
    ) -> Result<PathBuf, VaultError> {
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map_err(|error| VaultError::Configuration(error.to_string()))?
            .as_nanos();
        let prefix = format!(".brainarium-mcp-{}-{timestamp}", std::process::id());
        let candidate = parent.join(format!("{prefix}-{}", file_name.to_string_lossy()));
        Ok(candidate)
    }

    fn write_atomically(
        temporary: &Path,
        destination: &Path,
        bytes: &[u8],
    ) -> Result<(), VaultError> {
        let mut temporary_file = OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(temporary)?;
        temporary_file.write_all(bytes)?;
        temporary_file.sync_all()?;
        drop(temporary_file);
        fs::rename(temporary, destination)?;
        Ok(())
    }

    fn relative_display(&self, path: &Path) -> String {
        path.strip_prefix(&self.root)
            .expect("all resolved paths live in the configured vault")
            .to_string_lossy()
            .replace('\\', "/")
    }
}

fn validate_relative_path(user_path: &str) -> Result<PathBuf, VaultError> {
    let input = user_path.trim();
    if input.is_empty() {
        return Err(VaultError::InvalidPath("path must not be empty".into()));
    }
    let path = Path::new(input);
    if path.is_absolute() {
        return Err(VaultError::InvalidPath(
            "paths must be relative to the configured vault".into(),
        ));
    }

    let mut clean = PathBuf::new();
    for component in path.components() {
        match component {
            Component::Normal(name)
                if !name.is_empty() && !name.to_string_lossy().starts_with('.') =>
            {
                clean.push(name)
            }
            Component::Normal(_) => {
                return Err(VaultError::InvalidPath(
                    "hidden files and directories are not exposed through Brainarium MCP".into(),
                ));
            }
            Component::CurDir
            | Component::ParentDir
            | Component::RootDir
            | Component::Prefix(_) => {
                return Err(VaultError::InvalidPath(
                    "path traversal and absolute paths are not allowed".into(),
                ));
            }
        }
    }
    if clean.as_os_str().is_empty() {
        return Err(VaultError::InvalidPath(
            "path must name a file or directory".into(),
        ));
    }
    Ok(clean)
}

fn is_supported_file(path: &Path) -> bool {
    extension_for(path).is_some()
}

fn is_markdown(path: &Path) -> bool {
    matches!(
        path.extension().and_then(|extension| extension.to_str()),
        Some(extension) if extension.eq_ignore_ascii_case("md")
            || extension.eq_ignore_ascii_case("markdown")
    )
}

fn extension_for(path: &Path) -> Option<String> {
    let extension = path.extension()?.to_str()?.to_ascii_lowercase();
    SUPPORTED_EXTENSIONS
        .contains(&extension.as_str())
        .then_some(extension)
}

fn version_for(bytes: &[u8]) -> String {
    format!("{:x}", Sha256::digest(bytes))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::{collections::BTreeSet, fs, thread, time::Duration};

    struct TestVault {
        path: PathBuf,
    }

    impl TestVault {
        fn new() -> Self {
            let unique = format!(
                "brainarium-mcp-test-{}-{}",
                std::process::id(),
                SystemTime::now()
                    .duration_since(UNIX_EPOCH)
                    .expect("clock after epoch")
                    .as_nanos()
            );
            let path = std::env::temp_dir().join(unique);
            fs::create_dir_all(&path).expect("create temp vault");
            Self { path }
        }

        fn vault(&self, write_enabled: bool) -> Vault {
            Vault::open(&self.path, write_enabled, 1024 * 1024).expect("open test vault")
        }

        fn write(&self, relative: &str, content: &str) {
            let path = self.path.join(relative);
            fs::create_dir_all(path.parent().expect("parent")).expect("create parent");
            fs::write(path, content).expect("write fixture");
        }
    }

    impl Drop for TestVault {
        fn drop(&mut self) {
            for _ in 0..3 {
                if fs::remove_dir_all(&self.path).is_ok() {
                    return;
                }
                thread::sleep(Duration::from_millis(10));
            }
        }
    }

    #[test]
    fn lists_only_supported_non_hidden_files() {
        let fixture = TestVault::new();
        fixture.write("notes/plan.md", "# plan");
        fixture.write("notes/table.CSV", "a,b");
        fixture.write("image.png", "not actually an image");
        fixture.write(".brainarium/graph-v1.json", "{}");

        let files = fixture.vault(false).list_files(None).expect("list files");
        assert_eq!(
            files
                .iter()
                .map(|file| file.path.as_str())
                .collect::<Vec<_>>(),
            vec!["notes/plan.md", "notes/table.CSV"]
        );
        assert_eq!(files[1].extension, "csv");
    }

    #[test]
    fn reads_raw_source_and_rejects_path_escapes() {
        let fixture = TestVault::new();
        fixture.write("notes/raw.md", "# Exact\n\n[[unchanged]]\n");
        let vault = fixture.vault(false);

        assert_eq!(
            vault.read_file("notes/raw.md").expect("read file").content,
            "# Exact\n\n[[unchanged]]\n"
        );
        assert!(matches!(
            vault.read_file("../outside.md"),
            Err(VaultError::InvalidPath(_))
        ));
        assert!(matches!(
            vault.read_file(".brainarium/graph-v1.json"),
            Err(VaultError::InvalidPath(_))
        ));
        assert!(matches!(
            vault.read_file("notes/raw.pdf"),
            Err(VaultError::UnsupportedFileType(_))
        ));
    }

    #[test]
    fn writes_atomically_without_creating_directories() {
        let fixture = TestVault::new();
        fixture.write("notes/existing.md", "before");
        let vault = fixture.vault(true);
        let existing_version = vault.read_file("notes/existing.md").unwrap().version;

        let existing = vault
            .write_file("notes/existing.md", "after", Some(&existing_version))
            .expect("overwrite exact source");
        assert!(!existing.created);
        assert!(existing.graph_rebuilt);
        assert!(fixture.path.join(".brainarium/graph-v1.json").is_file());
        assert_eq!(
            fs::read_to_string(fixture.path.join("notes/existing.md")).unwrap(),
            "after"
        );

        let created = vault
            .write_file("notes/new.txt", "new source", None)
            .expect("create supported file");
        assert!(created.created);
        assert_eq!(created.size_bytes, 10);
        assert!(matches!(
            vault.write_file("missing/new.md", "not allowed", None),
            Err(VaultError::NotFound(_))
        ));
    }

    #[test]
    fn rejects_write_without_explicit_capability() {
        let fixture = TestVault::new();
        fixture.write("notes/existing.md", "before");
        assert!(matches!(
            fixture
                .vault(false)
                .write_file("notes/existing.md", "after", None),
            Err(VaultError::WriteDisabled)
        ));
    }

    #[test]
    fn requires_a_current_version_to_replace_a_file() {
        let fixture = TestVault::new();
        fixture.write("notes/existing.md", "before");
        let vault = fixture.vault(true);
        let read = vault.read_file("notes/existing.md").expect("read source");

        assert!(matches!(
            vault.write_file("notes/existing.md", "after", None),
            Err(VaultError::VersionConflict(_))
        ));
        fixture.write("notes/existing.md", "external change");
        assert!(matches!(
            vault.write_file("notes/existing.md", "after", Some(&read.version)),
            Err(VaultError::VersionConflict(_))
        ));
    }

    #[cfg(unix)]
    #[test]
    fn rejects_symlinks_even_when_they_point_back_into_the_vault() {
        use std::os::unix::fs::symlink;

        let fixture = TestVault::new();
        fixture.write("notes/actual.md", "private");
        symlink(
            fixture.path.join("notes/actual.md"),
            fixture.path.join("notes/linked.md"),
        )
        .expect("make symlink");

        assert!(matches!(
            fixture.vault(false).read_file("notes/linked.md"),
            Err(VaultError::InvalidPath(_))
        ));
    }

    #[test]
    fn applies_the_configured_size_limit() {
        let fixture = TestVault::new();
        fixture.write("notes/large.txt", "12345");
        let vault = Vault::open(&fixture.path, false, 4).expect("open vault");
        assert!(matches!(
            vault.read_file("notes/large.txt"),
            Err(VaultError::FileTooLarge {
                requested: 5,
                maximum: 4
            })
        ));
    }

    #[test]
    fn supported_extensions_are_unique() {
        let unique: BTreeSet<_> = SUPPORTED_EXTENSIONS.into_iter().collect();
        assert_eq!(unique.len(), SUPPORTED_EXTENSIONS.len());
    }
}
