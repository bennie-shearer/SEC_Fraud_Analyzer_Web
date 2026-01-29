/**
 * SEC EDGAR Fraud Analyzer - Web Client Application
 * Version: 2.2.0
 * Author: Bennie Shearer (Retired)
 * 
 * DISCLAIMER: This project is NOT funded, endorsed, or approved by the
 * U.S. Securities and Exchange Commission (SEC).
 * 
 * Features:
 * - Config.json support for persistent settings
 * - CIK lookup for delisted companies
 * - Improved connection settings UX
 * - Demo mode for testing without server
 */

'use strict';

// Application State
const APP_VERSION = '2.2.0';
let apiBaseUrl = '';
let currentData = null;
let isConnected = false;
let isDemoMode = false;
let isDarkMode = false;
let requestTimeout = 30;
let analysisHistory = [];

// =============================================================================
// Logger - Adjustable logging levels for debugging
// =============================================================================
const LogLevel = {
    DEBUG: 0,
    INFO: 1,
    WARNING: 2,
    ERROR: 3,
    CRITICAL: 4,
    NONE: 5
};

const Logger = {
    level: LogLevel.INFO,
    showTimestamp: true,
    showLevel: true,
    logHistory: [],
    maxHistory: 1000,
    
    // Set log level from string
    setLevel(levelStr) {
        const levels = {
            'debug': LogLevel.DEBUG,
            'info': LogLevel.INFO,
            'warning': LogLevel.WARNING,
            'warn': LogLevel.WARNING,
            'error': LogLevel.ERROR,
            'critical': LogLevel.CRITICAL,
            'none': LogLevel.NONE
        };
        const lower = (levelStr || 'info').toLowerCase();
        this.level = levels[lower] !== undefined ? levels[lower] : LogLevel.INFO;
        this.info(`Log level set to: ${levelStr}`);
    },
    
    // Get current level as string
    getLevelString() {
        const names = ['DEBUG', 'INFO', 'WARNING', 'ERROR', 'CRITICAL', 'NONE'];
        return names[this.level] || 'UNKNOWN';
    },
    
    // Format log message
    formatMessage(level, ...args) {
        const parts = [];
        
        if (this.showTimestamp) {
            const now = new Date();
            const ts = now.toISOString().replace('T', ' ').substr(0, 23);
            parts.push(`[${ts}]`);
        }
        
        if (this.showLevel) {
            const levelNames = ['DEBUG', 'INFO ', 'WARN ', 'ERROR', 'CRIT '];
            parts.push(`[${levelNames[level]}]`);
        }
        
        return parts.length > 0 ? parts.join(' ') + ' ' : '';
    },
    
    // Store in history
    addToHistory(level, message) {
        const entry = {
            timestamp: new Date().toISOString(),
            level: level,
            message: message
        };
        this.logHistory.push(entry);
        if (this.logHistory.length > this.maxHistory) {
            this.logHistory.shift();
        }
    },
    
    // Log methods
    debug(...args) {
        if (this.level <= LogLevel.DEBUG) {
            const prefix = this.formatMessage(LogLevel.DEBUG);
            console.debug(prefix, ...args);
            this.addToHistory('DEBUG', args.join(' '));
        }
    },
    
    info(...args) {
        if (this.level <= LogLevel.INFO) {
            const prefix = this.formatMessage(LogLevel.INFO);
            console.info(prefix, ...args);
            this.addToHistory('INFO', args.join(' '));
        }
    },
    
    warning(...args) {
        if (this.level <= LogLevel.WARNING) {
            const prefix = this.formatMessage(LogLevel.WARNING);
            console.warn(prefix, ...args);
            this.addToHistory('WARNING', args.join(' '));
        }
    },
    warn(...args) {
        this.warning(...args);
    },
    
    error(...args) {
        if (this.level <= LogLevel.ERROR) {
            const prefix = this.formatMessage(LogLevel.ERROR);
            console.error(prefix, ...args);
            this.addToHistory('ERROR', args.join(' '));
        }
    },
    
    critical(...args) {
        if (this.level <= LogLevel.CRITICAL) {
            const prefix = this.formatMessage(LogLevel.CRITICAL);
            console.error(prefix, '***', ...args, '***');
            this.addToHistory('CRITICAL', args.join(' '));
        }
    },
    
    // Get log history (for debug panel)
    getHistory(maxEntries = 100) {
        return this.logHistory.slice(-maxEntries);
    },
    
    // Clear history
    clearHistory() {
        this.logHistory = [];
    },
    
    // Export history as text
    exportHistory() {
        return this.logHistory.map(e => 
            `${e.timestamp} [${e.level}] ${e.message}`
        ).join('\n');
    }
};

// Make Logger available globally for debugging in console
window.Logger = Logger;
window.LogLevel = LogLevel;

// Initialize Application
document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
});

async function initializeApp() {
    // Load settings from config.json first, then localStorage overrides
    await loadConfigFile();
    loadSettings();
    setupEventListeners();
    setupKeyboardShortcuts();
    checkServerConnection();
    loadHistory();
    
    // Auto-strip /api/ from URL if present in localStorage
    const storedUrl = localStorage.getItem('apiUrl');
    if (storedUrl) {
        apiBaseUrl = normalizeApiUrl(storedUrl);
        localStorage.setItem('apiUrl', apiBaseUrl);
    }
}

// Normalize API URL - remove trailing /api/health, /api/, or trailing slashes
function normalizeApiUrl(url) {
    if (!url) return '';
    url = url.trim();
    
    // Remove common endpoint paths that users might accidentally include
    const suffixesToRemove = [
        '/api/health',
        '/api/analyze',
        '/api/filings',
        '/api/',
        '/api'
    ];
    
    for (const suffix of suffixesToRemove) {
        if (url.endsWith(suffix)) {
            url = url.slice(0, -suffix.length);
        }
    }
    
    // Remove trailing slash
    while (url.endsWith('/')) {
        url = url.slice(0, -1);
    }
    
    return url;
}

