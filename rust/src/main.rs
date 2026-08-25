use std::path::PathBuf;
use std::process::ExitCode;

fn main() -> ExitCode {
    let mut arguments = std::env::args_os().skip(1);
    let flag = arguments.next();
    let vault = arguments.next();
    if flag.as_deref() != Some(std::ffi::OsStr::new("--vault"))
        || vault.is_none()
        || arguments.next().is_some()
    {
        eprintln!("Usage: brainarium-indexer --vault <path>");
        return ExitCode::from(64);
    }

    match brainarium_indexer::index_vault(&PathBuf::from(vault.expect("checked above"))) {
        Ok(graph) => match serde_json::to_string(&graph) {
            Ok(output) => {
                println!("{output}");
                ExitCode::SUCCESS
            }
            Err(error) => {
                eprintln!("Brainarium could not serialize the vault graph: {error}");
                ExitCode::FAILURE
            }
        },
        Err(error) => {
            eprintln!("Brainarium could not index this vault: {error}");
            ExitCode::FAILURE
        }
    }
}
