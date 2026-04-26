# Platform & Template Mappings

## 1. Platform Destinations
| Platform | Runtime Skills Directory | Canonical Scaffold Output |
| :--- | :--- | :--- |
| OpenCode | `.opencode/skills/` | `.opencode/agents/`, `.opencode/commands/`, `.opencode/plugins/`, `.opencode/tools/`, `.opencode/package.json`, `.opencode/opencode.json`, `.opencode/manifest.json` |

## 2. Default Template Variables
| Variable | Value |
| :--- | :--- |
| {{DESCRIPTION}} | General purpose agent for this scope. |
| {{VERIFICATION_PROCESS}} | Identify and run the local test suite. |
| {{DEPLOYMENT_FLOW}} | Follow the CI/CD pipeline defined in the project root. |
| {{CORE_SKILL}} | skill-creator |
| {{HELPER_SKILL}} | rules-creator |
| {{RUNTIME_ENV}} | Auto-detected by agent. |
| {{ARCH_PATTERNS}} | Consistent with project standards. |
| {{FOCUS_LIMITS}} | Confined to files within the current directory tree. |

## 3. Nested Scope Markers
The agent should look for these files to identify a "Nested Scope":
- `package.json`
- `Cargo.toml`
- `requirements.txt`
- `go.mod`
- `README.md` (if not in root)