// Config.json Support
async function loadConfigFile() {
    try {
        const response = await fetch('config.json');
        if (response.ok) {
            const config = await response.json();
            applyConfig(config);
            Logger.info('Loaded config.json');
        }
    } catch (e) {
        // config.json not found or invalid - use defaults
        Logger.debug('No config.json found, using defaults');
    }
}

function applyConfig(config) {
    if (config.apiUrl) {
        apiBaseUrl = normalizeApiUrl(config.apiUrl);
    }
    if (config.timeout) {
        requestTimeout = config.timeout;
    }
    if (config.logLevel) {
        Logger.setLevel(config.logLevel);
    }
    if (config.darkMode !== undefined) {
        isDarkMode = config.darkMode;
        if (isDarkMode) {
            document.body.classList.add('dark-mode');
        }
    }
    if (config.demoMode !== undefined) {
        isDemoMode = config.demoMode;
        updateDemoModeUI();
    }
}

function saveConfigFile() {
    const config = {
        apiUrl: apiBaseUrl,
        timeout: requestTimeout,
        darkMode: isDarkMode,
        demoMode: isDemoMode
    };
    
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'config.json';
    a.click();
    URL.revokeObjectURL(url);
    
    showAlert('Configuration saved to config.json', 'success');
}

// Settings Management
function loadSettings() {
    const storedUrl = localStorage.getItem('apiUrl');
    if (storedUrl && !apiBaseUrl) {
        apiBaseUrl = normalizeApiUrl(storedUrl);
    }
    
    const storedTimeout = localStorage.getItem('requestTimeout');
    if (storedTimeout) {
        requestTimeout = parseInt(storedTimeout, 10);
    }
    
    const storedDarkMode = localStorage.getItem('darkMode');
    if (storedDarkMode === 'true') {
        isDarkMode = true;
        document.body.classList.add('dark-mode');
    }
    
    const storedDemoMode = localStorage.getItem('demoMode');
    if (storedDemoMode === 'true') {
        isDemoMode = true;
        updateDemoModeUI();
    }
}

function saveSettings() {
    localStorage.setItem('apiUrl', apiBaseUrl);
    localStorage.setItem('requestTimeout', requestTimeout.toString());
    localStorage.setItem('darkMode', isDarkMode.toString());
    localStorage.setItem('demoMode', isDemoMode.toString());
}

// Event Listeners
function setupEventListeners() {
    // Ticker input - Enter key
    document.getElementById('ticker').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') analyzeCompany();
    });
    
    // CIK input - Enter key
    document.getElementById('cik').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') analyzeCompany();
    });
    
    // Tab navigation
    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', () => switchTab(tab.dataset.tab));
    });
    
    // Close modals on backdrop click
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeModal(modal.id);
            }
        });
    });
    
    // Menu handling
    document.querySelectorAll('.menu-item').forEach(item => {
        item.addEventListener('mouseenter', () => {
            document.querySelectorAll('.menu-item').forEach(m => m.classList.remove('active'));
            item.classList.add('active');
        });
    });
    
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.menu-item')) {
            document.querySelectorAll('.menu-item').forEach(m => m.classList.remove('active'));
        }
    });
}

// Keyboard Shortcuts
function setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
        // Check for Ctrl/Cmd key combinations
        if (e.ctrlKey || e.metaKey) {
            switch (e.key.toLowerCase()) {
                case 's':
                    e.preventDefault();
                    exportResults('json');
                    break;
                case 'e':
                    e.preventDefault();
                    exportResults('csv');
                    break;
                case 'h':
                    e.preventDefault();
                    exportResults('html');
                    break;
                case 'p':
                    e.preventDefault();
                    printReport();
                    break;
                case 'd':
                    e.preventDefault();
                    toggleDarkMode();
                    break;
                case 'm':
                    e.preventDefault();
                    toggleDemoMode();
                    break;
            }
        }
        
        // F1 for help
        if (e.key === 'F1') {
            e.preventDefault();
            showHelp();
        }
        
        // Escape to close modals
        if (e.key === 'Escape') {
            document.querySelectorAll('.modal.active').forEach(m => {
                closeModal(m.id);
            });
        }
    });
}

// Connection Management
async function checkServerConnection() {
    Logger.debug('Checking server connection...');
    
    if (isDemoMode) {
        Logger.info('Demo mode active - skipping server connection');
        updateConnectionStatus(true, APP_VERSION + ' (Demo)');
        return;
    }
    
    if (!apiBaseUrl) {
        Logger.warning('No API URL configured');
        updateConnectionStatus(false);
        return;
    }
    
    try {
        Logger.debug(`Connecting to: ${apiBaseUrl}/api/health`);
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        
        const response = await fetch(`${apiBaseUrl}/api/health`, {
            signal: controller.signal
        });
        clearTimeout(timeoutId);
        
        if (response.ok) {
            const data = await response.json();
            Logger.info(`Connected to server v${data.version || 'Unknown'}`);
            updateConnectionStatus(true, data.version || 'Unknown');
            isConnected = true;
        } else {
            Logger.error(`Server returned status: ${response.status}`);
            updateConnectionStatus(false);
            isConnected = false;
        }
    } catch (e) {
        Logger.error(`Connection failed: ${e.message}`);
        updateConnectionStatus(false);
        isConnected = false;
    }
}

function updateConnectionStatus(connected, version) {
    const dot = document.getElementById('status-dot');
    const text = document.getElementById('status-text');
    const connStatus = document.getElementById('conn-status');
    const connServer = document.getElementById('conn-server');
    const connVersion = document.getElementById('conn-version');
    
    if (connected) {
        dot.className = 'status-dot connected';
        text.textContent = 'Connected';
        if (connStatus) connStatus.textContent = 'Connected';
        if (connServer) connServer.textContent = apiBaseUrl || '(same origin)';
        if (connVersion) connVersion.textContent = version || '-';
    } else {
        dot.className = 'status-dot disconnected';
        text.textContent = isDemoMode ? 'Demo Mode' : 'Not Connected';
        if (connStatus) connStatus.textContent = isDemoMode ? 'Demo Mode' : 'Not Connected';
        if (connServer) connServer.textContent = apiBaseUrl || '(not configured)';
        if (connVersion) connVersion.textContent = '-';
    }
    
    isConnected = connected;
}

