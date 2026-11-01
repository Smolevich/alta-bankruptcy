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
			ru: 'Для тех, у кого меньше 50 000 €: отдельная ветка про ALTA в чате «гайда Олега».',
			en: 'For people with less than €50,000: a separate ALTA thread in the “Oleg’s guide” chat.',
			sr: 'Za one sa manje od 50.000 €: posebna tema o ALTA banci u četu „Olegovog vodiča“.',
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
			ru: 'Принимают и раздают продукты, детское питание, корм для животных, бытовую химию. Белград, Dalmatinska 84L (вход со стороны Ivankovačka), с 02.11 по 07.11.2026: пн и вт 11:00–00:00, ср 11:00–18:00, чт и пт 11:00–17:00, сб 11:00–15:00. Волонтёрам пишите в бот.',
			en: 'They accept and give out food, baby food, pet food and household items. Belgrade, Dalmatinska 84L (entrance from Ivankovačka), 02.11 to 07.11.2026: Mon and Tue 11:00–00:00, Wed 11:00–18:00, Thu and Fri 11:00–17:00, Sat 11:00–15:00. Volunteers should write to the bot.',
			sr: 'Primaju i dele hranu, hranu za bebe, hranu za životinje i kućnu hemiju. Beograd, Dalmatinska 84L (ulaz sa strane Ivankovačke), od 02.11. do 07.11.2026: pon i uto 11:00–00:00, sre 11:00–18:00, čet i pet 11:00–17:00, sub 11:00–15:00. Volonteri pišu botu.',
		},
		kind: 'unverified',
		url: 'https://t.me/dcloza',
		label: 't.me/dcloza',
		extra: { url: 'https://maps.app.goo.gl/krKnvr2Qv7YLFV2b7', label: { ru: 'Карта', en: 'Map', sr: 'Mapa' } },
	},
	{
		group: 'help',
		title: {
			ru: 'Нови-Сад: взаимопомощь для клиентов Алта-банка',
			en: 'Novi Sad: mutual aid for Alta bank clients',
			sr: 'Novi Sad: uzajamna pomoć klijentima Alta banke',
		},
		what: {
			ru: 'Сбор и передача продуктов, детского питания, корма и бытовой химии; деньги не собирают. Районы сбора: Ротквария и Центр, Петра Драпшина. Контакты организаторов, карты и список заведений, которым нужна поддержка, указаны в самом посте; канал «Гражданство Сербии» ручается за организаторов.',
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
			ru: 'Google-таблица: бизнесы, которым нужна поддержка. В посте оговорено: нужно проверять, все ли бизнесы были связаны с ALTA.',
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
			ru: 'В ассоциацию входят основные банки Сербии; вопросы об открытии счётов в других банках можно решать через неё (совет из чата). Сайт мы не смогли открыть автоматической проверкой.',
			en: 'The association includes the main banks in Serbia; questions about opening accounts at other banks can go through it (advice from the chat). We could not open the site in an automated check.',
			sr: 'U udruženju su glavne banke u Srbiji; pitanja o otvaranju računa u drugim bankama mogu se uputiti preko njega (savet iz četa). Sajt nismo uspeli da otvorimo automatskom proverom.',
		},
		kind: 'unverified',
		url: 'https://www.ubs-asb.com/en',
		label: 'ubs-asb.com',
	},
	{
		group: 'tools',
		title: { ru: 'Где открыть счёт для выплаты: статистика', en: 'Where to open an account for the payout: statistics', sr: 'Gde otvoriti račun za isplatu: statistika' },
		what: {
			ru: 'В каких банках вкладчики смогли открыть личный счёт и счёт ИП или бизнес-счёт.',
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
