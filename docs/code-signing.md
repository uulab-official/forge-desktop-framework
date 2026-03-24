# Code Signing & Notarization Guide

## macOS

### Prerequisites

1. **Apple Developer account** ($99/year) — [developer.apple.com](https://developer.apple.com)
2. **Developer ID Application certificate** — create in Xcode or Apple Developer portal
3. **App-specific password** — generate at [appleid.apple.com](https://appleid.apple.com)

### Environment Variables

Set these in your CI or local shell:

```bash
# Code signing certificate (base64-encoded .p12 file)
export CSC_LINK="base64://..."
# or path to .p12 file
export CSC_LINK="/path/to/certificate.p12"

# Certificate password
export CSC_KEY_PASSWORD="your-certificate-password"

# Notarization
export APPLE_ID="your-apple-id@example.com"
export APPLE_APP_SPECIFIC_PASSWORD="xxxx-xxxx-xxxx-xxxx"
export APPLE_TEAM_ID="YOUR_TEAM_ID"
```

### How to Export Certificate

1. Open **Keychain Access**
2. Find your "Developer ID Application" certificate
3. Right-click → Export → save as `.p12`
4. For CI: `base64 -i certificate.p12 | pbcopy`

### Local Build with Signing

```bash
CSC_LINK=/path/to/cert.p12 CSC_KEY_PASSWORD=password ./scripts/build-app.sh
```

---

## Windows

### Prerequisites

1. **Code signing certificate** — purchase from a CA (DigiCert, Sectigo, etc.)
2. **EV certificate on USB token** (recommended) or standard OV certificate

### Environment Variables

```bash
# Standard OV certificate
export WIN_CSC_LINK="/path/to/certificate.pfx"
export WIN_CSC_KEY_PASSWORD="your-password"

# For EV certificates (hardware token)
export WIN_CSC_LINK="path/to/cert.pfx"
# signtool will prompt for token PIN
```

### Notes

- EV certificates provide immediate SmartScreen reputation
- OV certificates require building reputation (fewer "unknown publisher" warnings over time)
- electron-builder uses `signtool.exe` automatically on Windows

---

## CI/CD Integration (GitHub Actions)

Store secrets in **Repository Settings → Secrets and variables → Actions**:

| Secret | Description |
|--------|-------------|
| `CSC_LINK` | Base64-encoded macOS .p12 certificate |
| `CSC_KEY_PASSWORD` | macOS certificate password |
| `APPLE_ID` | Apple ID email |
| `APPLE_APP_SPECIFIC_PASSWORD` | App-specific password |
| `APPLE_TEAM_ID` | Apple team identifier |
| `WIN_CSC_LINK` | Base64-encoded Windows .pfx certificate |
| `WIN_CSC_KEY_PASSWORD` | Windows certificate password |

These are automatically used by `electron-builder` in the release workflow.

---

## Skipping Code Signing

For development builds without signing:

```bash
CSC_IDENTITY_AUTO_DISCOVERY=false ./scripts/build-app.sh
```

---

## Troubleshooting

### "App is damaged and can't be opened"
- Ensure `hardenedRuntime: true` is set in electron-builder.yml
- Verify notarization completed successfully
- Check: `spctl --assess --verbose /path/to/App.app`

### "Windows protected your PC" (SmartScreen)
- Normal for new OV certificates
- EV certificates bypass this immediately
- Reputation builds over time with more downloads

### Notarization fails
- Ensure `com.apple.security.cs.allow-jit` entitlement is present
- Check Apple's notarization log: `xcrun notarytool log <submission-id>`