function showConnectionSettings() {
    const modal = document.getElementById('connection-modal');
    const urlInput = document.getElementById('api-url');
    const timeoutInput = document.getElementById('timeout');
    
    urlInput.value = apiBaseUrl;
    timeoutInput.value = requestTimeout;
    
    // Update connection info display
    const connStatus = document.getElementById('conn-status');
    const connServer = document.getElementById('conn-server');
    
    if (connStatus) {
        connStatus.textContent = isConnected ? 'Connected' : (isDemoMode ? 'Demo Mode' : 'Not Connected');
    }
    if (connServer) {
        connServer.textContent = apiBaseUrl || '(not configured)';
    }
    
    modal.classList.add('active');
}

function testConnectionFromModal() {
    const urlInput = document.getElementById('api-url');
    let url = normalizeApiUrl(urlInput.value);
    urlInput.value = url; // Update input with normalized value
    
    const tempUrl = apiBaseUrl;
    apiBaseUrl = url;
    
    testConnection().then(() => {
        if (!isConnected) {
            apiBaseUrl = tempUrl;
        }
    });
}

async function testConnection() {
    if (isDemoMode) {
        showAlert('Demo mode is active. Disable demo mode to test real connection.', 'info');
        return;
    }
    
    if (!apiBaseUrl) {
        showAlert('Please enter a server URL first.', 'warning');
        return;
    }
    
    showAlert('Testing connection...', 'info');
    
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        
        const response = await fetch(`${apiBaseUrl}/api/health`, {
            signal: controller.signal
        });
        clearTimeout(timeoutId);
        
        if (response.ok) {
            const data = await response.json();
            updateConnectionStatus(true, data.version || 'Unknown');
            showAlert('Connection successful! Server version: ' + (data.version || 'Unknown'), 'success');
        } else {
            updateConnectionStatus(false);
            showAlert('Server responded with error: ' + response.status, 'error');
        }
    } catch (e) {
        updateConnectionStatus(false);
        if (e.name === 'AbortError') {
            showAlert('Connection timed out. Check that the server is running.', 'error');
        } else {
            showAlert('Connection failed: ' + e.message, 'error');
        }
    }
}

function saveConnectionSettings() {
    const urlInput = document.getElementById('api-url');
    const timeoutInput = document.getElementById('timeout');
    
    apiBaseUrl = normalizeApiUrl(urlInput.value);
    requestTimeout = parseInt(timeoutInput.value, 10) || 30;
    
    saveSettings();
    closeModal('connection-modal');
    checkServerConnection();
}

// CIK Lookup
function toggleCIKInput() {
    const useCik = document.getElementById('use-cik').checked;
    const tickerGroup = document.querySelector('.ticker-group');
    const cikGroup = document.querySelector('.cik-group');
    
    if (useCik) {
        tickerGroup.style.display = 'none';
        cikGroup.style.display = 'block';
    } else {
        tickerGroup.style.display = 'block';
        cikGroup.style.display = 'none';
    }
}

function showCIKLookup() {
    document.getElementById('cik-modal').classList.add('active');
}

async function searchCIK() {
    const searchTerm = document.getElementById('cik-search').value.trim();
    if (!searchTerm) {
        showAlert('Please enter a company name or ticker to search.', 'warning');
        return;
    }
    
    if (isDemoMode) {
        // Show demo results
        const demoResults = {
            'enron': { name: 'Enron Corp', cik: '0001024401' },
            'worldcom': { name: 'WorldCom Inc', cik: '0000723527' },
            'lehman': { name: 'Lehman Brothers Holdings Inc', cik: '0000806085' }
        };
        
        const term = searchTerm.toLowerCase();
        for (const [key, value] of Object.entries(demoResults)) {
            if (term.includes(key)) {
                showAlert(`Found: ${value.name} - CIK: ${value.cik}`, 'success');
                document.getElementById('cik').value = value.cik;
                document.getElementById('use-cik').checked = true;
                toggleCIKInput();
                closeModal('cik-modal');
                return;
            }
        }
        showAlert('No matching company found in demo data.', 'warning');
        return;
    }
    
    if (!isConnected) {
        showAlert('Server not connected. Enable Demo Mode or connect to server.', 'error');
        return;
    }
    
    try {
        const response = await fetch(`${apiBaseUrl}/api/cik/search?q=${encodeURIComponent(searchTerm)}`);
        if (response.ok) {
            const data = await response.json();
            if (data.results && data.results.length > 0) {
                const result = data.results[0];
                showAlert(`Found: ${result.name} - CIK: ${result.cik}`, 'success');
                document.getElementById('cik').value = result.cik;
                document.getElementById('use-cik').checked = true;
                toggleCIKInput();
                closeModal('cik-modal');
            } else {
                showAlert('No matching company found.', 'warning');
            }
        } else {
            showAlert('CIK search failed.', 'error');
        }
    } catch (e) {
        showAlert('CIK search error: ' + e.message, 'error');
    }
}

