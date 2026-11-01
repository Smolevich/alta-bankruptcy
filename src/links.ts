/** Ссылки на PDF и на чужие сайты открываем в новой вкладке; свои страницы и формы — в той же. */
export function opensInNewTab(url: string): boolean {
	if (/\.pdf($|[?#])/i.test(url)) return true;
	return /^https?:\/\//i.test(url) && !/^https?:\/\/alta\.smolevich\.com(\/|$)/i.test(url);
}
