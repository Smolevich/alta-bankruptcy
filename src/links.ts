/** Links to PDFs and to other sites open in a new tab; our own pages and forms in the same one. */
export function opensInNewTab(url: string): boolean {
	if (/\.pdf($|[?#])/i.test(url)) return true;
	return /^https?:\/\//i.test(url) && !/^https?:\/\/alta\.smolevich\.com(\/|$)/i.test(url);
}