// Analysis Functions
async function analyzeCompany() {
    const useCik = document.getElementById('use-cik').checked;
    let identifier;
    
    if (useCik) {
        identifier = document.getElementById('cik').value.trim();
        if (!identifier) {
            showAlert('Please enter a CIK number.', 'warning');
            return;
        }
        Logger.info(`Starting analysis for CIK: ${identifier}`);
    } else {
        identifier = document.getElementById('ticker').value.trim().toUpperCase();
        if (!identifier) {
            showAlert('Please enter a ticker symbol.', 'warning');
            return;
        }
        Logger.info(`Starting analysis for ticker: ${identifier}`);
    }
    
    const scope = document.getElementById('scope').value;
    const include10K = document.getElementById('include-10k').checked;
    const include10Q = document.getElementById('include-10q').checked;
    const includeAmendments = document.getElementById('include-amendments').checked;
    const includeRaw = document.getElementById('include-raw').checked;
    
    Logger.debug(`Analysis options: scope=${scope}, 10K=${include10K}, 10Q=${include10Q}, amendments=${includeAmendments}`);
    
    // Show loading
    document.getElementById('loading').classList.remove('hidden');
    document.getElementById('results').classList.add('hidden');
    
    if (isDemoMode) {
        Logger.debug('Using demo mode - generating fake data');
        // Generate demo data
        setTimeout(() => {
            currentData = generateDemoData(identifier);
            displayResults(currentData);
            addToHistory(identifier, currentData);
            document.getElementById('loading').classList.add('hidden');
            Logger.info(`Demo analysis complete for ${identifier}`);
        }, 1500);
        return;
    }
    
    if (!isConnected) {
        Logger.error('Analysis failed - not connected to server');
        document.getElementById('loading').classList.add('hidden');
        showAlert('Not connected to server. Enable Demo Mode or configure connection.', 'error');
        return;
    }
    
    try {
        const params = new URLSearchParams({
            years: scope,
            include_10k: include10K,
            include_10q: include10Q,
            include_amendments: includeAmendments,
            include_raw: includeRaw
        });
        
        if (useCik) {
            params.append('cik', identifier);
        } else {
            params.append('ticker', identifier);
        }
        
        const url = `${apiBaseUrl}/api/analyze?${params}`;
        Logger.debug(`Fetching: ${url}`);
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), requestTimeout * 1000);
        
        const startTime = performance.now();
        const response = await fetch(url, {
            signal: controller.signal
        });
        clearTimeout(timeoutId);
        const elapsed = ((performance.now() - startTime) / 1000).toFixed(2);
        
        if (response.ok) {
            const data = await response.json();
            currentData = data;
            displayResults(data);
            addToHistory(identifier, data);
            Logger.info(`Analysis complete for ${identifier} in ${elapsed}s`);
        } else {
            const errorData = await response.json().catch(() => ({}));
            Logger.error(`Analysis failed: ${response.status} - ${errorData.error || 'Unknown error'}`);
            showAlert(errorData.error || 'Analysis failed: ' + response.status, 'error');
        }
    } catch (e) {
        if (e.name === 'AbortError') {
            showAlert('Request timed out. Try increasing the timeout in settings.', 'error');
        } else {
            showAlert('Unable to find company with ticker: ' + identifier, 'error');
        }
    } finally {
        document.getElementById('loading').classList.add('hidden');
    }
}

async function listFilings() {
    const ticker = document.getElementById('ticker').value.trim().toUpperCase();
    if (!ticker) {
        showAlert('Please enter a ticker symbol.', 'warning');
        return;
    }
    
    if (isDemoMode) {
        showAlert('Filing list not available in demo mode.', 'info');
        return;
    }
    
    if (!isConnected) {
        showAlert('Not connected to server.', 'error');
        return;
    }
    
    try {
        const response = await fetch(`${apiBaseUrl}/api/filings?ticker=${ticker}`);
        if (response.ok) {
            const data = await response.json();
            displayFilingsList(data);
        } else {
            showAlert('Failed to fetch filings list.', 'error');
        }
    } catch (e) {
        showAlert('Error fetching filings: ' + e.message, 'error');
    }
}

// Display Functions
function displayResults(data) {
    document.getElementById('results').classList.remove('hidden');
    
    // Company header
    const header = document.getElementById('company-header');
    header.innerHTML = `
        <div class="company-name">${escapeHtml(data.company?.name || data.ticker || 'Unknown')}</div>
        <div class="company-info">
            ${data.company?.ticker ? 'Ticker: ' + escapeHtml(data.company.ticker) : ''}
            ${data.company?.cik ? ' | CIK: ' + escapeHtml(data.company.cik) : ''}
            ${data.company?.sic ? ' | SIC: ' + escapeHtml(data.company.sic) : ''}
            | Filings Analyzed: ${data.filings_analyzed || 0}
        </div>
    `;
    
    // Overview tab
    displayOverview(data);
    
    // Models tab
    displayModels(data);
    
    // Filings tab
    displayFilings(data);
    
    // Trends tab
    displayTrends(data);
    
    // Red flags tab
    displayRedFlags(data);
    
    // Switch to overview tab
    switchTab('overview');
}

function displayOverview(data) {
    const container = document.getElementById('tab-overview');
    const risk = data.overall_risk || data.composite_risk || {};
    const riskLevel = risk.level || 'Unknown';
    const riskScore = risk.score || 0;
    
    container.innerHTML = `
        <div class="card-grid">
            <div class="card score-card">
                <div class="score-value ${getRiskClass(riskLevel)}">${(riskScore * 100).toFixed(0)}%</div>
                <div class="score-label">Overall Risk Score</div>
                <span class="score-indicator ${getBgClass(riskLevel)}">${riskLevel}</span>
            </div>
            <div class="card score-card">
                <div class="score-value">${data.filings_analyzed || 0}</div>
                <div class="score-label">Filings Analyzed</div>
            </div>
            <div class="card score-card">
                <div class="score-value ${getRiskClass(data.red_flags?.length > 3 ? 'HIGH' : 'LOW')}">${data.red_flags?.length || 0}</div>
                <div class="score-label">Red Flags Detected</div>
            </div>
        </div>
        
        <div class="card">
            <div class="card-title">Risk Summary</div>
            <p>${risk.summary || 'Analysis complete. Review individual model scores and red flags for details.'}</p>
        </div>
        
        ${data.recommendation ? `
        <div class="card">
            <div class="card-title">Recommendation</div>
            <p>${escapeHtml(data.recommendation)}</p>
        </div>
        ` : ''}
    `;
}

