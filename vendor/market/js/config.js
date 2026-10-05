const BLACK_MARKET_CONFIG = {
    currencySymbol: "₹",
    categories: ["hints", "buffs", "mystery"],
    initialTeamMoney: 5000,
    finalCode: {
        enabled: true
    },
    riddle: {
        enabled: true,
        title: "CLASSIFIED FILE // 01",
        text: `<span class="animated-riddle-line" style="animation-delay: 0s">Four secrets hide beyond your sight,</span>
<span class="animated-riddle-line" style="animation-delay: 1s">Spend your flame to bring them to light.</span>
<br>
<span class="animated-riddle-line" style="animation-delay: 2s">Find all of them, clear and true,</span>
<span class="animated-riddle-line" style="animation-delay: 3s">Ignore the decoys hiding among them too.</span>
<br>
<span class="animated-riddle-line" style="animation-delay: 4s">Choose the best four, then change their name,</span>
<span class="animated-riddle-line" style="animation-delay: 5s">The Professor speaks in ones and zeros again.</span>
<br>
<span class="animated-riddle-line" style="animation-delay: 6s">Convert each one, then leave it be,</span>
<span class="animated-riddle-line" style="animation-delay: 7s">Stack the four and add to find the key.</span>`
    },
    marketplace: {
        enabled: true
    },
    items: {
        hints: [
            { id: "hint_01", name: "HINT // 01", description: "A small piece of intel about the current task.", price: 500, maxPurchases: 1 },
            { id: "hint_02", name: "HINT // 02", description: "Second clue.", price: 750, maxPurchases: 1 },
            { id: "hint_03", name: "HINT // 03", description: "Final clue.", price: 1000, maxPurchases: 1 }
        ],
        buffs: [
            { id: "torch_boost", name: "TORCH BOOST", description: "+30 seconds of torch duration", price: 750, type: "torch_duration", value: 30, maxPurchases: Infinity },
            { id: "time_shield", name: "TIME SHIELD", description: "Protects against one time penalty", price: 1000, maxPurchases: Infinity },
            { id: "vision_boost", name: "VISION BOOST", description: "Increase torch radius temporarily", price: 1250, type: "torch_radius", value: 20, maxPurchases: 1 }
        ],
        mystery: [
            { id: "mystery_01", name: "UNKNOWN ASSET // 01", description: "????", price: 1000, maxPurchases: 1, revealText: "Random Hint Added!" },
            { id: "mystery_02", name: "UNKNOWN ASSET // 02", description: "????", price: 1500, maxPurchases: 1, revealText: "Torch duration permanently boosted!" },
            { id: "mystery_03", name: "UNKNOWN ASSET // 03", description: "????", price: 2000, maxPurchases: 1, revealText: "Data corrupted. No benefit." }
        ]
    }
};
