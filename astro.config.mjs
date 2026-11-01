// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import starlightLinksValidator from 'starlight-links-validator';
import { INSTAGRAM_URL } from './src/site.mjs';

// Сайт живёт в корне alta.smolevich.com: статику отдаёт сервис alta-feedback
// (см. docs/deploy.md), поэтому base не задаём.
export default defineConfig({
	site: 'https://alta.smolevich.com',
	integrations: [
		starlight({
			title: { ru: 'Вкладчики ALTA: что дальше', en: "ALTA depositors: what's next", 'sr-Latn': 'Štediše ALTA banke: šta dalje' },
			description:
				'Справочник для вкладчиков банка ALTA (Сербия), у которых на счетах больше 50 000 €: стадия процедуры, сроки, требование в банкротстве, официальные новости.',
			// Правка в два клика через веб-редактор GitHub, без клона репозитория.
			editLink: { baseUrl: 'https://github.com/Smolevich/alta-bankruptcy/edit/main/' },
			social: [
				{ icon: 'github', label: 'GitHub', href: 'https://github.com/Smolevich/alta-bankruptcy' },
				// Группа вкладчиков сама выберет ник: пока ссылки нет, значок скрыт.
				...(INSTAGRAM_URL ? [{ icon: 'instagram', label: 'Instagram', href: INSTAGRAM_URL }] : []),
			],
			defaultLocale: 'root',
			locales: {
				root: { label: 'Русский', lang: 'ru' },
				en: { label: 'English', lang: 'en' },
				sr: { label: 'Srpski', lang: 'sr-Latn' },
			},
			pagination: false,
			customCss: ['./src/styles/custom.css'],
			components: {
				Footer: './src/components/Footer.astro',
				// Только светлая тема: так написано на всех скриншотах и в брифе.
				ThemeProvider: './src/components/ThemeProvider.astro',
				ThemeSelect: './src/components/Empty.astro',
			},
			plugins: [// /account живёт в другом сервисе (alta-feedback), в этой сборке его страниц нет.
				starlightLinksValidator({ errorOnRelativeLinks: false, exclude: ['/account', '/account/**'] })],
			sidebar: [
				{ label: 'Сейчас', slug: 'index', translations: { en: 'Now', sr: 'Sada' } },
				{ label: 'Новости', slug: 'novosti', translations: { en: 'News', sr: 'Vesti' } },
				{ label: 'Процедура и сроки', slug: 'procedura', translations: { en: 'Procedure and timeline', sr: 'Postupak i rokovi' } },
				{ label: 'Требование сверх 50 000 €', slug: 'trebovanie', translations: { en: 'Claim above €50,000', sr: 'Prijava potraživanja iznad 50.000 €' } },
				{ label: 'Как было: Univerzal 2014 и другие', slug: 'kak-bylo', translations: { en: 'Past cases: Univerzal 2014 and others', sr: 'Raniji slučajevi: Univerzal 2014 i drugi' } },
				{ label: 'Банк: владелец и руководство', slug: 'bank', translations: { en: 'The bank: owner and management', sr: 'Banka: vlasnik i rukovodstvo' } },
				{ label: 'Законы', slug: 'zakony', translations: { en: 'Laws', sr: 'Zakoni' } },
				{ label: 'Как помочь и править', slug: 'pomoch', translations: { en: 'How to help and correct', sr: 'Kako pomoći i ispraviti' } },
			],
		}),
	],
});
