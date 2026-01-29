# SEC EDGAR Fraud Analyzer - Web Client

**Version:** 2.2.0  
**Author:** Bennie Shearer (Retired)  
**License:** MIT

---

## Disclaimer

**This project is NOT funded, endorsed, or approved by the U.S. Securities and Exchange Commission (SEC).**

For educational and research purposes only.

---

## Overview

Browser-based web client for the SEC EDGAR Fraud Analyzer. Pure HTML/CSS/JavaScript - no build tools required.

---

## Features

- Responsive design
- Dark mode support
- Interactive results display
- Export functionality (JSON, CSV, HTML)
- Keyboard shortcuts
- Batch analysis
- CIK lookup for delisted companies

---

## Quick Start

1. Start the server (see server package)
2. Open `index.html` in a web browser
3. Enter a stock ticker (e.g., AAPL, MSFT, BRK.A)
4. Click "Analyze"

---

## Files

| File | Description |
|------|-------------|
| index.html | Main application page |
| app.js | Application logic |
| style.css | Styling and themes |
| config.json | Configuration |

---

## Configuration

Edit `config.json`:

```json
{
    "apiUrl": "http://localhost:8080",
    "timeout": 30,
    "logLevel": "info",
    "darkMode": false,
    "demoMode": false
}
```

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| Ctrl+S | Export JSON |
| Ctrl+P | Print report |
| Ctrl+D | Toggle dark mode |
| Ctrl+M | Toggle demo mode |

---

## Browser Support

- Chrome 90+
- Firefox 88+
- Edge 90+
- Safari 14+

---

## Documentation

See `docs/` directory for:
- BACKGROUND.md - Project history and design
- API.md - REST API reference
- USER_GUIDE.md - Usage instructions
- MODELS.md - Fraud detection model details
- EXAMPLES.md - Usage examples and sample outputs
- FAQ.md - Frequently asked questions
- GLOSSARY.md - Financial and technical terms
- TROUBLESHOOTING.md - Common issues and solutions
- CONTRIBUTING.md - Contribution guidelines
- SECURITY.md - Security policy
- CHANGELOG.md - Version history

---

## Limitations

1. **Data Availability**: Analysis depends on SEC EDGAR data availability
2. **XBRL Coverage**: Not all filings have complete XBRL data
3. **Industry Variations**: Model thresholds may vary by industry
4. **Historical Data**: Older filings may lack standardized data

---

## Acknowledgments

- **Walter Hamscher** - Mentor and XBRL expert
- **SEC EDGAR** - Financial data source
- **Academic researchers** - Beneish, Altman, Piotroski, Cressey, Benford
- **CLion** by JetBrains s.r.o.
- **Claude** by Anthropic PBC

---

**Version:** 2.2.0 | **Date:** January 2026
