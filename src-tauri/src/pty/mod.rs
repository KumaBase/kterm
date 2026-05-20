mod manager;
mod session;
mod shell;
pub mod types;
mod windows_terminal;

pub use manager::PtyManager;
pub use session::PtySession;
pub use shell::{detect_default_shell, detect_shells};
pub use types::{PtyOutput, PtySpawnParams};
pub use windows_terminal::{import_windows_terminal_profiles, ImportedProfile};
