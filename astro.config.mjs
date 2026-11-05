// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import starlightLinksValidator from 'starlight-links-validator';
import { INSTAGRAM_URL } from './src/site.mjs';
import { unified } from '@astrojs/markdown-remark';
import rehypeNewTab from './src/rehype-new-tab.mjs';

// Сайт живёт в корне alta.smolevich.com: статику отдаёт сервис из backend/
// (см. docs/deploy.md), поэтому base не задаём.
export default defineConfig({
	site: 'https://alta.smolevich.com',
	markdown: { processor: unified({ rehypePlugins: [rehypeNewTab] }) },
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
				// Группа вкладчиков сама выберет ник: пока ссылки нет, значок скрыт.
				{ icon: 'telegram', label: 'Telegram', href: 'https://t.me/Altadef50k' },
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
				// Только светлая тема: так написано на всех скриншотах и в брифе.
				ThemeProvider: './src/components/ThemeProvider.astro',
				ThemeSelect: './src/components/Empty.astro',
			},
			plugins: [// /account отдаёт сервис из backend/, в сборке Astro его страниц нет.
				starlightLinksValidator({ errorOnRelativeLinks: false, exclude: ['/account', '/account/**'] })],
			sidebar: [
				{ label: 'Сейчас', slug: 'index', translations: { en: 'Now', sr: 'Sada' } },
				{ label: 'Процедура и сроки', slug: 'procedura', translations: { en: 'Procedure and timeline', sr: 'Postupak i rokovi' } },
				{ label: 'Выплата до 50 000 €', slug: 'vyplata', translations: { en: 'Payout up to €50,000', sr: 'Isplata do 50.000 €' } },
				{ label: 'Требование сверх 50 000 €', slug: 'trebovanie', translations: { en: 'Claim above €50,000', sr: 'Prijava potraživanja iznad 50.000 €' } },
				{ label: 'Вопросы и ответы', slug: 'voprosy', translations: { en: 'Questions and answers', sr: 'Pitanja i odgovori' } },
				{ label: 'Что сохранить: выписки и документы', slug: 'vypiski', translations: { en: 'What to save: statements and documents', sr: 'Šta sačuvati: izvodi i dokumenta' } },
				{ label: 'Как не попасть на мошенников', slug: 'bezopasnost', translations: { en: 'Stay safe: avoid scams', sr: 'Bezbednost: kako da izbegnete prevaru' } },
				{ label: 'Новости', slug: 'novosti', translations: { en: 'News', sr: 'Vesti' } },
				{ label: 'Как было: Univerzal 2014 и другие', slug: 'kak-bylo', translations: { en: 'Past cases: Univerzal 2014 and others', sr: 'Raniji slučajevi: Univerzal 2014 i drugi' } },
				{ label: 'Банк: владелец и руководство', slug: 'bank', translations: { en: 'The bank: owner and management', sr: 'Banka: vlasnik i rukovodstvo' } },
				{ label: 'Документы банка', slug: 'dokumenty', translations: { en: 'Bank documents', sr: 'Dokumenta banke' } },
				{ label: 'Законы', slug: 'zakony', translations: { en: 'Laws', sr: 'Zakoni' } },
				{ label: 'Как помочь и править', slug: 'pomoch', translations: { en: 'How to help and correct', sr: 'Kako pomoći i ispraviti' } },
				{ label: 'Полезные ссылки и помощь', slug: 'ssylki', translations: { en: 'Useful links and help', sr: 'Korisni linkovi i pomoć' } },
				// Страница отдаётся сервисом формы, не Starlight: обычная ссылка (валидатор её пропускает через exclude).
				{ label: 'Где открывают счета', link: '/account/stats', translations: { en: 'Where accounts get opened', sr: 'Gde se otvaraju računi' } },
			],
		}),
	],
});
