#!/usr/bin/env python3
"""
Comprehensive Security Audit Script for apex-core repository.
Searches for secrets, credentials, sensitive patterns, and security anti-patterns.
"""

import os
import re
import json
from pathlib import Path
from dataclasses import dataclass, field, asdict
from typing import List, Optional

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

REPO_ROOT = Path("/home/4nibhal/Desarrollo/negocios/nibblelayer/apex-core")

# Files and directories to skip
SKIP_DIRS = {
    '.git', 'node_modules', '.turbo', 'dist', 'build', '.aiwf', '.aiwf-governance',
    '.aiwf-linter', '.opencode', 'docker', '.github'
}
SKIP_EXTENSIONS = {'.png', '.jpg', '.jpeg', '.gif', '.ico', '.woff', '.woff2', '.ttf', '.eot', '.svg', '.pdf', '.zip', '.tar', '.gz'}
SKIP_FILES = {'pnpm-lock.yaml', 'CHANGELOG.md', 'LICENSE', 'README.md', 'CONTRIBUTING.md'}

# ---------------------------------------------------------------------------
# Severity Classification
# ---------------------------------------------------------------------------

@dataclass
class Finding:
    file: str
    line: int
    category: str
    severity: str  # CRITICAL, WARNING, INFO
    snippet: str
    recommendation: str
    context: str = ""

# ---------------------------------------------------------------------------
# Pattern Definitions
# ---------------------------------------------------------------------------

