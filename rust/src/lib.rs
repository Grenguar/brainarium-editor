use std::collections::{BTreeMap, BTreeSet};
use std::fs;
use std::io;
use std::path::{Component, Path, PathBuf};
use std::time::UNIX_EPOCH;

use serde::Serialize;

const GRAPH_DIRECTORY: &str = ".brainarium";
const GRAPH_FILE: &str = "graph-v1.json";
const SCHEMA_VERSION: u32 = 1;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VaultGraph {
    pub schema_version: u32,
    pub generated_by: String,
    pub source_fingerprint: String,
    pub nodes: Vec<GraphNode>,
    pub edges: Vec<GraphEdge>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GraphNode {
    pub id: String,
    pub relative_path: String,
    pub title: String,
    pub degree: u32,
    pub mtime_ms: u128,
    pub size: u64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GraphEdge {
    pub source: String,
    pub target: String,
    pub kind: LinkKind,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq, PartialOrd, Ord)]
#[serde(rename_all = "camelCase")]
pub enum LinkKind {
    Markdown,
    Wiki,
}

#[derive(Debug, Clone)]
struct MarkdownDocument {
    relative_path: String,
    title: String,
    mtime_ms: u128,
    size: u64,
    source: String,
}

#[derive(Debug, Clone)]
struct LinkCandidate {
    kind: LinkKind,
    target: String,
}

/// Rebuilds the graph strictly from the selected vault, then atomically writes
/// it to `.brainarium/graph-v1.json` inside that vault.
pub fn index_vault(selected_root: &Path) -> io::Result<VaultGraph> {
    let root = fs::canonicalize(selected_root)?;
    if !root.is_dir() {
        return Err(io::Error::new(
            io::ErrorKind::InvalidInput,
            "A Brainarium vault must be a directory.",
        ));
    }

    let mut documents = Vec::new();
    collect_markdown(&root, &root, &mut documents)?;
    documents.sort_by(|left, right| left.relative_path.cmp(&right.relative_path));

    let graph = build_graph(documents);
    write_graph(&root, &graph)?;
    Ok(graph)
}

fn collect_markdown(
    root: &Path,
    directory: &Path,
    documents: &mut Vec<MarkdownDocument>,
) -> io::Result<()> {
    for entry in fs::read_dir(directory)? {
        let entry = entry?;
        let file_type = entry.file_type()?;
        let name = entry.file_name();
        let name = name.to_string_lossy();

        // Derived metadata and dot-directories are intentionally never source.
        // Symlinks are skipped here; the Electron vault scanner remains the only
        // authority that may include a vault-contained symlink in the tree.
        if file_type.is_symlink() || name.starts_with('.') {
            continue;
        }
        if file_type.is_dir() {
            collect_markdown(root, &entry.path(), documents)?;
            continue;
        }
        if !file_type.is_file() || !is_markdown(&name) {
            continue;
        }

        let bytes = fs::read(entry.path())?;
        let source = match String::from_utf8(bytes) {
            Ok(source) => source,
            Err(_) => continue,
        };
        let metadata = entry.metadata()?;
        let relative_path = normalized_relative(root, &entry.path())?;
        let title = entry
            .path()
            .file_stem()
            .map(|stem| stem.to_string_lossy().into_owned())
            .unwrap_or_else(|| name.into_owned());
        let mtime_ms = metadata
            .modified()
            .ok()
            .and_then(|modified| modified.duration_since(UNIX_EPOCH).ok())
            .map(|duration| duration.as_millis())
            .unwrap_or_default();

        documents.push(MarkdownDocument {
            relative_path,
            title,
            mtime_ms,
            size: metadata.len(),
            source,
        });
    }
    Ok(())
}

fn build_graph(documents: Vec<MarkdownDocument>) -> VaultGraph {
    let mut path_lookup = BTreeMap::new();
    let mut title_lookup: BTreeMap<String, Vec<String>> = BTreeMap::new();
    for document in &documents {
        path_lookup.insert(
            normalize_key(&document.relative_path),
            document.relative_path.clone(),
        );
        path_lookup.insert(
            normalize_key(&remove_markdown_extension(&document.relative_path)),
            document.relative_path.clone(),
        );
        title_lookup
            .entry(normalize_key(&document.title))
            .or_default()
            .push(document.relative_path.clone());
    }

    let mut edge_set = BTreeSet::new();
    for document in &documents {
        for candidate in extract_links(&document.source) {
            let Some(target) = resolve_target(
                &candidate.target,
                &document.relative_path,
                &path_lookup,
                &title_lookup,
            ) else {
                continue;
            };
            if target != document.relative_path {
                edge_set.insert((document.relative_path.clone(), target, candidate.kind));
            }
        }
    }

    let mut degrees: BTreeMap<String, u32> = BTreeMap::new();
    for (source, target, _) in &edge_set {
        *degrees.entry(source.clone()).or_default() += 1;
        *degrees.entry(target.clone()).or_default() += 1;
    }

    let nodes = documents
        .iter()
        .map(|document| GraphNode {
            id: document.relative_path.clone(),
            relative_path: document.relative_path.clone(),
            title: document.title.clone(),
            degree: degrees
                .get(&document.relative_path)
                .copied()
                .unwrap_or_default(),
            mtime_ms: document.mtime_ms,
            size: document.size,
        })
        .collect();
    let edges = edge_set
        .into_iter()
        .map(|(source, target, kind)| GraphEdge {
            source,
            target,
            kind,
        })
        .collect();

    VaultGraph {
        schema_version: SCHEMA_VERSION,
        generated_by: "brainarium-indexer".to_owned(),
        source_fingerprint: fingerprint(&documents),
        nodes,
        edges,
    }
}

fn extract_links(source: &str) -> Vec<LinkCandidate> {
    let mut links = Vec::new();
    let mut fence: Option<char> = None;
    for line in source.lines() {
        let trimmed = line.trim_start();
        if let Some(marker) = fence {
            if trimmed.starts_with(&marker.to_string().repeat(3)) {
                fence = None;
            }
            continue;
        }
        if trimmed.starts_with("```") {
            fence = Some('`');
            continue;
        }
        if trimmed.starts_with("~~~") {
            fence = Some('~');
            continue;
        }
        extract_line_links(line, &mut links);
    }
    links
}

fn extract_line_links(line: &str, links: &mut Vec<LinkCandidate>) {
    let characters: Vec<char> = line.chars().collect();
    let mut index = 0;
    let mut inline_code = false;
    while index < characters.len() {
        if characters[index] == '`' {
            inline_code = !inline_code;
            index += 1;
            continue;
        }
        if inline_code {
            index += 1;
            continue;
        }
        if characters[index..].starts_with(&['[', '['])
            && let Some(end) = find_pair(&characters, index + 2, ']', ']')
        {
            let raw: String = characters[index + 2..end].iter().collect();
            if let Some(target) = clean_link_target(&raw) {
                links.push(LinkCandidate {
                    kind: LinkKind::Wiki,
                    target,
                });
            }
            index = end + 2;
            continue;
        }
        if characters[index] == ']'
            && characters.get(index + 1) == Some(&'(')
            && let Some(end) = characters[index + 2..]
                .iter()
                .position(|character| *character == ')')
        {
            let end = index + 2 + end;
            let raw: String = characters[index + 2..end].iter().collect();
            if let Some(target) = clean_link_target(&raw) {
                links.push(LinkCandidate {
                    kind: LinkKind::Markdown,
                    target,
                });
            }
            index = end + 1;
            continue;
        }
        index += 1;
    }
}

fn find_pair(characters: &[char], from: usize, first: char, second: char) -> Option<usize> {
    (from..characters.len().saturating_sub(1))
        .find(|index| characters[*index] == first && characters[*index + 1] == second)
}

fn clean_link_target(raw: &str) -> Option<String> {
    let target = raw.split('|').next()?.split('#').next()?.trim();
    if target.is_empty()
        || target.starts_with('#')
        || target.contains("://")
        || target.starts_with("mailto:")
        || target.starts_with('/')
    {
        return None;
    }
    Some(target.trim_matches(['<', '>']).replace('\\', "/"))
}

fn resolve_target(
    target: &str,
    source_path: &str,
    path_lookup: &BTreeMap<String, String>,
    title_lookup: &BTreeMap<String, Vec<String>>,
) -> Option<String> {
    let mut candidates = Vec::new();
    let source_parent = Path::new(source_path)
        .parent()
        .unwrap_or_else(|| Path::new(""));
    if !source_parent.as_os_str().is_empty() {
        candidates.push(normalize_relative(source_parent.join(target))?);
    }
    candidates.push(normalize_relative(PathBuf::from(target))?);

    for candidate in candidates {
        for path in markdown_path_variants(&candidate) {
            if let Some(resolved) = path_lookup.get(&normalize_key(&path)) {
                return Some(resolved.clone());
            }
        }
    }

    let by_title = title_lookup.get(&normalize_key(target))?;
    (by_title.len() == 1).then(|| by_title[0].clone())
}

fn markdown_path_variants(path: &str) -> Vec<String> {
    if is_markdown(path) {
        vec![path.to_owned(), remove_markdown_extension(path)]
    } else {
        vec![
            path.to_owned(),
            format!("{path}.md"),
            format!("{path}.markdown"),
        ]
    }
}

fn normalized_relative(root: &Path, path: &Path) -> io::Result<String> {
    let relative = path
        .strip_prefix(root)
        .map_err(|_| io::Error::new(io::ErrorKind::PermissionDenied, "Path escaped the vault."))?;
    normalize_relative(relative.to_path_buf())
        .ok_or_else(|| io::Error::new(io::ErrorKind::PermissionDenied, "Path escaped the vault."))
}

fn normalize_relative(path: PathBuf) -> Option<String> {
    let mut parts = Vec::new();
    for component in path.components() {
        match component {
            Component::Normal(part) => parts.push(part.to_string_lossy().into_owned()),
            Component::CurDir => {}
            Component::ParentDir => {
                parts.pop()?;
            }
            Component::RootDir | Component::Prefix(_) => return None,
        }
    }
    (!parts.is_empty()).then(|| parts.join("/"))
}

fn remove_markdown_extension(path: &str) -> String {
    path.strip_suffix(".markdown")
        .or_else(|| path.strip_suffix(".MARKDOWN"))
        .or_else(|| path.strip_suffix(".md"))
        .or_else(|| path.strip_suffix(".MD"))
        .unwrap_or(path)
        .to_owned()
}

fn is_markdown(name: &str) -> bool {
    let lower = name.to_ascii_lowercase();
    lower.ends_with(".md") || lower.ends_with(".markdown")
}

fn normalize_key(value: &str) -> String {
    value.to_lowercase()
}

fn fingerprint(documents: &[MarkdownDocument]) -> String {
    let mut hash = 0xcbf29ce484222325_u64;
    for document in documents {
        for byte in format!(
            "{}:{}:{}\n",
            document.relative_path, document.mtime_ms, document.size
        )
        .bytes()
        {
            hash ^= u64::from(byte);
            hash = hash.wrapping_mul(0x100000001b3);
        }
    }
    format!("{hash:016x}")
}

fn write_graph(root: &Path, graph: &VaultGraph) -> io::Result<()> {
    let metadata_directory = root.join(GRAPH_DIRECTORY);
    match fs::symlink_metadata(&metadata_directory) {
        Ok(metadata) if metadata.file_type().is_symlink() => {
            return Err(io::Error::new(
                io::ErrorKind::PermissionDenied,
                "Refusing a symlinked .brainarium directory.",
            ));
        }
        Ok(metadata) if !metadata.is_dir() => {
            return Err(io::Error::new(
                io::ErrorKind::AlreadyExists,
                ".brainarium exists but is not a directory.",
            ));
        }
        Ok(_) => {}
        Err(error) if error.kind() == io::ErrorKind::NotFound => {
            fs::create_dir(&metadata_directory)?
        }
        Err(error) => return Err(error),
    }
    let canonical_metadata = fs::canonicalize(&metadata_directory)?;
    if !canonical_metadata.starts_with(root) {
        return Err(io::Error::new(
            io::ErrorKind::PermissionDenied,
            ".brainarium resolved outside the vault.",
        ));
    }

    let output = serde_json::to_vec_pretty(graph).map_err(io::Error::other)?;
    let graph_path = canonical_metadata.join(GRAPH_FILE);
    let temporary_path =
        canonical_metadata.join(format!(".{GRAPH_FILE}.{}.tmp", std::process::id()));
    fs::write(&temporary_path, output)?;
    fs::rename(temporary_path, graph_path)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::{AtomicUsize, Ordering};
    use std::time::{SystemTime, UNIX_EPOCH};

    static TEMPORARY_VAULT_SEQUENCE: AtomicUsize = AtomicUsize::new(0);

    fn temporary_vault() -> PathBuf {
        for _ in 0..128 {
            let unique = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_nanos();
            let sequence = TEMPORARY_VAULT_SEQUENCE.fetch_add(1, Ordering::Relaxed);
            let root = std::env::temp_dir().join(format!(
                "brainarium-indexer-{}-{unique}-{sequence}",
                std::process::id()
            ));

            match fs::create_dir(&root) {
                Ok(()) => return root,
                Err(error) if error.kind() == io::ErrorKind::AlreadyExists => continue,
                Err(error) => panic!("failed to create temporary vault: {error}"),
            }
        }

        panic!("could not allocate a unique temporary vault");
    }

    #[test]
    fn writes_resolved_wiki_and_markdown_edges_without_touching_markdown() {
        let root = temporary_vault();
        fs::create_dir(root.join("nested")).unwrap();
        fs::write(
            root.join("alpha.md"),
            "[[beta#section]] [Gamma](nested/gamma.md) `[[ignored]]`\n```md\n[[also-ignored]]\n```\n",
        )
        .unwrap();
        fs::write(root.join("beta.md"), "# Beta\n").unwrap();
        fs::write(root.join("nested/gamma.md"), "# Gamma\n").unwrap();

        let graph = index_vault(&root).unwrap();

        assert_eq!(graph.nodes.len(), 3);
        assert_eq!(graph.edges.len(), 2);
        assert!(
            graph
                .edges
                .iter()
                .any(|edge| edge.source == "alpha.md" && edge.target == "beta.md")
        );
        assert!(
            graph
                .edges
                .iter()
                .any(|edge| edge.source == "alpha.md" && edge.target == "nested/gamma.md")
        );
        assert!(root.join(".brainarium/graph-v1.json").is_file());
        assert_eq!(
            fs::read_to_string(root.join("alpha.md")).unwrap(),
            "[[beta#section]] [Gamma](nested/gamma.md) `[[ignored]]`\n```md\n[[also-ignored]]\n```\n"
        );

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn refuses_an_ambiguous_title_link() {
        let root = temporary_vault();
        fs::create_dir(root.join("one")).unwrap();
        fs::create_dir(root.join("two")).unwrap();
        fs::write(root.join("alpha.md"), "[[readme]]").unwrap();
        fs::write(root.join("one/readme.md"), "# One").unwrap();
        fs::write(root.join("two/readme.md"), "# Two").unwrap();

        let graph = index_vault(&root).unwrap();

        assert!(graph.edges.is_empty());
        fs::remove_dir_all(root).unwrap();
    }
}
