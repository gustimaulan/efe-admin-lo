/**
 * EFE Admin Tool - Frontend Application
 */

class EFEAdminApp {
    constructor() {
        this.newLogCount = 0;
        this.activeTab = 'form';
        this.adminCount = 0;
        this.currentConfig = {};
        this.adminOptions = [];
        this.socket = null;
        this.currentJobId = null;
        
        this.init();
    }

    async init() {
        this.cacheDOMElements();
        this.bindEvents();
        await this.loadAdminOptions();
        this.initializeSocket();
        this.addAdminField();
    }

    cacheDOMElements() {
        // Tab elements
        this.formTab = document.getElementById('formTab');
        this.logTab = document.getElementById('logTab');
        this.formContent = document.getElementById('formContent');
        this.logContent = document.getElementById('logContent');
        this.logCounter = document.getElementById('logCounter');
        
        // Form elements
        this.automationForm = document.getElementById('automationForm');
        this.adminContainer = document.getElementById('adminContainer');
        this.automationButton = document.getElementById('automationButton');
        this.checkPlanButton = document.getElementById('checkPlanButton');
        
        // Log elements
        this.logContainer = document.getElementById('logContainer');
        this.clearLogsButton = document.getElementById('clearLogs');
        
        // Modal elements
        this.planModal = document.getElementById('planModal');
        this.closeModalButton = document.getElementById('closeModalButton');
        this.planContainer = document.getElementById('planContainer');
        
        // Status elements
        this.versionBadge = document.getElementById('versionBadge');
        this.statusIndicator = document.getElementById('statusIndicator');
    }

    bindEvents() {
        // Tab switching
        this.formTab.addEventListener('click', () => this.switchTab('form'));
        this.logTab.addEventListener('click', () => {
            this.switchTab('log');
            this.resetLogCounter();
        });

        // Form events
        this.automationForm.addEventListener('submit', (e) => this.handleFormSubmit(e));
        this.checkPlanButton.addEventListener('click', () => this.handleCheckPlan());
        this.clearLogsButton.addEventListener('click', () => this.clearLogs());

        // Modal events
        this.closeModalButton.addEventListener('click', () => this.closeModal());
        this.planModal.addEventListener('click', (e) => {
            if (e.target === this.planModal) this.closeModal();
        });
    }

    async loadAdminOptions() {
        try {
            const response = await fetch('/api/config');
            const result = await response.json();
            
            if (result.success) {
                this.currentConfig = result.data;
                this.adminOptions = this.currentConfig.ALLOWED_ADMIN_NAMES.map(name => ({
                    label: name,
                    value: name
                }));
                this.updateVersionBadge();
            } else {
                this.addLog('Failed to load admin options', true);
            }
        } catch (error) {
            this.addLog('Failed to load admin options', true);
            console.error('Failed to load admin options:', error);
        }
    }

    initializeSocket() {
        this.socket = io();
        
        this.socket.on('connect', () => {
            this.addLog('Connected to server via WebSocket.', false);
            this.updateStatusIndicator(true);
        });

        this.socket.on('disconnect', () => {
            this.addLog('Disconnected from server.', true);
            this.updateStatusIndicator(false);
        });

        this.socket.on('console_logs', (logEntry) => {
            this.addLog(`[Backend] ${logEntry.message}`, logEntry.isError);
        });

        this.socket.on('newLog', (logEntry) => {
            const message = logEntry.message.trim();
            this.addLog(message, logEntry.isError);
            
            if (this.isJobCompleteMessage(message)) {
                this.handleJobCompletion(logEntry);
            }
        });
    }

    switchTab(tab) {
        this.activeTab = tab;
        
        // Update tab styles
        [this.formTab, this.logTab].forEach(t => {
            t.classList.remove('text-white', 'border-blue-500');
            t.classList.add('text-slate-400', 'border-transparent', 'hover:bg-slate-700/50');
        });
        
        // Hide all content
        [this.formContent, this.logContent].forEach(c => c.classList.add('hidden'));

        // Show selected tab
        const tabElements = { form: this.formTab, log: this.logTab };
        const contentElements = { form: this.formContent, log: this.logContent };

        tabElements[tab].classList.add('text-white', 'border-blue-500');
        contentElements[tab].classList.remove('hidden');

        if (tab === 'form' && this.adminContainer.children.length === 0) {
            this.addAdminField();
        }
    }

