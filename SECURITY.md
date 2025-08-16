# Security Policy

## Supported Versions

We actively support the following versions of Shell AI with security updates:

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |
| < 1.0   | :x:                |

## Reporting a Vulnerability

We take the security of Shell AI seriously. If you discover a security vulnerability, please follow these steps:

### Do NOT:
- Open a public GitHub issue
- Discuss the vulnerability in public forums
- Share details on social media

### DO:
1. **Email us privately** at security@shell-ai.dev (or create a private security advisory on GitHub)
2. **Include detailed information**:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

### Response Timeline:
- **Initial Response**: Within 48 hours
- **Assessment**: Within 7 days
- **Fix Timeline**: Varies based on severity (critical issues within 72 hours)

## Security Considerations

### Local Execution
Shell AI runs entirely locally using Ollama, which provides several security benefits:
- No data sent to external services
- Full control over AI model execution
- Private conversation history

### Shell Command Execution
- All shell commands require explicit user confirmation
- Commands are displayed before execution
- User can review and approve/deny each command

### File System Access
- Tools operate within the current working directory by default
- File operations are logged and can be reviewed
- No automatic file modifications without user intent

### Configuration
- Configuration files are stored locally
- No sensitive credentials required for basic operation
- Ollama connection uses localhost by default

## Best Practices for Users

1. **Keep Ollama Updated**: Ensure you're running the latest version of Ollama
2. **Review Commands**: Always review shell commands before confirming execution
3. **Secure Environment**: Run Shell AI in a secure, isolated environment for sensitive work
4. **Regular Updates**: Keep Shell AI updated to the latest version

## Vulnerability Disclosure

When we receive and verify a security vulnerability:

1. We'll work on a fix privately
2. We'll prepare a security advisory
3. We'll release the fix and advisory simultaneously
4. We'll credit the reporter (unless they prefer to remain anonymous)

## Security Features

- **Sandboxed Execution**: Shell commands run with user permissions only
- **Local Processing**: All AI inference happens locally via Ollama
- **No External Dependencies**: Core functionality doesn't require internet access
- **Audit Trail**: All tool executions are logged for review

Thank you for helping keep Shell AI secure!