function displayModels(data) {
    const container = document.getElementById('tab-models');
    const models = data.models || {};
    
    let html = '<div class="card-grid">';
    
    // Beneish M-Score
    if (models.beneish) {
        const b = models.beneish;
        html += `
            <div class="card score-card">
                <div class="score-value ${b.m_score > -2.22 ? 'risk-high' : 'risk-low'}">${b.m_score?.toFixed(2) || 'N/A'}</div>
                <div class="score-label">Beneish M-Score</div>
                <span class="score-indicator ${b.m_score > -2.22 ? 'bg-high' : 'bg-low'}">
                    ${b.m_score > -2.22 ? 'Likely Manipulator' : 'Unlikely Manipulator'}
                </span>
                <p style="font-size:12px;color:var(--gray);margin-top:8px;">Threshold: -2.22</p>
            </div>
        `;
    }
    
    // Altman Z-Score
    if (models.altman) {
        const a = models.altman;
        const zone = a.z_score > 2.99 ? 'Safe' : (a.z_score < 1.81 ? 'Distress' : 'Gray');
        html += `
            <div class="card score-card">
                <div class="score-value ${a.z_score < 1.81 ? 'risk-high' : (a.z_score > 2.99 ? 'risk-low' : 'risk-moderate')}">${a.z_score?.toFixed(2) || 'N/A'}</div>
                <div class="score-label">Altman Z-Score</div>
                <span class="score-indicator ${a.z_score < 1.81 ? 'bg-high' : (a.z_score > 2.99 ? 'bg-low' : 'bg-moderate')}">${zone} Zone</span>
            </div>
        `;
    }
    
    // Piotroski F-Score
    if (models.piotroski) {
        const p = models.piotroski;
        html += `
            <div class="card score-card">
                <div class="score-value ${p.f_score >= 7 ? 'risk-low' : (p.f_score <= 3 ? 'risk-high' : 'risk-moderate')}">${p.f_score || 0}</div>
                <div class="score-label">Piotroski F-Score</div>
                <span class="score-indicator ${p.f_score >= 7 ? 'bg-low' : (p.f_score <= 3 ? 'bg-high' : 'bg-moderate')}">
                    ${p.f_score >= 7 ? 'Strong' : (p.f_score <= 3 ? 'Weak' : 'Moderate')}
                </span>
                <p style="font-size:12px;color:var(--gray);margin-top:8px;">Scale: 0-9</p>
            </div>
        `;
    }
    
    // Fraud Triangle
    if (models.fraud_triangle) {
        const ft = models.fraud_triangle;
        html += `
            <div class="card score-card">
                <div class="score-value ${ft.risk_score > 0.6 ? 'risk-high' : (ft.risk_score > 0.3 ? 'risk-moderate' : 'risk-low')}">${(ft.risk_score * 100).toFixed(0)}%</div>
                <div class="score-label">Fraud Triangle Risk</div>
                <span class="score-indicator ${ft.risk_score > 0.6 ? 'bg-high' : (ft.risk_score > 0.3 ? 'bg-moderate' : 'bg-low')}">
                    ${ft.risk_level || 'Unknown'}
                </span>
            </div>
        `;
    }
    
    // Benford's Law
    if (models.benford) {
        const bf = models.benford;
        html += `
            <div class="card score-card">
                <div class="score-value ${bf.suspicious ? 'risk-high' : 'risk-low'}">${bf.deviation?.toFixed(2) || 'N/A'}%</div>
                <div class="score-label">Benford's Law Deviation</div>
                <span class="score-indicator ${bf.suspicious ? 'bg-high' : 'bg-low'}">
                    ${bf.suspicious ? 'Anomaly Detected' : 'Normal'}
                </span>
            </div>
        `;
    }
    
    html += '</div>';
    
    container.innerHTML = html;
}