    createAdminField(index) {
        const adminDiv = document.createElement('div');
        adminDiv.className = 'bg-slate-800/50 p-3 rounded-lg mb-2 border border-slate-700';
        adminDiv.dataset.adminIndex = index;
        
        const flexContainer = document.createElement('div');
        flexContainer.className = 'flex items-center space-x-2';
        
        const select = this.createAdminSelect(index);
        const buttonContainer = this.createButtonContainer();
        
        flexContainer.appendChild(select);
        flexContainer.appendChild(buttonContainer);
        adminDiv.appendChild(flexContainer);
        
        return adminDiv;
    }

    createAdminSelect(index) {
        const select = document.createElement('select');
        select.name = `admin${index}`;
        select.className = 'flex-grow p-2 border rounded-lg bg-slate-700 text-slate-200 border-slate-600 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20';
        select.required = true;
        
        const defaultOption = document.createElement('option');
        defaultOption.value = '';
        defaultOption.disabled = true;
        defaultOption.selected = true;
        defaultOption.textContent = 'Select an admin';
        select.appendChild(defaultOption);
        
        this.adminOptions.forEach(opt => {
            const option = document.createElement('option');
            option.value = opt.value;
            option.textContent = opt.label;
            select.appendChild(option);
        });
        
        return select;
    }

    createButtonContainer() {
        const buttonContainer = document.createElement('div');
        buttonContainer.className = 'flex items-center space-x-1';
        
        const addButton = this.createAddButton();
        const removeButton = this.createRemoveButton();
        
        buttonContainer.appendChild(addButton);
        buttonContainer.appendChild(removeButton);
        
        return buttonContainer;
    }

    createAddButton() {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'bg-green-500/20 hover:bg-green-500/40 text-green-400 w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200';
        button.innerHTML = '+';
        button.style.fontSize = '18px';
        button.style.fontWeight = 'bold';
        button.onclick = () => this.addAdminField();
        return button;
    }

    createRemoveButton() {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'rmv bg-red-500/20 hover:bg-red-500/40 text-red-400 w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200';
        button.innerHTML = '−';
        button.style.fontSize = '18px';
        button.style.fontWeight = 'bold';
        button.onclick = (e) => {
            const field = e.target.closest('[data-admin-index]');
            this.removeAdminField(field);
        };
        return button;
    }

    addAdminField() {
        this.adminCount++;
        const newField = this.createAdminField(this.adminCount);
        this.adminContainer.appendChild(newField);
        this.updateRemoveButtons();
        this.updateAdminCounter();
    }

    removeAdminField(field) {
        if (this.adminCount > 1) {
            field.remove();
            this.adminCount--;
            this.updateRemoveButtons();
            this.updateAdminCounter();
        }
    }

    updateRemoveButtons() {
        const removeButtons = this.adminContainer.querySelectorAll('.rmv');
        removeButtons.forEach(button => {
            const disabled = this.adminCount <= 1;
            button.disabled = disabled;
            button.classList.toggle('opacity-50', disabled);
            button.classList.toggle('cursor-not-allowed', disabled);
        });
    }

    updateAdminCounter() {
        const counter = document.getElementById('adminCounter');
        if (counter) {
            counter.textContent = `(${this.adminCount})`;
        }
    }

    async handleFormSubmit(e) {
        e.preventDefault();
        
        this.setButtonLoading(true);
        this.addLog('Starting automation...');
        
        try {
            const response = await fetch('/api/run', { 
                method: 'POST', 
                body: new URLSearchParams(new FormData(this.automationForm)) 
            });
            
            const result = await response.json();
            
            if (result.success) {
                this.currentJobId = result.data.jobId;
                this.addLog(`Job started with ID: ${result.data.jobId}`);
                this.socket.emit('subscribeToJob', result.data.jobId);
            } else {
                throw new Error(result.error?.message || 'Failed to start automation');
            }
        } catch (error) {
            this.addLog(`Error: ${error.message}`, true);
        } finally {
            this.setButtonLoading(false);
        }
    }

