export const GEMINI_HEADER_RULE_IDS = [91001];

const GEMINI_REQUEST_DOMAINS = [
    'gemini.google.com',
    'business.gemini.google.com',
    'push.clients6.google.com',
];

export function buildGeminiHeaderRules() {
    return [
        {
            id: GEMINI_HEADER_RULE_IDS[0],
            priority: 1,
            action: {
                type: 'modifyHeaders',
                requestHeaders: [
                    { header: 'Origin', operation: 'set', value: 'https://gemini.google.com' },
                    { header: 'Referer', operation: 'set', value: 'https://gemini.google.com/' },
                ],
            },
            condition: {
                requestDomains: GEMINI_REQUEST_DOMAINS,
                tabIds: [-1],
                resourceTypes: ['xmlhttprequest', 'other'],
            },
        },
    ];
}

export async function installGeminiHeaderRules() {
    if (!chrome.declarativeNetRequest?.updateDynamicRules) return;
    await chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: GEMINI_HEADER_RULE_IDS,
        addRules: buildGeminiHeaderRules(),
    });
}
