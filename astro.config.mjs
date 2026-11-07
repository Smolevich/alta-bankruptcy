// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import starlightLinksValidator from 'starlight-links-validator';
import { INSTAGRAM_URL, TELEGRAM_CHANNEL_URL, TELEGRAM_CHAT_URL } from './src/site.mjs';
import { unified } from '@astrojs/markdown-remark';
import rehypeNewTab from './src/rehype-new-tab.mjs';
import rehypeHeadingIds from './src/rehype-heading-ids.mjs';

// Сайт живёт в корне alta.smolevich.com: статику отдаёт сервис из backend/
// (см. docs/deploy.md), поэтому base не задаём.
export default defineConfig({
	site: 'https://alta.smolevich.com',
	markdown: { processor: unified({ rehypePlugins: [rehypeNewTab, rehypeHeadingIds] }) },
	integrations: [
		starlight({
			title: { ru: 'Вкладчики ALTA: что дальше', en: "ALTA depositors: what's next", 'sr-Latn': 'Štediše ALTA banke: šta dalje' },
			description:
				'Справочник для вкладчиков банка ALTA (Сербия), у которых на счетах больше 50 000 €: стадия процедуры, сроки, требование в банкротстве, официальные новости.',
			head: [
				// Подтверждение владения для Bing Webmaster Tools: без тега подтверждение слетит.
				{ tag: 'meta', attrs: { name: 'msvalidate.01', content: 'F904AA02101BD3884A4A984CD73C8E57' } },
				{ tag: 'link', attrs: { rel: 'icon', href: '/favicon.ico', sizes: '32x32' } },
				{ tag: 'link', attrs: { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' } },
				// Разосланные старые якоря ведут на новые английские (см. src/heading-ids.mjs).
				{ tag: 'script', attrs: { src: '/anchor-redirect.js', defer: true } },
				// Счётчик Cloudflare Web Analytics; токен публичный. CSP разрешает его в backend (site.py).
				{
					tag: 'script',
					attrs: {
						type: 'module',
						src: 'https://static.cloudflareinsights.com/beacon.min.js',
						'data-cf-beacon': '{"token": "fe16933a65524594b31524da4c01f99c"}',
					},
				},
			],
			// Правка в два клика через веб-редактор GitHub, без клона репозитория.
			editLink: { baseUrl: 'https://github.com/Smolevich/alta-bankruptcy/edit/main/' },
			social: [
				{ icon: 'github', label: 'GitHub', href: 'https://github.com/Smolevich/alta-bankruptcy' },
				// Подписи на языке страницы подставляет src/components/SocialIcons.astro.
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
			// «Назад/Далее» внизу страницы идут в порядке бокового меню, как плитки на главной.
			pagination: true,
			customCss: ['./src/styles/custom.css'],
			components: {
				Footer: './src/components/Footer.astro',
				SocialIcons: './src/components/SocialIcons.astro',
				// Только светлая тема: так написано на всех скриншотах и в брифе.
				ThemeProvider: './src/components/ThemeProvider.astro',
				ThemeSelect: './src/components/Empty.astro',
			},
			plugins: [// /account отдаёт сервис из backend/, в сборке Astro его страниц нет.
				starlightLinksValidator({ errorOnRelativeLinks: false, exclude: ['/account', '/account/**'] })],
			// Сверху действия, справка — в свёрнутых группах; «Как помочь» (/pomoch/) живёт в подвале.
			sidebar: [
				{ label: 'Что сейчас', slug: 'index', translations: { en: 'What is happening now', 'sr-Latn': 'Šta se sada dešava' } },
				{
					label: 'Что делать',
					translations: { en: 'What to do', 'sr-Latn': 'Šta da radite' },
					collapsed: false,
					items: [
						{ label: 'Получить до 50 000 €', slug: 'vyplata', translations: { en: 'Get up to €50,000', 'sr-Latn': 'Preuzmite do 50.000 €' } },
						{ label: 'Подать требование сверх 50 000 €', slug: 'trebovanie', translations: { en: 'File a claim above €50,000', 'sr-Latn': 'Prijavite potraživanje iznad 50.000 €' } },
						// Страница отдаётся сервисом формы и есть только по-русски: полный адрес, иначе Starlight
						// приклеит /en/ или /sr/ и ссылка уйдёт в 404.
						{ label: 'Где открыть счёт для выплаты', link: 'https://alta.smolevich.com/account/stats', translations: { en: 'Where to open an account for the payout', 'sr-Latn': 'Gde otvoriti račun za isplatu' } },
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
						{ label: 'Что есть у банка', slug: 'imushchestvo-banka', translations: { en: 'What the bank owns', 'sr-Latn': 'Šta banka ima' } },
						{ label: 'Документы банка', slug: 'dokumenty', translations: { en: 'Bank documents', 'sr-Latn': 'Dokumenta banke' } },
						{ label: 'Законы', slug: 'zakony', translations: { en: 'Laws', 'sr-Latn': 'Zakoni' } },
					],
				},
			],
		}),
	],
});
