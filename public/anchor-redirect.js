// Старые якоря (кириллица, транслит) уже разосланы в чатах: если такого id на странице нет,
// берём новый из /anchor-redirects.json, меняем адрес на английский якорь и прокручиваем к блоку.
(function () {
	function current() {
		var hash = location.hash.slice(1);
		try { return decodeURIComponent(hash); } catch (e) { return hash; }
	}
	function page() {
		var p = location.pathname.replace(/index\.html$/, '');
		return p.charAt(p.length - 1) === '/' ? p : p + '/';
	}
	function redirect() {
		var old = current();
		if (!old || document.getElementById(old)) return;
		fetch('/anchor-redirects.json')
			.then(function (r) { return r.ok ? r.json() : {}; })
			.then(function (map) {
				var next = (map[page()] || {})[old];
				var target = next && document.getElementById(next);
				if (!target) return;
				history.replaceState(history.state, '', location.pathname + location.search + '#' + next);
				// replaceState не шлёт hashchange: блокам, которые выбирают содержимое по якорю (город в списке отделений), сообщаем сами.
				window.dispatchEvent(new Event('anchor-redirect'));
				target.scrollIntoView();
			})
			.catch(function () {});
	}
	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', redirect);
	else redirect();
	window.addEventListener('hashchange', redirect);
})();
