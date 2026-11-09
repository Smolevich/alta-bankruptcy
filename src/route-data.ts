import { defineRouteMiddleware } from '@astrojs/starlight/route-data';

// Starlight links the site title to "/en" and "/sr"; the server answers those with a 307 to the
// slash form, so every crawl of a translated page walks into a redirect.
export const onRequest = defineRouteMiddleware((context) => {
	const route = context.locals.starlightRoute;
	if (!route.siteTitleHref.endsWith('/')) route.siteTitleHref += '/';
});
