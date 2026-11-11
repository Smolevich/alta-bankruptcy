// Ссылки собраны из закрепа чата @Altadef50k (01.11.2026). Частные инициативы мы не проверяем: kind = unverified.
// Ники организаторов сюда не переносим: у карточек ссылка на пост, где они указаны.
import type { Lang } from '../i18n';

type Text = Record<Lang, string>;

export type LinkCard = {
	group: 'chats' | 'help' | 'official' | 'tools';
	title: Text;
	what: Text;
	kind: 'official' | 'unverified';
	/** Подпись к ссылке: адрес или название. */
	url: string;
	label: string;
	extra?: { url: string; label: Text };
};

const same = (s: string): Text => ({ ru: s, en: s, sr: s });

export const LINKS: LinkCard[] = [
	{
		group: 'chats',
		title: same('@Altadef50k'),
		what: {
			ru: 'Чат для тех, у кого в ALTA больше 50 000 €: «Дефолт ALTA (от 50.000 евро)».',
			en: 'Chat for people with more than €50,000 at ALTA: “Дефолт ALTA (от 50.000 евро)”.',
			sr: 'Čet za one koji u ALTA banci imaju više od 50.000 €: „Дефолт ALTA (от 50.000 евро)“.',
		},
		kind: 'unverified',
		url: 'https://t.me/Altadef50k',
		label: 't.me/Altadef50k',
	},
	{
		group: 'chats',
		title: { ru: 'Раздел про ALTA в чате @srb_guide', en: 'ALTA section in the @srb_guide chat', sr: 'Odeljak o ALTA banci u četu @srb_guide' },
		what: {
			ru: 'Для тех, у кого меньше 50 000 €: отдельная ветка про ALTA в чате @srb_guide.',
			en: 'For people with less than €50,000: a separate ALTA thread in the @srb_guide chat.',
			sr: 'Za one sa manje od 50.000 €: posebna tema o ALTA banci u četu @srb_guide.',
		},
		kind: 'unverified',
		url: 'https://t.me/srb_guide/352309',
		label: 't.me/srb_guide/352309',
	},
	{
		group: 'chats',
		title: same('@volonteri_common'),
		what: {
			ru: 'Помощь от человека человеку: можно попросить или предложить.',
			en: 'Person-to-person help: you can ask for it or offer it.',
			sr: 'Pomoć od čoveka čoveku: možete tražiti ili ponuditi pomoć.',
		},
		kind: 'unverified',
		url: 'https://t.me/volonteri_common',
		label: 't.me/volonteri_common',
	},
	{
		group: 'help',
		title: { ru: 'Белград: DC Loža, продукты и вещи', en: 'Belgrade: DC Loža, food and goods', sr: 'Beograd: DC Loža, hrana i stvari' },
		what: {
			ru: 'Принимают и раздают продукты, детское питание, корм для животных, бытовую химию. Белград, Dalmatinska 84L (вход со стороны Ivankovačka), акция объявлена с 02.11 по 07.11.2026; часы работы и продление — в канале t.me/dcloza. Хотите помочь волонтёром — пишите в бот.',
			en: 'They accept and give out food, baby food, pet food and household items. Belgrade, Dalmatinska 84L (entrance from Ivankovačka), the drive was announced for 02.11 to 07.11.2026; opening hours and any extension are in the t.me/dcloza channel. Volunteers should write to the bot.',
			sr: 'Primaju i dele hranu, hranu za bebe, hranu za životinje i kućnu hemiju. Beograd, Dalmatinska 84L (ulaz sa strane Ivankovačke), akcija je najavljena od 02.11. do 07.11.2026; radno vreme i eventualno produženje su na kanalu t.me/dcloza. Volonteri pišu botu.',
		},
		kind: 'unverified',
		url: 'https://t.me/dcloza',
		label: 't.me/dcloza',
		extra: { url: 'https://maps.google.com/maps?q=DC+Lo%C5%BEa,+%D0%94%D0%B0%D0%BB%D0%BC%D0%B0%D1%82%D0%B8%D0%BD%D1%81%D0%BA%D0%B0+84L,+%D0%91%D0%B5%D0%BE%D0%B3%D1%80%D0%B0%D0%B4+11000&ftid=0x475a7b323372eab3:0x7a48d3f35c96fc1b', label: { ru: 'Карта', en: 'Map', sr: 'Mapa' } },
	},
	{
		group: 'help',
		title: {
			ru: 'Нови-Сад: взаимопомощь для клиентов ALTA',
			en: 'Novi Sad: mutual aid for Alta bank clients',
			sr: 'Novi Sad: uzajamna pomoć klijentima Alta banke',
		},
		what: {
			ru: 'Собирают и передают продукты, детское питание, корм и бытовую химию. Деньги не собирают. Районы сбора: Ротквария и Центр, Петра Драпшина. Контакты организаторов, карты и список заведений, которым нужна поддержка, — в посте. За организаторов ручается канал «Гражданство Сербии».',
			en: 'Collection and hand-over of food, baby food, pet food and household items; no money is collected. Collection areas: Rotkvarija and the Centre, Petra Drapšina. The organisers’ contacts, maps and the list of venues that need support are in the post itself; the “Гражданство Сербии” channel vouches for the organisers.',
			sr: 'Prikupljanje i predaja hrane, hrane za bebe, hrane za životinje i kućne hemije; novac se ne prikuplja. Rejoni prikupljanja: Rotkvarija i Centar, Petra Drapšina. Kontakti organizatora, mape i spisak lokala kojima treba podrška nalaze se u samoj objavi; kanal „Гражданство Сербии“ jemči za organizatore.',
		},
		kind: 'unverified',
		url: 'https://t.me/Altadef50k/2225',
		label: 't.me/Altadef50k/2225',
	},
	{
		group: 'help',
		title: {
			ru: 'Таблица сербских инициатив в поддержку русских бизнесов',
			en: 'Table of Serbian initiatives supporting Russian-run businesses',
			sr: 'Tabela srpskih inicijativa za podršku ruskim biznisima',
		},
		what: {
			ru: 'Google-таблица бизнесов, которым нужна поддержка. В посте сказано: нужно проверять, все ли эти бизнесы действительно были связаны с ALTA.',
			en: 'A Google Sheet of businesses that need support. The post notes that you should check whether every business was actually tied to ALTA.',
			sr: 'Google tabela biznisa kojima je potrebna podrška. U objavi je naglašeno da treba proveriti da li su svi biznisi zaista bili vezani za ALTA banku.',
		},
		kind: 'unverified',
		url: 'https://docs.google.com/spreadsheets/d/1IBRo4Frwh6ph5q1Bykk8JeNIzJwntW5JVyS1YGQXJCE/edit?gid=0',
		label: 'Google Sheets',
	},
	{
		group: 'official',
		title: {
			ru: 'Нацбанк: Сектор защиты пользователей финансовых услуг',
			en: 'National Bank: Financial Consumer Protection Department',
			sr: 'NBS: Sektor za zaštitu korisnika finansijskih usluga',
		},
		what: {
			ru: 'Сюда подают жалобу на банк. Почта сектора: zastita.korisnika@nbs.rs; бесплатный Инфо-центр Нацбанка: 0800 111 110 (в рабочие дни с 9 до 17).',
			en: 'Complaints about a bank go here. The department’s email: zastita.korisnika@nbs.rs; the National Bank’s free Info Centre: 0800 111 110 (working days, 9:00–17:00).',
			sr: 'Ovde se podnosi pritužba na banku. E-pošta sektora: zastita.korisnika@nbs.rs; besplatan Info-centar NBS: 0800 111 110 (radnim danima od 9 do 17 časova).',
		},
		kind: 'official',
		url: 'https://www.nbs.rs/sr/ciljevi-i-funkcije/zastita-korisnika/',
		label: 'nbs.rs',
		extra: { url: 'https://www.nbs.rs/sr/ciljevi-i-funkcije/zastita-korisnika/prigovor/', label: { ru: 'Подать жалобу', en: 'File a complaint', sr: 'Podnesi pritužbu' } },
	},
	{
		group: 'official',
		title: { ru: 'Ассоциация банков Сербии', en: 'Association of Serbian Banks', sr: 'Udruženje banaka Srbije' },
		what: {
			ru: 'Объединение всех банков, которые работают в Сербии. На сайте есть список банков с адресами и телефонами и контакты самой ассоциации: usb@ubs-asb.com, +381 11 30 20 760. В чате вкладчиков советуют писать сюда, если другие банки отказывают в открытии счёта.',
			en: 'The association of all banks operating in Serbia. Its site lists every bank with its address and phone number, plus the association’s own contacts: usb@ubs-asb.com, +381 11 30 20 760. Depositors in the chat suggest writing here if other banks refuse to open an account for you.',
			sr: 'Udruženje svih banaka koje posluju u Srbiji. Na sajtu su spisak banaka sa adresama i telefonima i kontakti samog udruženja: usb@ubs-asb.com, +381 11 30 20 760. Štediše u četu savetuju da se ovde obratite ako vam druge banke odbiju da otvore račun.',
		},
		kind: 'official',
		url: 'https://www.ubs-asb.com/en',
		label: 'ubs-asb.com',
		extra: { url: 'https://www.ubs-asb.com/en/about-us/asb-members', label: { ru: 'Список банков', en: 'List of banks', sr: 'Spisak banaka' } },
	},
	{
		group: 'tools',
		title: { ru: 'Опыт вкладчиков: где открывают счета', en: 'Depositors’ experience: where accounts get opened (in Russian)', sr: 'Iskustva deponenata: gde se otvaraju računi (na ruskom)' },
		what: {
			ru: 'В каких банках вкладчикам удалось открыть счёт: личный, ИП или бизнес.',
			en: 'At which banks depositors managed to open a personal account and a sole-trader or business account.',
			sr: 'U kojim bankama su štediše uspele da otvore lični račun i račun preduzetnika ili poslovni račun.',
		},
		kind: 'unverified',
		url: '/account/stats',
		label: '/account/stats',
	},
	{
		group: 'tools',
		title: { ru: 'Поделиться своим опытом', en: 'Share your experience', sr: 'Podelite svoje iskustvo' },
		what: {
			ru: 'Анонимная форма: в каком банке получилось открыть счёт.',
			en: 'An anonymous form: at which bank you managed to open an account.',
			sr: 'Anonimni obrazac: u kojoj banci ste uspeli da otvorite račun.',
		},
		kind: 'unverified',
		url: '/account',
		label: '/account',
	},
];