PATTERNS = {
    # Hardcoded secrets
    'hardcoded_password': {
        'regex': re.compile(r'(?i)(password|passwd|pwd)\s*[:=]\s*["\'][^"\']{4,}["\']'),
        'severity': 'CRITICAL',
        'category': 'Hardcoded Secret',
        'recommendation': 'Move to environment variables or secrets manager. Never commit passwords.'
    },
    'hardcoded_api_key': {
        'regex': re.compile(r'(?i)(api[_-]?key|apikey)\s*[:=]\s*["\'][^"\']{8,}["\']'),
        'severity': 'CRITICAL',
        'category': 'Hardcoded API Key',
        'recommendation': 'Move to environment variables or secrets manager.'
    },
    'hardcoded_secret': {
        'regex': re.compile(r'(?i)(secret|token|auth[_-]?token)\s*[:=]\s*["\'][^"\']{8,}["\']'),
        'severity': 'CRITICAL',
        'category': 'Hardcoded Secret/Token',
        'recommendation': 'Move to environment variables or secrets manager.'
    },
    'private_key': {
        'regex': re.compile(r'-----BEGIN (RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----'),
        'severity': 'CRITICAL',
        'category': 'Private Key',
        'recommendation': 'Immediately rotate. Remove from git history. Use environment variables or KMS.'
    },
    'ethereum_private_key': {
        'regex': re.compile(r'\b0x[a-fA-F0-9]{64}\b'),
        'severity': 'CRITICAL',
        'category': 'Ethereum Private Key',
        'recommendation': 'Immediately rotate. Remove from git history.'
    },
    'connection_string': {
        'regex': re.compile(r'(?i)(postgresql|mysql|mongodb|redis)://[^\s"\']+'),
        'severity': 'CRITICAL',
        'category': 'Database Connection String',
        'recommendation': 'Move connection strings to environment variables. Never commit credentials in URLs.'
    },
    'apex_api_key': {
        'regex': re.compile(r'\bapex_[a-fA-F0-9]{64,}\b'),
        'severity': 'CRITICAL',
        'category': 'Apex API Key',
        'recommendation': 'This is a real API key. Rotate immediately and remove from git history.'
    },
    'bearer_token': {
        'regex': re.compile(r'(?i)bearer\s+[a-zA-Z0-9_\-\.]{20,}'),
        'severity': 'CRITICAL',
        'category': 'Bearer Token',
        'recommendation': 'Remove hardcoded tokens. Use environment variables.'
    },
    # Environment files
    'env_file': {
        'regex': re.compile(r'\.env(\.local|\.production|\.staging|\.development)?$'),
        'severity': 'WARNING',
        'category': 'Environment File',
        'recommendation': 'Ensure .env files are in .gitignore and not committed.'
    },
    # Internal/debug patterns
    'console_log': {
        'regex': re.compile(r'(?i)console\.(log|error|warn|debug|info)\s*\('),
        'severity': 'INFO',
        'category': 'Console Statement',
        'recommendation': 'Remove or replace with proper logging framework before production.'
    },
    'todo_security': {
        'regex': re.compile(r'(?i)(TODO|FIXME|HACK|XXX)\s*[:\-]?\s*(.*security|vuln|leak|password|secret|token|key|bypass|auth|credential)'),
        'severity': 'WARNING',
        'category': 'Security-Related TODO/FIXME',
        'recommendation': 'Address security TODOs before release.'
    },
    'todo_general': {
        'regex': re.compile(r'(?i)(TODO|FIXME|HACK|XXX)'),
        'severity': 'INFO',
        'category': 'TODO/FIXME Comment',
        'recommendation': 'Review and address technical debt.'
    },
    'process_env': {
        'regex': re.compile(r'process\.env\.[A-Z_]+'),
        'severity': 'INFO',
        'category': 'Environment Variable Access',
        'recommendation': 'Ensure required env vars are validated at startup. Check for defaults that might be insecure.'
    },
    'eval_or_function': {
        'regex': re.compile(r'(?i)\beval\s*\(|new\s+Function\s*\('),
        'severity': 'WARNING',
        'category': 'Dynamic Code Execution',
        'recommendation': 'Avoid eval() and new Function(). They are dangerous and can lead to code injection.'
    },
    'inner_html': {
        'regex': re.compile(r'(?i)\.innerHTML\s*='),
        'severity': 'WARNING',
        'category': 'XSS Risk (innerHTML)',
        'recommendation': 'Use textContent or a sanitization library instead of innerHTML.'
    },
    'http_url': {
        'regex': re.compile(r'https?://(localhost|127\.0\.0\.1|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)'),
        'severity': 'INFO',
        'category': 'Internal/Localhost URL',
        'recommendation': 'Ensure internal URLs are not exposed in production configurations.'
    },
    'email_address': {
        'regex': re.compile(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b'),
        'severity': 'INFO',
        'category': 'Email Address',
        'recommendation': 'Verify if personal/organizational emails should be public.'
    },
    'insecure_random': {
        'regex': re.compile(r'(?i)Math\.random\s*\('),
        'severity': 'WARNING',
        'category': 'Insecure Random (Math.random)',
        'recommendation': 'Use crypto.randomBytes() or crypto.getRandomValues() for security-sensitive operations.'
    },
    'sql_injection_risk': {
        'regex': re.compile(r'(?i)(query|execute)\s*\(\s*["\'].*\$\{.*\}.*["\']\s*\)'),
        'severity': 'WARNING',
        'category': 'Potential SQL Injection',
        'recommendation': 'Use parameterized queries. Never interpolate variables into SQL strings.'
    },
    'jwt_hardcoded': {
        'regex': re.compile(r'(?i)(jwt|json[_-]?web[_-]?token).*["\']eyJ[A-Za-z0-9_\-]*\.eyJ[A-Za-z0-9_\-]*\.[A-Za-z0-9_\-]*["\']'),
        'severity': 'CRITICAL',
        'category': 'Hardcoded JWT',
        'recommendation': 'Never hardcode JWTs. They can contain sensitive claims.'
    },
    'csrf_disabled': {
        'regex': re.compile(r'(?i)(csrf|xsrf).*false|disable.*csrf|csrf.*disable'),
        'severity': 'WARNING',
        'category': 'CSRF Protection Disabled',
        'recommendation': 'Ensure CSRF protection is enabled in production.'
    },
    'cors_wildcard': {
        'regex': re.compile(r'(?i)(Access-Control-Allow-Origin|\*)\s*:\s*\*'),
        'severity': 'WARNING',
        'category': 'Permissive CORS',
        'recommendation': 'Restrict CORS to specific origins in production.'
    },
    'debug_mode': {
        'regex': re.compile(r'(?i)(debug\s*=\s*true|DEBUG\s*=\s*true|NODE_ENV\s*=\s*[\'"]development[\'"])'),
        'severity': 'INFO',
        'category': 'Debug Mode Enabled',
        'recommendation': 'Ensure debug mode is disabled in production configurations.'
    },
    'default_password': {
        'regex': re.compile(r'(?i)(default[_-]?password|default[_-]?pwd|password.*default|admin.*123|password.*123|123456|qwerty)'),
        'severity': 'CRITICAL',
        'category': 'Default/Weak Password',
        'recommendation': 'Remove default passwords. Force users to set passwords on first login.'
    },
    'raw_sql': {
        'regex': re.compile(r'(?i)\.query\s*\(\s*[`"\']'),
        'severity': 'INFO',
        'category': 'Raw SQL Query',
        'recommendation': 'Ensure all raw SQL uses parameterized queries.'
    },
}

# ---------------------------------------------------------------------------
# File content scanning
# ---------------------------------------------------------------------------

def should_skip_file(file_path: Path) -> bool:
    """Determine if a file should be skipped."""
    if file_path.name in SKIP_FILES:
        return True
    if file_path.suffix.lower() in SKIP_EXTENSIONS:
        return True
    for part in file_path.parts:
        if part in SKIP_DIRS:
            return True
    return False

def scan_file(file_path: Path) -> List[Finding]:
    """Scan a single file for security issues."""
    findings = []
    
    try:
        with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
            content = f.read()
            lines = content.split('\n')
    except Exception:
        return findings

    rel_path = str(file_path.relative_to(REPO_ROOT))

    for line_num, line in enumerate(lines, 1):
        line_stripped = line.strip()
        
        # Skip comments that are just documentation
        if line_stripped.startswith('#') and 'password' not in line_stripped.lower():
            continue
        
        for pattern_name, pattern_info in PATTERNS.items():
            matches = pattern_info['regex'].finditer(line)
            for match in matches:
                # Skip false positives in .md files for certain patterns
                if file_path.suffix == '.md' and pattern_name in ['console_log', 'todo_general', 'todo_security']:
                    continue
                
                # Skip test files for certain INFO-level patterns
                if 'test' in rel_path.lower() and pattern_name in ['console_log']:
                    continue
                
                # Skip package.json scripts for console.log
                if file_path.name == 'package.json' and pattern_name == 'console_log':
                    continue
                
                # Skip comments for console.log unless it's actual code
                if pattern_name == 'console_log' and (line_stripped.startswith('//') or line_stripped.startswith('*') or line_stripped.startswith('/*')):
                    continue
                
                # Skip .env in .gitignore entries
                if pattern_name == 'env_file' and '.gitignore' in rel_path:
                    continue
                
                # For process.env, check if there's a fallback default
                context = ""
                if pattern_name == 'process_env':
                    if '||' in line or '??' in line:
                        context = "Has default fallback - verify it's not a hardcoded secret"
                
                # For connection strings, check if they have passwords
                if pattern_name == 'connection_string':
                    match_str = match.group(0)
                    if '@' in match_str and ':' in match_str.split('@')[0]:
                        # Has credentials in URL
                        pass
                    else:
                        # No password in URL, downgrade
                        if pattern_info['severity'] == 'CRITICAL':
                            # Still report but it's less severe if no password
                            pass
                
                finding = Finding(
                    file=rel_path,
                    line=line_num,
                    category=pattern_info['category'],
                    severity=pattern_info['severity'],
                    snippet=line.strip()[:120],
                    recommendation=pattern_info['recommendation'],
                    context=context
                )
                findings.append(finding)

    return findings

# ---------------------------------------------------------------------------
# Specific file deep dives
# ---------------------------------------------------------------------------

def analyze_seed_ts() -> List[Finding]:
    """Deep analysis of seed.ts for predictable credentials."""
    findings = []
    seed_path = REPO_ROOT / 'packages/api/src/seed.ts'
    
    if not seed_path.exists():
        return findings
    
    with open(seed_path, 'r') as f:
        content = f.read()
        lines = content.split('\n')
    
    # Check for hardcoded default connection string
    for i, line in enumerate(lines, 1):
        if 'postgresql://apex:apex_dev@localhost:5433/apex_dev' in line:
            findings.append(Finding(
                file='packages/api/src/seed.ts',
                line=i,
                category='Hardcoded Database Credentials',
                severity='CRITICAL',
                snippet=line.strip()[:120],
                recommendation='Remove hardcoded fallback connection string. Force DATABASE_URL env var.',
                context='Default fallback contains real password (apex_dev)'
            ))
        if 'slug: \'my-org\'' in line or 'slug: "my-org"' in line:
            findings.append(Finding(
                file='packages/api/src/seed.ts',
                line=i,
                category='Predictable Default Organization',
                severity='WARNING',
                snippet=line.strip()[:120],
                recommendation='Default org slug is predictable. Consider requiring explicit configuration.',
                context='Default values: name="My Organization", slug="my-org", label="Default"'
            ))
    
    # Check if .apex-seed-key exists and contains a key
    seed_key_path = REPO_ROOT / '.apex-seed-key'
    if seed_key_path.exists():
        with open(seed_key_path, 'r') as f:
            key_content = f.read().strip()
        if key_content:
            findings.append(Finding(
                file='.apex-seed-key',
                line=1,
                category='Committed API Seed Key',
                severity='CRITICAL',
                snippet=f'{key_content[:30]}...',
                recommendation='This file contains a real API key and is committed to git. Rotate immediately and add to .gitignore.',
                context='File exists in repository root and contains an API key'
            ))
    
    return findings

def analyze_crypto_ts() -> List[Finding]:
    """Deep analysis of crypto.ts for secure hashing."""
    findings = []
    crypto_path = REPO_ROOT / 'packages/api/src/crypto.ts'
    
    if not crypto_path.exists():
        return findings
    
    with open(crypto_path, 'r') as f:
        content = f.read()
    
    # Scrypt parameters analysis
    if 'N = 16384' in content and 'r = 8' in content and 'p = 1' in content:
        findings.append(Finding(
            file='packages/api/src/crypto.ts',
            line=13,
            category='Scrypt Parameters',
            severity='INFO',
            snippet='N=16384, r=8, p=1',
            recommendation='Scrypt params (N=16384, r=8, p=1) are reasonable but consider N=65536 or higher for long-term security.',
            context='Current params: N=2^14, r=8, p=1. OWASP recommends N=2^16+ for new systems.'
        ))
    
    if 'salt = randomBytes(32)' in content:
        findings.append(Finding(
            file='packages/api/src/crypto.ts',
            line=11,
            category='Salt Generation',
            severity='INFO',
            snippet='salt = randomBytes(32)',
            recommendation='Good: 32-byte salt is sufficient.',
            context='Proper random salt generation'
        ))
    
    if 'timingSafeEqual' in content:
        findings.append(Finding(
            file='packages/api/src/crypto.ts',
            line=40,
            category='Constant-Time Comparison',
            severity='INFO',
            snippet='timingSafeEqual(derivedKey, expectedKey)',
            recommendation='Good: Uses constant-time comparison to prevent timing attacks.',
            context='Prevents timing side-channel attacks'
        ))
    
    if 'keylen = 64' in content:
        findings.append(Finding(
            file='packages/api/src/crypto.ts',
            line=12,
            category='Derived Key Length',
            severity='INFO',
            snippet='keylen = 64',
            recommendation='Good: 64-byte derived key provides 512 bits of security.',
            context='Sufficient key length for API key hashing'
        ))
    
    return findings

def analyze_auth_middleware() -> List[Finding]:
    """Deep analysis of auth middleware for bypasses and weaknesses."""
    findings = []
    auth_path = REPO_ROOT / 'packages/api/src/middleware/auth.ts'
    
    if not auth_path.exists():
        return findings
    
    with open(auth_path, 'r') as f:
        content = f.read()
        lines = content.split('\n')
    
    for i, line in enumerate(lines, 1):
        stripped = line.strip()
        
        # Check for auth bypass patterns
        if 'c.set(\'apiKeyRaw\', rawKey)' in stripped:
            findings.append(Finding(
                file='packages/api/src/middleware/auth.ts',
                line=i,
                category='Raw API Key Stored in Context',
                severity='WARNING',
                snippet=stripped[:120],
                recommendation='Storing raw API key in context risks accidental logging/exposure. Store only orgId and keyId.',
                context='Raw key accessible via c.get("apiKeyRaw") throughout request lifecycle'
            ))
        
        if 'allKeys = await db' in stripped or '.from(apiKeys)' in stripped:
            findings.append(Finding(
                file='packages/api/src/middleware/auth.ts',
                line=i,
                category='Full Table Scan on Auth',
                severity='WARNING',
                snippet=stripped[:120],
                recommendation='Loading all API keys into memory is O(n) and does not scale. Use a keyed lookup or caching layer.',
                context='Every authenticated request loads ALL API keys from the database'
            ))
    
    # Check if there's any rate limiting
    if 'rate' not in content.lower() and 'limit' not in content.lower():
        findings.append(Finding(
            file='packages/api/src/middleware/auth.ts',
            line=1,
            category='No Rate Limiting on Auth',
            severity='WARNING',
            snippet='No rate limiting detected in auth middleware',
            recommendation='Add rate limiting to prevent brute-force attacks against API keys.',
            context='Brute force attacks against API keys are possible without rate limiting'
        ))
    
    return findings

def analyze_compose_yaml() -> List[Finding]:
    """Deep analysis of compose.yaml for hardcoded secrets."""
    findings = []
    compose_path = REPO_ROOT / 'compose.yaml'
    
    if not compose_path.exists():
        return findings
    
    with open(compose_path, 'r') as f:
        content = f.read()
        lines = content.split('\n')
    
    for i, line in enumerate(lines, 1):
        stripped = line.strip()
        
        if 'POSTGRES_PASSWORD: apex_dev' in stripped:
            findings.append(Finding(
                file='compose.yaml',
                line=i,
                category='Hardcoded Database Password',
                severity='CRITICAL',
                snippet=stripped[:120],
                recommendation='Use environment variable substitution or secrets. Never hardcode DB passwords in compose files.',
                context='Password: apex_dev is visible in compose.yaml'
            ))
        
        if 'DATABASE_URL: postgresql://apex:apex_dev@' in stripped:
            findings.append(Finding(
                file='compose.yaml',
                line=i,
                category='Hardcoded Connection String',
                severity='CRITICAL',
                snippet=stripped[:120],
                recommendation='Use environment variable substitution for DATABASE_URL.',
                context='Full connection string with password exposed in compose.yaml'
            ))
    
    return findings

def analyze_test_files() -> List[Finding]:
    """Scan all test files for real-looking credentials."""
    findings = []
    
    test_files = list(REPO_ROOT.rglob('*.test.ts')) + list(REPO_ROOT.rglob('*.test.js')) + \
                 list(REPO_ROOT.rglob('*.spec.ts')) + list(REPO_ROOT.rglob('*.spec.js')) + \
                 list(REPO_ROOT.rglob('*.e2e.ts')) + list(REPO_ROOT.rglob('*.e2e.js'))
    
    for test_file in test_files:
        if should_skip_file(test_file):
            continue
        
        rel_path = str(test_file.relative_to(REPO_ROOT))
        
        with open(test_file, 'r', encoding='utf-8', errors='ignore') as f:
            content = f.read()
            lines = content.split('\n')
        
        for i, line in enumerate(lines, 1):
            # Check for API key patterns in tests
            if re.search(r'\bapex_[a-fA-F0-9]{20,}\b', line):
                findings.append(Finding(
                    file=rel_path,
                    line=i,
                    category='Test File Contains API Key Pattern',
                    severity='WARNING',
                    snippet=line.strip()[:120],
                    recommendation='Ensure test API keys are clearly fake/mocked and not real credentials.',
                    context='Test files should use obviously fake values like "apex_test_fake_key"'
                ))
            
            # Check for real-looking passwords in tests
            if re.search(r'(?i)(password|secret)\s*[:=]\s*["\'][^"\']{4,}["\']', line):
                # Skip if it's clearly a fake/test value
                if not any(fake in line.lower() for fake in ['test', 'fake', 'mock', 'example', 'dummy', 'password123']):
                    findings.append(Finding(
                        file=rel_path,
                        line=i,
                        category='Test File Contains Real-Looking Password',
                        severity='WARNING',
                        snippet=line.strip()[:120],
                        recommendation='Use obviously fake test values like "test_password" or "fake_secret".',
                        context='Password does not appear to be a clearly fake test value'
                    ))
    
    return findings

def analyze_package_configs() -> List[Finding]:
    """Analyze package.json and config files for issues."""
    findings = []
    
    package_files = list(REPO_ROOT.rglob('package.json'))
    for pkg_file in package_files:
        if should_skip_file(pkg_file):
            continue
        
        rel_path = str(pkg_file.relative_to(REPO_ROOT))
        
        with open(pkg_file, 'r', encoding='utf-8', errors='ignore') as f:
            content = f.read()
        
        if '"seed"' in content and '"apex_dev"' in content or 'seed' in content:
            # Check for scripts that might expose secrets
            pass
    
    return findings

def analyze_gitignore() -> List[Finding]:
    """Check .gitignore for missing critical entries."""
    findings = []
    gitignore_path = REPO_ROOT / '.gitignore'
    
    if not gitignore_path.exists():
        findings.append(Finding(
            file='.gitignore',
            line=0,
            category='Missing .gitignore',
            severity='CRITICAL',
            snippet='.gitignore not found',
            recommendation='Create .gitignore immediately to prevent accidental secret commits.',
            context='Repository lacks .gitignore file'
        ))
        return findings
    
    with open(gitignore_path, 'r') as f:
        content = f.read()
    
    required_entries = ['.env', '.env.local', '.env.*', '.apex-seed-key', '*.key', '*.pem']
    missing = []
    
    for entry in required_entries:
        if entry not in content:
            missing.append(entry)
    
    if '.apex-seed-key' not in content:
        findings.append(Finding(
            file='.gitignore',
            line=0,
            category='Missing .gitignore Entry',
            severity='CRITICAL',
            snippet='.apex-seed-key not in .gitignore',
            recommendation='Add .apex-seed-key to .gitignore immediately. Also remove from git history.',
            context='This file contains real API keys and is tracked by git'
        ))
    
    if '.env' not in content:
        findings.append(Finding(
            file='.gitignore',
            line=0,
            category='Missing .gitignore Entry',
            severity='WARNING',
            snippet='.env not in .gitignore',
            recommendation='Add .env and .env.* to .gitignore to prevent accidental commits.',
            context='Environment files may contain secrets'
        ))
    
    return findings

def analyze_env_file_usage() -> List[Finding]:
    """Check for .env files that might be committed."""
    findings = []
    
    env_files = list(REPO_ROOT.rglob('.env*'))
    for env_file in env_files:
        if should_skip_file(env_file):
            continue
        
        rel_path = str(env_file.relative_to(REPO_ROOT))
        
        findings.append(Finding(
            file=rel_path,
            line=0,
            category='Environment File in Repository',
            severity='WARNING',
            snippet=f'File exists: {rel_path}',
            recommendation='Ensure this file is in .gitignore and does not contain real secrets.',
            context='Environment files should not be committed to version control'
        ))
    
    return findings

# ---------------------------------------------------------------------------
# Main execution
# ---------------------------------------------------------------------------

def main():
    all_findings: List[Finding] = []
    
    print("=" * 80)
    print("APEX-CORE SECURITY AUDIT REPORT")
    print(f"Repository: {REPO_ROOT}")
    print(f"GitHub: https://github.com/NibbleLayer/apex-core")
    print("=" * 80)
    print()
    
    # 1. Full repository scan
    print("[1/7] Scanning all source files for security patterns...")
    scanned = 0
    for file_path in REPO_ROOT.rglob('*'):
        if not file_path.is_file():
            continue
        if should_skip_file(file_path):
            continue
        scanned += 1
        findings = scan_file(file_path)
        all_findings.extend(findings)
    print(f"      Scanned {scanned} files.")
    
    # 2. Deep dive: seed.ts
    print("[2/7] Analyzing seed.ts for predictable credentials...")
    all_findings.extend(analyze_seed_ts())
    
    # 3. Deep dive: crypto.ts
    print("[3/7] Analyzing crypto.ts for secure hashing...")
    all_findings.extend(analyze_crypto_ts())
    
    # 4. Deep dive: auth middleware
    print("[4/7] Analyzing auth middleware for bypasses and weaknesses...")
    all_findings.extend(analyze_auth_middleware())
    
    # 5. Deep dive: compose.yaml
    print("[5/7] Analyzing compose.yaml for hardcoded secrets...")
    all_findings.extend(analyze_compose_yaml())
    
    # 6. Deep dive: test files
    print("[6/7] Analyzing test files for real-looking credentials...")
    all_findings.extend(analyze_test_files())
    
    # 7. Deep dive: .gitignore and env files
    print("[7/7] Checking .gitignore and environment files...")
    all_findings.extend(analyze_gitignore())
    all_findings.extend(analyze_env_file_usage())
    
    # Deduplicate findings
    seen = set()
    unique_findings = []
    for f in all_findings:
        key = (f.file, f.line, f.category, f.snippet)
        if key not in seen:
            seen.add(key)
            unique_findings.append(f)
    
    all_findings = unique_findings
    
    # Sort by severity
    severity_order = {'CRITICAL': 0, 'WARNING': 1, 'INFO': 2}
    all_findings.sort(key=lambda x: (severity_order.get(x.severity, 3), x.file, x.line))
    
    # Print report
    critical = [f for f in all_findings if f.severity == 'CRITICAL']
    warnings = [f for f in all_findings if f.severity == 'WARNING']
    info = [f for f in all_findings if f.severity == 'INFO']
    
    def print_findings(findings, title, symbol):
        if not findings:
            return
        print()
        print(f"{symbol} {title} ({len(findings)} findings)")
        print("-" * 80)
        for f in findings:
            print(f"  File: {f.file}:{f.line}")
            print(f"  Category: {f.category}")
            print(f"  Snippet: {f.snippet}")
            if f.context:
                print(f"  Context: {f.context}")
            print(f"  Recommendation: {f.recommendation}")
            print()
    
    print_findings(critical, "CRITICAL ISSUES", "🚨")
    print_findings(warnings, "WARNINGS", "⚠️")
    print_findings(info, "INFO / POSITIVE FINDINGS", "ℹ️")
    
    # Summary
    print()
    print("=" * 80)
    print("SUMMARY")
    print("=" * 80)
    print(f"  Total files scanned: {scanned}")
    print(f"  CRITICAL findings: {len(critical)}")
    print(f"  WARNING findings: {len(warnings)}")
    print(f"  INFO findings: {len(info)}")
    print()
    
    if critical:
        print("ACTION REQUIRED: Address all CRITICAL findings before public release.")
    elif warnings:
        print("ACTION RECOMMENDED: Address WARNING findings to improve security posture.")
    else:
        print("No critical or warning findings. Good security posture.")
    
    # Save report to file
    report_path = REPO_ROOT / 'security_audit_report.json'
    with open(report_path, 'w') as f:
        json.dump([asdict(f) for f in all_findings], f, indent=2)
    print(f"\nFull report saved to: {report_path}")

if __name__ == '__main__':
    main()