function displayFilings(data) {
    const container = document.getElementById('tab-filings');
    const filings = data.filings || [];
    
    if (filings.length === 0) {
        container.innerHTML = '<p>No filing data available.</p>';
        return;
    }
    
    let html = `
        <table class="data-table">
            <thead>
                <tr>
                    <th>Filing</th>
                    <th>Date</th>
                    <th>Type</th>
                    <th>Revenue</th>
                    <th>Net Income</th>
                    <th>Risk</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    for (const filing of filings) {
        html += `
            <tr>
                <td>${escapeHtml(filing.accession || '-')}</td>
                <td>${escapeHtml(filing.filed_date || '-')}</td>
                <td>${escapeHtml(filing.form_type || '-')}</td>
                <td>${formatCurrency(filing.revenue)}</td>
                <td>${formatCurrency(filing.net_income)}</td>
                <td><span class="score-indicator ${getBgClass(filing.risk_level || 'LOW')}">${filing.risk_level || '-'}</span></td>
            </tr>
        `;
    }
    
    html += '</tbody></table>';
    container.innerHTML = html;
}

function displayTrends(data) {
    const container = document.getElementById('tab-trends');
    const trends = data.trends || {};
    
    let html = '<div class="card-grid">';
    
    const trendItems = [
        { label: 'Revenue', value: trends.revenue_trend },
        { label: 'Net Income', value: trends.income_trend },
        { label: 'Cash Flow', value: trends.cash_flow_trend },
        { label: 'Debt Ratio', value: trends.debt_trend }
    ];
    
    for (const item of trendItems) {
        const trendClass = item.value === 'IMPROVING' ? 'risk-low' : 
                          (item.value === 'DECLINING' ? 'risk-high' : 'risk-moderate');
        html += `
            <div class="card score-card">
                <div class="score-value ${trendClass}">${getTrendArrow(item.value)}</div>
                <div class="score-label">${item.label}</div>
                <span class="score-indicator">${item.value || 'N/A'}</span>
            </div>
        `;
    }
    
    html += '</div>';
    container.innerHTML = html;
}

function displayRedFlags(data) {
    const container = document.getElementById('tab-redflags');
    const redFlags = data.red_flags || [];
    
    if (redFlags.length === 0) {
        container.innerHTML = `
            <div class="card">
                <p style="text-align:center;color:var(--success);">
                    No significant red flags detected.
                </p>
            </div>
        `;
        return;
    }
    
    let html = '';
    for (const flag of redFlags) {
        html += `
            <div class="red-flag">
                <div class="red-flag-icon">!</div>
                <div class="red-flag-content">
                    <div class="red-flag-title">${escapeHtml(flag.title || flag.type || 'Warning')}</div>
                    <div class="red-flag-description">${escapeHtml(flag.description || flag.message || '')}</div>
                </div>
            </div>
        `;
    }
    
    container.innerHTML = html;
}

function displayFilingsList(data) {
    // Could display in a modal or new tab
    Logger.debug('Filings received:', data);
    showAlert(`Found ${data.filings?.length || 0} filings.`, 'success');
}

// Tab Management
function switchTab(tabName) {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    
    document.querySelector(`.tab[data-tab="${tabName}"]`)?.classList.add('active');
    document.getElementById(`tab-${tabName}`)?.classList.add('active');
}

// Mode Toggles
function toggleDarkMode() {
    isDarkMode = !isDarkMode;
    document.body.classList.toggle('dark-mode', isDarkMode);
    saveSettings();
}

function toggleDemoMode() {
    isDemoMode = !isDemoMode;
    updateDemoModeUI();
    saveSettings();
    
    if (isDemoMode) {
        updateConnectionStatus(true, APP_VERSION + ' (Demo)');
        showAlert('Demo mode enabled. Using sample data.', 'info');
    } else {
        checkServerConnection();
        showAlert('Demo mode disabled.', 'info');
    }
}

function updateDemoModeUI() {
    const btn = document.getElementById('demo-mode-btn');
    if (btn) {
        btn.classList.toggle('active', isDemoMode);
    }
}

// Export Functions
function exportResults(format) {
    if (!currentData) {
        showAlert('No data to export. Run an analysis first.', 'warning');
        return;
    }
    
    let content, filename, type;
    
    switch (format) {
        case 'json':
            content = JSON.stringify(currentData, null, 2);
            filename = `fraud-analysis-${currentData.ticker || 'export'}.json`;
            type = 'application/json';
            break;
            
        case 'csv':
            content = convertToCSV(currentData);
            filename = `fraud-analysis-${currentData.ticker || 'export'}.csv`;
            type = 'text/csv';
            break;
            
        case 'html':
            content = generateHTMLReport(currentData);
            filename = `fraud-analysis-${currentData.ticker || 'export'}.html`;
            type = 'text/html';
            break;
            
        default:
            return;
    }
    
    downloadFile(content, filename, type);
    showAlert(`Exported to ${filename}`, 'success');
}

function convertToCSV(data) {
    const rows = [['Metric', 'Value']];
    
    rows.push(['Ticker', data.ticker || '']);
    rows.push(['Company', data.company?.name || '']);
    rows.push(['Filings Analyzed', data.filings_analyzed || 0]);
    rows.push(['Overall Risk Score', data.overall_risk?.score || '']);
    rows.push(['Risk Level', data.overall_risk?.level || '']);
    
    if (data.models?.beneish) {
        rows.push(['Beneish M-Score', data.models.beneish.m_score || '']);
    }
    if (data.models?.altman) {
        rows.push(['Altman Z-Score', data.models.altman.z_score || '']);
    }
    if (data.models?.piotroski) {
        rows.push(['Piotroski F-Score', data.models.piotroski.f_score || '']);
    }
    
    rows.push(['Red Flags', data.red_flags?.length || 0]);
    
    return rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n');
}

function generateHTMLReport(data) {
    return `<!DOCTYPE html>
<html>
<head>
    <title>Fraud Analysis Report - ${escapeHtml(data.ticker || 'Report')}</title>
    <style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
        h1 { color: #2563eb; }
        .risk-high { color: #dc2626; }
        .risk-low { color: #059669; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th, td { padding: 10px; border: 1px solid #ddd; text-align: left; }
        th { background: #f3f4f6; }
    </style>
</head>
<body>
    <h1>SEC EDGAR Fraud Analysis Report</h1>
    <p><strong>Company:</strong> ${escapeHtml(data.company?.name || data.ticker || 'Unknown')}</p>
    <p><strong>Generated:</strong> ${new Date().toLocaleString()}</p>
    <p><strong>Version:</strong> ${APP_VERSION}</p>
    
    <h2>Risk Summary</h2>
    <p><strong>Overall Risk:</strong> <span class="${getRiskClass(data.overall_risk?.level)}">${data.overall_risk?.level || 'Unknown'}</span></p>
    <p><strong>Score:</strong> ${((data.overall_risk?.score || 0) * 100).toFixed(0)}%</p>
    
    <h2>Model Scores</h2>
    <table>
        <tr><th>Model</th><th>Score</th><th>Interpretation</th></tr>
        ${data.models?.beneish ? `<tr><td>Beneish M-Score</td><td>${data.models.beneish.m_score?.toFixed(2)}</td><td>${data.models.beneish.m_score > -2.22 ? 'Likely Manipulator' : 'Unlikely Manipulator'}</td></tr>` : ''}
        ${data.models?.altman ? `<tr><td>Altman Z-Score</td><td>${data.models.altman.z_score?.toFixed(2)}</td><td>${data.models.altman.z_score > 2.99 ? 'Safe' : (data.models.altman.z_score < 1.81 ? 'Distress' : 'Gray')}</td></tr>` : ''}
        ${data.models?.piotroski ? `<tr><td>Piotroski F-Score</td><td>${data.models.piotroski.f_score}</td><td>${data.models.piotroski.f_score >= 7 ? 'Strong' : (data.models.piotroski.f_score <= 3 ? 'Weak' : 'Moderate')}</td></tr>` : ''}
    </table>
    
    <h2>Red Flags (${data.red_flags?.length || 0})</h2>
    <ul>
        ${(data.red_flags || []).map(f => `<li><strong>${escapeHtml(f.title || f.type)}</strong>: ${escapeHtml(f.description || f.message)}</li>`).join('')}
    </ul>
    
    <footer style="margin-top:40px;font-size:12px;color:#666;">
        <p>Generated by SEC EDGAR Fraud Analyzer v${APP_VERSION}</p>
        <p>Author: Bennie Shearer (Retired) | For educational purposes only</p>
    </footer>
</body>
</html>`;
}

function printReport() {
    window.print();
}

// Exit Application
function exitApplication() {
    if (confirm('Are you sure you want to exit the SEC EDGAR Fraud Analyzer?')) {
        window.close();
        // If window.close() doesn't work (common in modern browsers for security),
        // navigate to a blank page or show a message
        setTimeout(() => {
            document.body.innerHTML = '<div style="display:flex;justify-content:center;align-items:center;height:100vh;font-family:Arial,sans-serif;"><h2>You may now close this tab.</h2></div>';
        }, 100);
    }
}

// History Management
function addToHistory(identifier, data) {
    const entry = {
        identifier: identifier,
        company: data.company?.name || identifier,
        timestamp: new Date().toISOString(),
        riskLevel: data.overall_risk?.level || 'Unknown'
    };
    
    analysisHistory.unshift(entry);
    if (analysisHistory.length > 50) {
        analysisHistory.pop();
    }
    
    localStorage.setItem('analysisHistory', JSON.stringify(analysisHistory));
}

function loadHistory() {
    const stored = localStorage.getItem('analysisHistory');
    if (stored) {
        try {
            analysisHistory = JSON.parse(stored);
        } catch (e) {
            analysisHistory = [];
        }
    }
}

function showHistory() {
    const container = document.getElementById('history-list');
    
    if (analysisHistory.length === 0) {
        container.innerHTML = '<p style="text-align:center;color:var(--gray);">No analysis history.</p>';
    } else {
        container.innerHTML = analysisHistory.map(entry => `
            <div class="history-item" onclick="rerunAnalysis('${escapeHtml(entry.identifier)}')">
                <div class="history-item-info">
                    <div class="history-item-ticker">${escapeHtml(entry.company || entry.identifier)}</div>
                    <div class="history-item-date">${new Date(entry.timestamp).toLocaleString()}</div>
                </div>
                <span class="score-indicator ${getBgClass(entry.riskLevel)}">${entry.riskLevel}</span>
            </div>
        `).join('');
    }
    
    document.getElementById('history-modal').classList.add('active');
}

function clearHistory() {
    analysisHistory = [];
    localStorage.removeItem('analysisHistory');
    showHistory();
    showAlert('History cleared.', 'success');
}

function rerunAnalysis(identifier) {
    closeModal('history-modal');
    
    // Check if it's a CIK (starts with 0)
    if (identifier.startsWith('0') && identifier.length === 10) {
        document.getElementById('cik').value = identifier;
        document.getElementById('use-cik').checked = true;
        toggleCIKInput();
    } else {
        document.getElementById('ticker').value = identifier;
        document.getElementById('use-cik').checked = false;
        toggleCIKInput();
    }
    
    analyzeCompany();
}

// Batch Analysis
function showBatchAnalysis() {
    document.getElementById('batch-modal').classList.add('active');
}

async function runBatchAnalysis() {
    const textarea = document.getElementById('batch-tickers');
    const scope = document.getElementById('batch-scope').value;
    
    const tickers = textarea.value
        .split(/[,\n]/)
        .map(t => t.trim().toUpperCase())
        .filter(t => t.length > 0);
    
    if (tickers.length === 0) {
        showAlert('Please enter at least one ticker symbol.', 'warning');
        return;
    }
    
    closeModal('batch-modal');
    showAlert(`Starting batch analysis of ${tickers.length} companies...`, 'info');
    
    // For demo, just analyze the first one
    if (isDemoMode) {
        document.getElementById('ticker').value = tickers[0];
        analyzeCompany();
        return;
    }
    
    // Real batch analysis would need server support
    for (const ticker of tickers) {
        document.getElementById('ticker').value = ticker;
        await analyzeCompany();
        await new Promise(r => setTimeout(r, 1000)); // Rate limiting
    }
}

// Cache Management
function clearCache() {
    if (!isConnected && !isDemoMode) {
        showAlert('Not connected to server.', 'error');
        return;
    }
    
    if (isDemoMode) {
        showAlert('Cache cleared (demo mode).', 'success');
        return;
    }
    
    fetch(`${apiBaseUrl}/api/cache/clear`, { method: 'POST' })
        .then(r => {
            if (r.ok) {
                showAlert('Server cache cleared.', 'success');
            } else {
                showAlert('Failed to clear cache.', 'error');
            }
        })
        .catch(e => showAlert('Error: ' + e.message, 'error'));
}

// Modal Management
function closeModal(modalId) {
    document.getElementById(modalId)?.classList.remove('active');
}

function showHelp() {
    document.getElementById('help-modal').classList.add('active');
}

function showAbout() {
    document.getElementById('about-modal').classList.add('active');
}

function showKeyboardShortcuts() {
    document.getElementById('shortcuts-modal').classList.add('active');
}

// Alert Management
function showAlert(message, type = 'info') {
    const alertArea = document.getElementById('alert-area');
    const id = 'alert-' + Date.now();
    
    const alert = document.createElement('div');
    alert.id = id;
    alert.className = `alert alert-${type}`;
    alert.innerHTML = `
        <span>${escapeHtml(message)}</span>
        <button class="alert-close" onclick="dismissAlert('${id}')">&times;</button>
    `;
    
    alertArea.appendChild(alert);
    
    // Auto-dismiss after 5 seconds
    setTimeout(() => dismissAlert(id), 5000);
}

function dismissAlert(id) {
    const alert = document.getElementById(id);
    if (alert) {
        alert.remove();
    }
}

// Utility Functions
function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function formatCurrency(value) {
    if (value === undefined || value === null) return '-';
    const num = parseFloat(value);
    if (isNaN(num)) return '-';
    
    if (Math.abs(num) >= 1e9) {
        return '$' + (num / 1e9).toFixed(2) + 'B';
    } else if (Math.abs(num) >= 1e6) {
        return '$' + (num / 1e6).toFixed(2) + 'M';
    } else if (Math.abs(num) >= 1e3) {
        return '$' + (num / 1e3).toFixed(2) + 'K';
    }
    return '$' + num.toFixed(2);
}

function getRiskClass(level) {
    const l = (level || '').toUpperCase();
    if (l === 'LOW') return 'risk-low';
    if (l === 'MODERATE') return 'risk-moderate';
    if (l === 'ELEVATED') return 'risk-elevated';
    if (l === 'HIGH') return 'risk-high';
    if (l === 'CRITICAL') return 'risk-critical';
    return '';
}

function getBgClass(level) {
    const l = (level || '').toUpperCase();
    if (l === 'LOW') return 'bg-low';
    if (l === 'MODERATE') return 'bg-moderate';
    if (l === 'ELEVATED') return 'bg-elevated';
    if (l === 'HIGH') return 'bg-high';
    if (l === 'CRITICAL') return 'bg-critical';
    return '';
}

function getTrendArrow(trend) {
    if (trend === 'IMPROVING') return '^'; // Up arrow ASCII
    if (trend === 'DECLINING') return 'v'; // Down arrow ASCII
    return '-'; // Stable
}

function downloadFile(content, filename, type) {
    const blob = new Blob([content], { type: type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

// Demo Data Generator
function generateDemoData(identifier) {
    const isEnron = identifier.toUpperCase().includes('ENRON') || identifier === '0001024401';
    
    return {
        ticker: identifier,
        company: {
            name: isEnron ? 'Enron Corporation' : `${identifier} Inc.`,
            ticker: isEnron ? 'ENE' : identifier,
            cik: isEnron ? '0001024401' : '0000000000',
            sic: '4911'
        },
        filings_analyzed: 8,
        overall_risk: {
            score: isEnron ? 0.85 : 0.25,
            level: isEnron ? 'CRITICAL' : 'LOW'
        },
        models: {
            beneish: {
                m_score: isEnron ? -1.42 : -2.85,
                dsri: isEnron ? 1.35 : 1.02,
                gmi: isEnron ? 1.15 : 0.98,
                aqi: isEnron ? 1.28 : 1.01,
                sgi: isEnron ? 1.45 : 1.08
            },
            altman: {
                z_score: isEnron ? 1.25 : 3.45,
                zone: isEnron ? 'Distress' : 'Safe'
            },
            piotroski: {
                f_score: isEnron ? 2 : 7
            },
            fraud_triangle: {
                risk_score: isEnron ? 0.78 : 0.22,
                risk_level: isEnron ? 'HIGH' : 'LOW',
                pressure: isEnron ? 0.82 : 0.25,
                opportunity: isEnron ? 0.75 : 0.20,
                rationalization: isEnron ? 0.68 : 0.18
            },
            benford: {
                deviation: isEnron ? 8.5 : 2.1,
                suspicious: isEnron
            }
        },
        filings: [
            { accession: '0001024401-00-000123', filed_date: '2000-03-15', form_type: '10-K', revenue: isEnron ? 100789000000 : 50000000000, net_income: isEnron ? 979000000 : 5000000000, risk_level: isEnron ? 'HIGH' : 'LOW' },
            { accession: '0001024401-99-000456', filed_date: '1999-03-15', form_type: '10-K', revenue: isEnron ? 40112000000 : 45000000000, net_income: isEnron ? 893000000 : 4500000000, risk_level: isEnron ? 'MODERATE' : 'LOW' }
        ],
        trends: {
            revenue_trend: isEnron ? 'IMPROVING' : 'STABLE',
            income_trend: isEnron ? 'DECLINING' : 'IMPROVING',
            cash_flow_trend: isEnron ? 'DECLINING' : 'STABLE',
            debt_trend: isEnron ? 'DECLINING' : 'IMPROVING'
        },
        red_flags: isEnron ? [
            { type: 'EARNINGS_MANIPULATION', title: 'Beneish M-Score Above Threshold', description: 'M-Score of -1.42 exceeds the -2.22 threshold, indicating likely earnings manipulation.' },
            { type: 'BANKRUPTCY_RISK', title: 'Altman Z-Score in Distress Zone', description: 'Z-Score of 1.25 indicates high probability of bankruptcy within 2 years.' },
            { type: 'WEAK_FUNDAMENTALS', title: 'Low Piotroski F-Score', description: 'F-Score of 2 indicates weak financial fundamentals.' },
            { type: 'FRAUD_TRIANGLE', title: 'High Fraud Triangle Risk', description: 'Multiple fraud risk factors detected: high pressure, opportunity, and rationalization scores.' },
            { type: 'BENFORD_ANOMALY', title: 'Benford\'s Law Deviation', description: 'Significant deviation (8.5%) from expected digit distribution in financial figures.' }
        ] : [],
        recommendation: isEnron 
            ? 'CRITICAL RISK: Multiple fraud indicators detected. This analysis reflects Enron\'s actual financial condition prior to its 2001 collapse. The company filed for bankruptcy in December 2001.'
            : 'LOW RISK: No significant fraud indicators detected. Financial statements appear consistent with expected patterns.'
    };
}
