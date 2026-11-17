// Плагин rehype: «50 %» с обычным пробелом браузер переносит, и строка начинается со знака «%».
// Пробел между числом и «%» делаем неразрывным; код и цитаты-исходники в markdown не трогаем.
const SKIP = new Set(['code', 'pre', 'script', 'style']);
const DIGIT_SPACE_PERCENT = /(\d)[ \t]+%/g;

export function bindPercent(text) {
	return text.replace(DIGIT_SPACE_PERCENT, '$1 %');
}

function walk(node) {
	if (node.type === 'text') {
		node.value = bindPercent(node.value);
		return;
	}
	if (node.type === 'element' && SKIP.has(node.tagName)) return;
	for (const child of node.children ?? []) walk(child);
}

export default function rehypeNbspPercent() {
	return (tree) => walk(tree);
}
