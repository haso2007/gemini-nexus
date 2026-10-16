import { describe, expect, it } from 'vitest';
import { buildGeminiHeaderRules, GEMINI_HEADER_RULE_IDS } from './gemini_header_rules.js';

describe('Gemini header rules', () => {
    it('rewrites Origin and Referer for background requests to Gemini hosts', () => {
        const [rule] = buildGeminiHeaderRules();

        expect(rule.id).toBe(GEMINI_HEADER_RULE_IDS[0]);
        expect(rule.condition.tabIds).toEqual([-1]);
        expect(rule.condition.requestDomains).toEqual([
            'gemini.google.com',
            'business.gemini.google.com',
            'push.clients6.google.com',
        ]);
        expect(rule.action.requestHeaders).toEqual([
            { header: 'Origin', operation: 'set', value: 'https://gemini.google.com' },
            { header: 'Referer', operation: 'set', value: 'https://gemini.google.com/' },
        ]);
    });
});
