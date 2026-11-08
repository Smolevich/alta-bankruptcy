// Якоря заголовков страниц: короткие английские id, одни и те же для ru/en/sr.
// Заголовки на всех языках идут в одном порядке, поэтому id задаём по порядку h2–h6.
// Переименовал якорь — добавь старый в public/anchor-redirects.json, иначе разосланные ссылки сломаются.
export const HEADING_IDS = {
	advokat: ['alone-or-lawyer', 'teaming-up', 'law-firm-offer', 'check-lawyer', 'what-to-ask'],
	bank: ['ownership', 'board', 'executive-board', 'capital', 'unknowns'],
	bezopasnost: ['no-queue-buying', 'what-not-to-send', 'payout-is-free', 'fake-aod', 'check-lawyer', 'complaints'],
	'imushchestvo-banka': ['all-assets', 'cash', 'real-estate', 'related-parties', 'valuation', 'not-disclosed'],
	index: ['most-asked', 'after-court-decision', 'three-steps', 'save-documents', 'when-to-file', 'what-to-expect', 'latest-news', 'up-to-50000', 'all-sections'],
	'kak-bylo': ['in-short', 'univerzal-2014', 'univerzal-still-open', 'other-cases'],
	'nalog-kvartira': ['in-short', 'completed-flat', 'mutual-cancellation', 'notary-cancellation', 'under-construction', 'transfer-tax', 'full-answer'],
	'otkaz-scheta': ['in-short', 'your-rights', 'step-1', 'step-2', 'step-3', 'citizenship', 'complaint-template', 'chat-example', 'compare-banks', 'record-result'],
	pomoch: ['rule', 'source-levels', 'how-to-correct', 'three-languages', 'news-item', 'report-account'],
	procedura: ['licence-revoked', 'bankruptcy-opened', 'paying-bank', 'payout-up-to-50000', 'claim-above-50000', 'claims-verified', 'payouts-above-50000'],
	ssylki: ['chats', 'food-help', 'official-contacts', 'our-tools'],
	trebovanie: ['who-files', 'where', 'deadline', 'gazette', 'what-to-prepare', 'payout-paperwork', 'authorisation', 'claim-form', 'payment-ranks', 'common-mistakes'],
	voprosy: ['now', 'payout-up-to-50000', 'companies-payout', 'claim-above-50000', 'class-action', 'loans-and-safes'],
	vypiski: ['now', 'without-statements', 'statement-emails', 'what-to-save', 'how-to-export', 'sole-traders', 'corporate', 'officebanking', 'do-not-send'],
	vyplata: ['now', 'postanska-branches', 'what-to-bring', 'item-notes', 'how-much', 'who-is-eligible', 'individuals', 'sole-traders-companies', 'aod-answers', 'euros-at-postanska', 'deposit-document', 'no-contract', 'power-of-attorney', 'investments'],
	zakony: ['deposit-insurance-law', 'bank-bankruptcy-law', 'bankruptcy-law', 'banking-law', 'national-bank-law', 'aod-procedure'],
};
