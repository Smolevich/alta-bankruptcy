import { defineCollection, z } from 'astro:content';
import { file, glob } from 'astro/loaders';
import { docsLoader, i18nLoader } from '@astrojs/starlight/loaders';
import { docsSchema, i18nSchema } from '@astrojs/starlight/schema';

// The site rule "no source, no edit" is built into the schema: a page or news item
// without at least one source will not build.
// official: only government bodies, courts, banks and regulators; legal databases, publishers, chambers are reference;
// own: the site's own materials. Which kind is allowed for a domain is checked by scripts/check-sources.mjs.
export const SOURCE_KINDS = ['official', 'reliable_media', 'unverified', 'reference', 'own'] as const;

const source = z.object({
	title: z.string().min(1),
	url: z.string().url(),
	kind: z.enum(SOURCE_KINDS),
	date: z.coerce.date(),
	// Official sites delete and move files: next to the original is our copy of the PDF
	// (/docs/…) or a web-archive snapshot of the page.
	copy: z
		.string()
		.regex(/^(\/docs\/|https:\/\/web\.archive\.org\/web\/|https:\/\/archive\.ph\/)/, 'Копия: /docs/… или ссылка на веб-архив')
		.optional(),
});
// A string in three languages: omitting any language breaks the build.
const loc = z.object({ ru: z.string(), en: z.string(), sr: z.string() });
const sources = z.array(source).min(1, 'Нужен хотя бы один источник');

export const collections = {
	// Starlight has no interface translation for sr-Latn: without src/content/i18n/sr-Latn.json
	// the menu, search and anchor labels on /sr/ fall back to the root language, Russian.
	i18n: defineCollection({ loader: i18nLoader(), schema: i18nSchema() }),
	docs: defineCollection({
		loader: docsLoader(),
		schema: docsSchema({
			extend: z.object({
				sources,
				// When the author last checked the page against the sources.
				checked: z.coerce.date(),
			}),
		}),
	}),
	news: defineCollection({
		loader: glob({ pattern: '*/*.md', base: './src/content/news' }),
		schema: z.object({
			title: z.string().min(1),
			date: z.coerce.date(),
			publisher: z.enum(['aod', 'nbs', 'nbrm', 'bank', 'postanska', 'court', 'city', 'media']),
			summary: z.string().min(20).max(900),
			// Order among news of one day: greater is higher.
			order: z.number().default(0),
			// AOD forms to show as cards under the news item (src/data/aod-forms.ts).
			forms: z.array(z.enum(['prijava', 'fizicka', 'pravna'])).optional(),
			// A short note above the text: the news is near payouts but about something else (for example, "not about deposits").
			aside: z.string().min(3).optional(),
			// Links to our pages under the news text.
			links: z.array(z.object({ label: z.string().min(1), href: z.string().startsWith('/') })).optional(),
			// The news is outdated by later official announcements: the text is untouched, the note is shown above it.
			outdated: z
				.object({
					note: z.string().min(10),
					links: z.array(z.object({ label: z.string().min(1), href: z.string().startsWith('/') })).default([]),
				})
				.optional(),
			sources,
		}),
	}),
	status: defineCollection({
		loader: file('src/data/status.json'),
		schema: z.object({
			stage: z.number().int().min(1),
			// Release date of the notice in the Službeni glasnik (YYYY-MM-DD); null until there is a notice.
			publicationDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().default(null),
			headline: loc,
			// Card on the home page: one line per case (up to 50 000 € / more) and an action link.
			paths: z.array(z.object({ lead: loc, text: loc, link: loc, href: z.string().startsWith('/') })).default([]),
			note: loc.optional(),
			checkedAt: z.coerce.date(),
			stages: z
				.array(
					z.object({
						n: z.number().int(),
						// Runs in parallel with the current stage: the scale also shows "We are here".
						parallel: z.boolean().optional(),
						title: loc,
						when: loc,
						// Links next to the deadline (the notice text, the issue page); copy is a copy in the web archive.
						links: z.array(z.object({ label: loc, url: z.string().url(), copy: z.string().url().optional() })).optional(),
						// A passed stage: a link to the source; a future one: what triggers it.
						source: z.object({ url: z.string().url(), label: loc }).optional(),
						trigger: loc.optional(),
					}),
				)
				.min(2),
			sources,
		}),
	}),
};