    async handleCheckPlan() {
        this.planContainer.innerHTML = '<div class="text-center text-slate-400"><i class="fas fa-spinner fa-spin mr-2"></i>Generating plan...</div>';
        this.planModal.classList.remove('hidden');
        
        try {
            const response = await fetch('/api/check-plan', {
                method: 'POST',
                body: new URLSearchParams(new FormData(this.automationForm))
            });
            
            const result = await response.json();
            
            if (result.success) {
                this.displayPlan(result.data.plan);
            } else {
                this.planContainer.innerHTML = `<div class="text-red-400"><i class="fas fa-exclamation-triangle mr-2"></i>Error: ${result.error?.message || 'Failed to generate plan.'}</div>`;
            }
        } catch (error) {
            this.planContainer.innerHTML = '<div class="text-red-400"><i class="fas fa-server mr-2"></i>Failed to connect to server to generate plan.</div>';
        }
    }

    displayPlan(plan) {
        if (!plan || plan.length === 0) {
            this.planContainer.innerHTML = '<div class="text-slate-400 text-center">No campaigns to process.</div>';
            return;
        }
        
        this.planContainer.innerHTML = plan.map(item => {
            const excludedText = item.excludedAdmins.length > 0 
                ? `Excluded: <span class="text-red-400">[${item.excludedAdmins.join(', ')}]</span>` 
                : 'No exclusions.';
            const processingText = item.processingAdmins.length > 0 
                ? `Processing: <span class="text-green-400">[${item.processingAdmins.join(', ')}]</span>` 
                : '<span class="text-yellow-400">SKIPPED</span>';
            
            return `<div class="border-b border-slate-700 pb-2 mb-2">
                <strong class="text-white">Campaign ${item.campaignId}</strong><br>
                <span class="text-slate-400 text-xs">${excludedText} &rarr; ${processingText}</span>
            </div>`;
        }).join('');
    }

    closeModal() {
        this.planModal.classList.add('hidden');
    }

    clearLogs() {
        this.logContainer.innerHTML = '';
        this.addLog('Logs cleared.', false);
    }

    addLog(message, isError = false) {
        const timestamp = new Date().toLocaleTimeString();
        const logEntry = document.createElement('p');
        logEntry.className = 'opacity-0 transition-opacity duration-300';
        logEntry.innerHTML = `<span class="text-slate-500 mr-2">[${timestamp}]</span> <span class="${isError ? 'text-red-400' : 'text-slate-300'}">${this.escapeHtml(message)}</span>`;
        
        this.logContainer.appendChild(logEntry);
        
        // Fade in effect
        setTimeout(() => { 
            logEntry.classList.remove('opacity-0'); 
        }, 50);
        
        this.logContainer.scrollTop = this.logContainer.scrollHeight;
        
        // Update log counter if not on log tab
        if (this.activeTab !== 'log' && !message.includes('Connected to server')) {
            this.newLogCount++;
            this.updateLogCounter();
        }
    }

    updateLogCounter() {
        this.logCounter.textContent = this.newLogCount;
        this.logCounter.classList.remove('hidden');
    }

    resetLogCounter() {
        this.newLogCount = 0;
        this.logCounter.textContent = this.newLogCount;
        this.logCounter.classList.add('hidden');
    }

    setButtonLoading(loading) {
        if (loading) {
            this.automationButton.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Processing...';
            this.automationButton.disabled = true;
        } else {
            this.automationButton.innerHTML = '<i class="fas fa-play-circle mr-2"></i>Submit';
            this.automationButton.disabled = false;
        }
    }

    isJobCompleteMessage(message) {
        return message.includes('Automation completed') || message.includes('Automation failed');
    }

    handleJobCompletion(logEntry) {
        if (!logEntry.isError && logEntry.message.includes('Automation completed')) {
            this.resetForm();
        }
        this.setButtonLoading(false);
    }

    resetForm() {
        this.adminContainer.innerHTML = '';
        this.adminCount = 0;
        this.addAdminField();
    }

    updateVersionBadge() {
        if (this.versionBadge && this.currentConfig.version) {
            this.versionBadge.textContent = `v${this.currentConfig.version}`;
        }
    }

    updateStatusIndicator(connected) {
        if (this.statusIndicator) {
            this.statusIndicator.className = `w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`;
            this.statusIndicator.title = connected ? 'Connected' : 'Disconnected';
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Initialize the application when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new EFEAdminApp();
});