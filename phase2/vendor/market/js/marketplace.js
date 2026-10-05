class Marketplace {
    constructor() {
        this.currentCategory = 'hints';
        this.isProcessing = false;
        this.displayedMoney = 0;
        this.teamState = null;
        this.init();
    }

    async init() {
        const teamId = TeamService.getCurrentTeam();
        this.teamState = await TeamService.getTeamState(teamId);
        this.displayedMoney = this.teamState.money;
        
        document.getElementById('hub-team-id').innerText = this.teamState.teamName.toUpperCase();
        document.getElementById('hub-funds').innerText = `${BLACK_MARKET_CONFIG.currencySymbol}${this.displayedMoney}`;
        
        this.setupNavigation();
        this.renderCategory(this.currentCategory);

        if (DEBUG_MODE) {
            const select = document.getElementById('debug-team-select');
            if (select) {
                select.value = teamId;
                select.addEventListener('change', async (e) => {
                    TeamService.setCurrentTeam(e.target.value);
                    await this.init(); // reload hub for new team
                });
            }
            
            const btnReset = document.getElementById('debug-reset-team');
            if (btnReset) {
                btnReset.addEventListener('click', async () => {
                    const current = TeamService.getCurrentTeam();
                    localStorage.removeItem(`blackMarketState_${current}`);
                    await this.init();
                });
            }
        }
    }

    setupNavigation() {
        const buttons = document.querySelectorAll('.nav-btn');
        buttons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                if (this.isProcessing) return;
                buttons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                
                const newCategory = btn.getAttribute('data-tab');
                if (newCategory !== this.currentCategory) {
                    this.transitionCategory(newCategory);
                }
            });
        });
    }

    async transitionCategory(newCategory) {
        const contentArea = document.getElementById('hub-content-area');
        contentArea.style.opacity = '0';
        
        setTimeout(() => {
            this.currentCategory = newCategory;
            this.renderCategory(newCategory);
            
            // Subtly glitch/scanline transition
            contentArea.classList.add('transition-glitch');
            contentArea.style.opacity = '1';
            
            setTimeout(() => {
                contentArea.classList.remove('transition-glitch');
            }, 300);
        }, 200);
    }

    renderCategory(category) {
        const contentArea = document.getElementById('hub-content-area');
        contentArea.innerHTML = '';

        const items = BLACK_MARKET_CONFIG.items[category];
        if (!items) return;

        items.forEach(item => {
            const ownedCount = this.teamState.purchasedItems.filter(id => id === item.id).length;
            const isOwned = ownedCount > 0;
            const maxReached = item.maxPurchases && ownedCount >= item.maxPurchases;

            const card = document.createElement('div');
            card.className = `item-card ${isOwned ? 'owned' : ''}`;
            
            let btnHtml = '';
            if (maxReached) {
                if (category === 'hints') {
                    const invItem = this.teamState.inventory.hints.find(i => i.itemId === item.id);
                    if (invItem && invItem.revealed) {
                        btnHtml = `<button class="ui-btn disabled">[ ALREADY ACQUIRED ]</button>`;
                    } else {
                        btnHtml = `<button class="ui-btn reveal-btn" data-id="${item.id}" data-category="${category}">[ REVEAL INTEL ]</button>`;
                    }
                } else if (category === 'mystery') {
                    const invItem = this.teamState.inventory.mystery.find(i => i.itemId === item.id);
                    if (invItem && invItem.revealed) {
                        btnHtml = `<button class="ui-btn disabled">[ IDENTIFIED ]</button>`;
                    } else {
                        btnHtml = `<button class="ui-btn reveal-btn" data-id="${item.id}" data-category="${category}">[ IDENTIFY ASSET ]</button>`;
                    }
                } else {
                    btnHtml = `<button class="ui-btn disabled">[ ALREADY ACQUIRED ]</button>`;
                }
            } else {
                btnHtml = `<button class="ui-btn buy-btn" data-id="${item.id}" data-category="${category}">[ ACQUIRE ]</button>`;
            }

            let descHtml = `<div class="item-desc">${item.description}</div>`;
            if (category === 'mystery' && maxReached) {
                const invItem = this.teamState.inventory.mystery.find(i => i.itemId === item.id);
                if (invItem && invItem.revealed) {
                    descHtml = `<div class="item-desc highlight-desc">${item.revealText}</div>`;
                }
            } else if (category === 'hints' && maxReached) {
                const invItem = this.teamState.inventory.hints.find(i => i.itemId === item.id);
                if (invItem && invItem.revealed) {
                    descHtml = `<div class="item-desc highlight-desc">Revealed: The puzzle is a distraction.</div>`; // Example
                }
            }

            card.innerHTML = `
                <div class="item-header">
                    <div class="item-title">${item.name}</div>
                    ${ownedCount > 0 ? `<div class="item-owned-indicator">OWNED ×${ownedCount}</div>` : ''}
                </div>
                ${descHtml}
                <div class="item-footer">
                    <div class="item-price">COST: <span>${BLACK_MARKET_CONFIG.currencySymbol}${item.price}</span></div>
                    ${btnHtml}
                </div>
            `;
            
            contentArea.appendChild(card);
        });

        // Add event listeners
        contentArea.querySelectorAll('.buy-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.handlePurchase(e.target));
        });
        
        contentArea.querySelectorAll('.reveal-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.handleReveal(e.target));
        });
    }

    async handlePurchase(button) {
        if (this.isProcessing) return;
        this.isProcessing = true;

        const itemId = button.getAttribute('data-id');
        const category = button.getAttribute('data-category');
        const originalText = button.innerText;

        button.innerText = '[ PROCESSING... ]';
        button.classList.add('processing');

        try {
            const teamId = TeamService.getCurrentTeam();
            // Optional fake delay for cinematic effect
            await new Promise(r => setTimeout(r, 600)); 

            const result = await TeamService.purchaseItem(teamId, category, itemId);
            
            // Reload state
            this.teamState = await TeamService.getTeamState(teamId);
            
            // Animate money deduction
            this.animateMoneyChange(result.effectivePrice, result.newBalance);

            button.innerText = '[ ACQUIRED ]';
            button.classList.remove('processing');
            button.classList.add('success');
            
            // Re-render category after slight delay
            setTimeout(() => {
                this.renderCategory(category);
                this.isProcessing = false;
            }, 1000);

        } catch (error) {
            button.innerText = '[ ERROR ]';
            button.classList.remove('processing');
            button.classList.add('error');
            
            // Flash red on funds if insufficient
            if (error.message === "INSUFFICIENT FUNDS") {
                const fundsEl = document.getElementById('hub-funds');
                fundsEl.classList.add('insufficient-flash');
                setTimeout(() => fundsEl.classList.remove('insufficient-flash'), 1000);
            }
            
            setTimeout(() => {
                button.innerText = originalText;
                button.classList.remove('error');
                this.isProcessing = false;
            }, 1500);
        }
    }

    async handleReveal(button) {
        if (this.isProcessing) return;
        this.isProcessing = true;

        const itemId = button.getAttribute('data-id');
        const category = button.getAttribute('data-category');
        
        button.innerText = '[ DECRYPTING... ]';
        button.classList.add('processing');
        
        try {
            await new Promise(r => setTimeout(r, 1000));
            const teamId = TeamService.getCurrentTeam();
            await TeamService.revealItem(teamId, category, itemId);
            this.teamState = await TeamService.getTeamState(teamId);
            
            button.classList.remove('processing');
            this.renderCategory(category);
        } catch (error) {
            button.innerText = '[ ERROR ]';
            button.classList.remove('processing');
        } finally {
            this.isProcessing = false;
        }
    }

    animateMoneyChange(deductedAmount, targetBalance) {
        const fundsEl = document.getElementById('hub-funds');
        const diffEl = document.getElementById('hub-funds-diff');
        
        // Show diff
        diffEl.innerText = `-${BLACK_MARKET_CONFIG.currencySymbol}${deductedAmount}`;
        diffEl.style.opacity = '1';
        diffEl.style.transform = 'translateY(0)';
        diffEl.classList.add('show-diff');
        
        // Animate count down
        const duration = 800; // ms
        const startTime = performance.now();
        const startMoney = this.displayedMoney;
        const change = targetBalance - startMoney;

        const animate = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            // Ease out cubic
            const easeOut = 1 - Math.pow(1 - progress, 3);
            
            this.displayedMoney = Math.round(startMoney + change * easeOut);
            fundsEl.innerText = `${BLACK_MARKET_CONFIG.currencySymbol}${this.displayedMoney}`;
            
            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                this.displayedMoney = targetBalance;
                fundsEl.innerText = `${BLACK_MARKET_CONFIG.currencySymbol}${this.displayedMoney}`;
                
                setTimeout(() => {
                    diffEl.classList.remove('show-diff');
                    diffEl.style.opacity = '0';
                    diffEl.style.transform = 'translateY(10px)';
                }, 1000);
            }
        };
        
        requestAnimationFrame(animate);
    }
}
