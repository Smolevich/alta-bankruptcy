// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import sitemap from '@astrojs/sitemap';
import starlightLinksValidator from 'starlight-links-validator';
import { INSTAGRAM_URL, TELEGRAM_CHANNEL_URL, TELEGRAM_CHAT_URL } from './src/site.mjs';
import { unified } from '@astrojs/markdown-remark';
import rehypeNewTab from './src/rehype-new-tab.mjs';
import rehypeHeadingIds from './src/rehype-heading-ids.mjs';
import rehypeNbspPercent from './src/rehype-nbsp-percent.mjs';
import { lastmodByPath, noindexPaths } from './src/sitemap-lastmod.mjs';

const SITE = 'https://alta.smolevich.com';
const LASTMOD = lastmodByPath('./src/content/docs', './src/content/news');
const NOINDEX = noindexPaths('./src/content/docs');

// The site lives at the root of alta.smolevich.com: the static files are served by the service from backend/
// (see docs/deploy.md), so base is not set.
export default defineConfig({
	site: SITE,
	markdown: { processor: unified({ rehypePlugins: [rehypeNewTab, rehypeHeadingIds, rehypeNbspPercent] }) },
	integrations: [
		// Our own instance instead of the one built into Starlight: that one knows neither lastmod nor the backend pages.
		// i18n as in Starlight, otherwise hreflang disappears from the sitemap.
		sitemap({
			i18n: { defaultLocale: 'root', locales: { root: 'ru', en: 'en', sr: 'sr-Latn' } },
			// The page is served by the backend and is not in the Astro build; the /account form is noindex and stays out of the sitemap.
			// No date is set: the data changes with every answer.
			customPages: [`${SITE}/account/stats`],
			filter: (page) => !NOINDEX.has(new URL(page).pathname),
			serialize(item) {
				const lastmod = LASTMOD.get(new URL(item.url).pathname);
				return lastmod ? { ...item, lastmod } : item;
			},
		}),
		starlight({
			title: { ru: 'Вкладчики ALTA: что дальше', en: "ALTA depositors: what's next", 'sr-Latn': 'Štediše ALTA banke: šta dalje' },
			description:
				'Справочник для вкладчиков банка ALTA (Сербия), у которых на счетах больше 50 000 €: стадия процедуры, сроки, требование в банкротстве, официальные новости.',
			head: [
				// Ownership verification for Bing Webmaster Tools: without the tag the verification lapses.
				{ tag: 'meta', attrs: { name: 'msvalidate.01', content: 'F904AA02101BD3884A4A984CD73C8E57' } },
				// Commit of the build: the deploy checks through Cloudflare that the edge serves this build, not a cached one.
				{ tag: 'meta', attrs: { name: 'alta-build', content: process.env.GITHUB_SHA ?? 'dev' } },
				{ tag: 'link', attrs: { rel: 'icon', href: '/favicon.ico', sizes: '32x32' } },
				{ tag: 'link', attrs: { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' } },
				// Previously sent anchors lead to the new English ones (see src/heading-ids.mjs).
				{ tag: 'script', attrs: { src: '/anchor-redirect.js', defer: true } },
				// Cloudflare Web Analytics counter; the token is public. CSP allows it in the backend (site.py).
				{
					tag: 'script',
					attrs: {
						type: 'module',
						src: 'https://static.cloudflareinsights.com/beacon.min.js',
						'data-cf-beacon': '{"token": "fe16933a65524594b31524da4c01f99c"}',
					},
				},
			],
			// Edit in two clicks through the GitHub web editor, without cloning the repository.
			editLink: { baseUrl: 'https://github.com/Smolevich/alta-bankruptcy/edit/main/' },
			social: [
				{ icon: 'github', label: 'GitHub', href: 'https://github.com/Smolevich/alta-bankruptcy' },
				// Labels in the page language are supplied by src/components/SocialIcons.astro.
				{ icon: 'telegram', label: 'Telegram-канал', href: TELEGRAM_CHANNEL_URL },
				{ icon: 'telegram', label: 'Telegram-чат', href: TELEGRAM_CHAT_URL },
				...(INSTAGRAM_URL ? [{ icon: 'instagram', label: 'Instagram', href: INSTAGRAM_URL }] : []),
			],
			defaultLocale: 'root',
			locales: {
				root: { label: 'Русский', lang: 'ru' },
				en: { label: 'English', lang: 'en' },
				sr: { label: 'Srpski', lang: 'sr-Latn' },
			},
			// "Back/Next" at the page bottom follow the sidebar order, like the tiles on the home page.
			pagination: true,
			customCss: ['./src/styles/custom.css'],
			routeMiddleware: './src/route-data.ts',
			components: {
				Footer: './src/components/Footer.astro',
				SocialIcons: './src/components/SocialIcons.astro',
				// Light theme only: that is how all screenshots and the brief are made.
				ThemeProvider: './src/components/ThemeProvider.astro',
				ThemeSelect: './src/components/Empty.astro',
			},
			plugins: [// /account is served by the backend, its pages are not in the Astro build.
				starlightLinksValidator({ errorOnRelativeLinks: false, exclude: ['/account', '/account/**'] })],
			// Actions on top, reference material in collapsed groups; "How to help" (/pomoch/) lives in the footer.
			sidebar: [
				{ label: 'Что сейчас', slug: 'index', translations: { en: 'What is happening now', 'sr-Latn': 'Šta se sada dešava' } },
				{
					label: 'Что делать',
					translations: { en: 'What to do', 'sr-Latn': 'Šta da radite' },
					collapsed: false,
					items: [
						{ label: 'Получить до 50 000 €', slug: 'vyplata', translations: { en: 'Get up to €50,000', 'sr-Latn': 'Preuzmite do 50.000 €' } },
						{ label: 'Подать требование сверх 50 000 €', slug: 'trebovanie', translations: { en: 'File a claim above €50,000', 'sr-Latn': 'Prijavite potraživanje iznad 50.000 €' } },
						// The page is served by the form service and exists only in Russian: a full address, otherwise Starlight
						// would prepend /en/ or /sr/ and the link would 404.
						{ label: 'Опыт вкладчиков: где открывают счета', link: 'https://alta.smolevich.com/account/stats', translations: { en: 'Depositors’ experience: where accounts get opened', 'sr-Latn': 'Iskustva deponenata: gde se otvaraju računi' } },
						{ label: 'Банк отказал в счёте: куда жаловаться', slug: 'otkaz-scheta', translations: { en: 'Account refused: where to complain', 'sr-Latn': 'Odbijen račun: gde se žaliti' } },
						{ label: 'Какие документы сохранить', slug: 'vypiski', translations: { en: 'Which documents to keep', 'sr-Latn': 'Koja dokumenta sačuvati' } },
					],
				},
				{
					label: 'Сроки и вопросы',
					translations: { en: 'Timeline and questions', 'sr-Latn': 'Rokovi i pitanja' },
					collapsed: false,
					items: [
						{ label: 'Вопросы и ответы', slug: 'voprosy', translations: { en: 'Questions and answers', 'sr-Latn': 'Pitanja i odgovori' } },
						{ label: 'Сроки банкротства', slug: 'procedura', translations: { en: 'Bankruptcy timeline', 'sr-Latn': 'Rokovi stečaja' } },
						{ label: 'Новости', slug: 'novosti', translations: { en: 'News', 'sr-Latn': 'Vesti' } },
						{ label: 'Осторожно: мошенники', slug: 'bezopasnost', translations: { en: 'Beware of scams', 'sr-Latn': 'Oprez: prevare' } },
						{ label: 'Как было с Univerzal (2014)', slug: 'kak-bylo', translations: { en: 'How it went with Univerzal (2014)', 'sr-Latn': 'Kako je bilo sa Univerzal bankom (2014)' } },
					],
				},
				{
					label: 'От вкладчиков',
					translations: { en: 'From depositors', 'sr-Latn': 'Od štediša' },
					collapsed: true,
					items: [
						{ label: 'Кейсы вкладчиков', slug: 'kejsy', translations: { en: 'Depositor cases', 'sr-Latn': 'Slučajevi štediša' } },
						{ label: 'Образец требования от вкладчиков', slug: 'obrazcy-trebovaniya', translations: { en: 'Claim sample from depositors', 'sr-Latn': 'Primer prijave od štediša' } },
						{ label: 'Адвокат: как выбрать и проверить', slug: 'advokat', translations: { en: 'Lawyer: how to choose and check', 'sr-Latn': 'Advokat: kako izabrati i proveriti' } },
						{ label: 'Чаты и помощь', slug: 'ssylki', translations: { en: 'Chats and help', 'sr-Latn': 'Četovi i pomoć' } },
					],
				},
				{
					label: 'Справка',
					translations: { en: 'Reference', 'sr-Latn': 'Informacije' },
					collapsed: true,
					items: [
						{ label: 'Банк: владелец и руководство', slug: 'bank', translations: { en: 'The bank: owner and management', 'sr-Latn': 'Banka: vlasnik i rukovodstvo' } },
						{ label: 'Что было на балансе ALTA', slug: 'imushchestvo-banka', translations: { en: 'What ALTA had on its balance sheet', 'sr-Latn': 'Šta je ALTA imala u bilansu' } },
						{ label: 'Документы банка', slug: 'dokumenty', translations: { en: 'Bank documents', 'sr-Latn': 'Dokumenta banke' } },
						{ label: 'Законы', slug: 'zakony', translations: { en: 'Laws', 'sr-Latn': 'Zakoni' } },
					],
				},
			],
		}),
	],
});
