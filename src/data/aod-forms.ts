// Бланки AOD для вкладчиков ALTA (04.11.2026). AOD выложил их только в Word, поэтому у каждого
// есть наша PDF-копия для просмотра на сайте и копия Word-файла (байт в байт как у AOD).
import type { Lang } from '../i18n';

type Text = Record<Lang, string>;

export type FormKey = 'prijava' | 'fizicka' | 'pravna';

export type AodForm = {
	/** Название по-сербски, как в самом бланке (кириллица). */
	original: string;
	title: Text;
	/** Для чего бланк и кто его подаёт — одна строка. */
	purpose: Text;
	fields: Record<Lang, string[]>;
	/** Word-файл на сайте AOD. */
	sourceUrl: string;
	/** Имя без расширения в public/docs (PDF и Word) и public/img/forms (превью). */
	file: string;
	word: 'doc' | 'docx';
	pages: number;
	/** Высота превью первой страницы при ширине 360 (A4 и Letter различаются). */
	thumbHeight: number;
};

export const AOD_FORMS_PAGE = 'https://www.aod.rs/clan/altabanka/obrasci_altabanka';
const UPLOADS = 'https://www.aod.rs/uploads/dokumenti/altabanka';

export const AOD_FORMS: Record<FormKey, AodForm> = {
	prijava: {
		original: 'Образац пријаве потраживања',
		title: {
			ru: 'Образец требования в суд',
			en: 'Claim template for the court',
			sr: 'Obrazac prijave potraživanja',
		},
		purpose: {
			ru: 'Требование сверх 50 000 € в Хозяйственный суд Белграда. Подаёт каждый вкладчик сам — физлицо или фирма.',
			en: 'The claim above €50,000 to the Commercial Court in Belgrade. Each depositor files it, individual or company.',
			sr: 'Prijava potraživanja iznad 50.000 € Privrednom sudu u Beogradu. Podnosi je svaki deponent, fizičko ili pravno lice.',
		},
		fields: {
			ru: [
				'номер дела (Ст. ___/___);',
				'кредитор: для физлица — имя и фамилия, адрес, JMBG, номер счёта и банк, где он открыт; для фирмы — полное название, место нахождения, представитель, матичный номер, ПИБ, счёт и банк;',
				'должник: название банка, место нахождения, представитель, матичный номер, ПИБ;',
				'суд, номер и дата решения об открытии банкротства, номер и дата «Службени гласник» с объявлением, срок подачи в днях;',
				'общая сумма требования на день открытия банкротства и на чём оно основано (пункты списком);',
				'список приложенных доказательств;',
				'просьба к суду признать требование («утврди потраживање»): кредитор, адрес, матичный номер, ПИБ, счёт и банк, сумма;',
				'место, дата и подпись.',
				'инструкция AOD от 10.11.2026 просит ещё: телефон и e-mail, основной долг и проценты отдельно, обязательно копии доказательств.',
			],
			en: [
				'the case number (Ст. ___/___);',
				'the creditor: for an individual, full name, address, JMBG, account number and the bank holding it; for a company, registered name, seat, representative, registration number, PIB, account and bank;',
				'the debtor: the bank’s name, seat, representative, registration number, PIB;',
				'the court, number and date of the decision opening bankruptcy, number and date of the Official Gazette with the notice, the filing deadline in days;',
				'the total claim on the day bankruptcy opened and what it is based on (listed points);',
				'the list of attached evidence;',
				'the request that the court recognise the claim (“утврди потраживање”): creditor, address, registration number, PIB, account and bank, amount;',
				'place, date and signature.',
				'AOD\'s instructions of 10.11.2026 also ask for: phone and email, principal and interest separately, and copies of the evidence (mandatory).',
			],
			sr: [
				'broj predmeta (St. ___/___);',
				'stečajni poverilac: za fizičko lice ime i prezime, adresa, JMBG, broj računa i banka; za pravno lice puno poslovno ime, sedište, zastupnik, matični broj, PIB, račun i banka;',
				'stečajni dužnik: naziv banke, sedište, zastupnik, matični broj, PIB;',
				'sud, broj i datum rešenja o otvaranju stečaja, broj i datum „Službenog glasnika“ sa oglasom, rok za prijavu u danima;',
				'ukupan iznos potraživanja sa stanjem na dan otvaranja stečaja i osnov (po tačkama);',
				'spisak dokaza koji se prilažu;',
				'predlog da sud „utvrdi potraživanje“: poverilac, adresa, matični broj, PIB, račun i banka, iznos;',
				'mesto, datum i potpis.',
				'uputstvo AOD od 10.11.2026 traži još: telefon i mejl, posebno glavnicu i kamatu, obavezno kopije dokaza.',
			],
		},
		sourceUrl: `${UPLOADS}/potrazivanja.docx`,
		file: 'aod-2026-11-04-obrazac-prijave-potrazivanja',
		word: 'docx',
		pages: 2,
		thumbHeight: 510,
	},
	fizicka: {
		original: 'Образац овлашћења за преузимање осигураног износа – физичка лица',
		title: {
			ru: 'Доверенность для физлиц',
			en: 'Authorisation for individuals',
			sr: 'Ovlašćenje za fizička lica',
		},
		purpose: {
			ru: 'Чтобы другой человек получил за вас страховку до 50 000 € в Banka Poštanska štedionica. Доверенность заверяет нотариус, дата — не раньше дня отзыва лицензии (30.10.2026); доверенности, выданные до отзыва лицензии, использовать нельзя.',
			en: 'Lets another person collect your insured amount up to €50,000 at Banka Poštanska štedionica. It is certified by a notary and dated no earlier than the day the licence was revoked (30.10.2026); authorisations issued before the revocation cannot be used.',
			sr: 'Da drugo lice umesto vas preuzme osigurani iznos do 50.000 € u Banci Poštanska štedionica. Overava ga javni beležnik, sa datumom ne starijim od dana oduzimanja dozvole (30.10.2026); ovlašćenja izdata pre oduzimanja dozvole ne mogu se koristiti.',
		},
		fields: {
			ru: [
				'место и дата;',
				'кому даёте доверенность: имя и фамилия, JMBG, адрес, номер личной карты и кем она выдана;',
				'банк-плательщик и банк в банкротстве;',
				'внизу — кто даёт доверенность: имя, JMBG, адрес, номер, дата и орган выдачи личной карты, подпись;',
				'подпись заверяет нотариус (јавни бележник), дата — не раньше 30.10.2026.',
			],
			en: [
				'place and date;',
				'the person you authorise: full name, JMBG, address, ID card number and issuing authority;',
				'the paying bank and the bank in bankruptcy;',
				'at the bottom, the person giving the authorisation: name, JMBG, address, ID card number, date and issuing authority, signature;',
				'certified by a notary (јавни бележник) on or after 30.10.2026.',
			],
			sr: [
				'mesto i datum;',
				'koga ovlašćujete: ime i prezime, JMBG, adresa, broj lične karte i ko ju je izdao;',
				'banka isplatilac i banka u stečaju;',
				'na dnu davalac ovlašćenja: ime, JMBG, adresa, broj, datum i izdavalac lične karte, potpis;',
				'overava javni beležnik, sa datumom ne starijim od 30.10.2026.',
			],
		},
		sourceUrl: `${UPLOADS}/fizicka_lica.doc`,
		file: 'aod-2026-11-04-ovlascenje-fizicka-lica',
		word: 'doc',
		pages: 1,
		thumbHeight: 466,
	},
	pravna: {
		original: 'Образац овлашћења за преузимање осигураног износа – правна лица',
		title: {
			ru: 'Доверенность для фирм и ИП',
			en: 'Authorisation for companies and sole traders',
			sr: 'Ovlašćenje za pravna lica i preduzetnike',
		},
		purpose: {
			ru: 'Чтобы страховку фирмы или ИП получил не представитель из реестра, а доверенный человек.',
			en: 'Lets an authorised person, not the registered representative, collect the insured amount of a company or sole trader.',
			sr: 'Da osigurani iznos pravnog lica ili preduzetnika preuzme ovlašćeno lice umesto zastupnika iz registra.',
		},
		fields: {
			ru: [
				'на бланке фирмы: название, адрес, ПИБ, матичный номер, номер регистрации в APR (или в другом реестре);',
				'кому: имя и фамилия, должность, адрес, личная карта, JMBG;',
				'сумма в динарах и в евро; банк-плательщик, куда доверенный подаёт платёжное поручение;',
				'подпись представителя и печать;',
				'приложение — выписка из реестра не старше 3 месяцев на день подачи в банк-плательщик.',
			],
			en: [
				'on company letterhead: name, address, PIB, registration number, APR registration number (or another register);',
				'the person authorised: name, position, address, ID card, JMBG;',
				'the amount in dinars and in euros; the paying bank where the transfer order is submitted;',
				'the representative’s signature and stamp;',
				'attached: a register extract no older than 3 months on the day it is submitted to the paying bank.',
			],
			sr: [
				'na memorandumu firme: naziv, adresa, PIB, matični broj, broj registracije u APR (ili drugom registru);',
				'koga ovlašćujete: ime i prezime, funkcija, adresa, lična karta, JMBG;',
				'iznos u dinarima i u evrima; banka isplatilac kojoj se podnosi nalog za prenos;',
				'potpis zastupnika i pečat;',
				'prilog: izvod iz registra ne stariji od 3 meseca na dan podnošenja banci isplatiocu.',
			],
		},
		sourceUrl: `${UPLOADS}/pravna_lica.doc`,
		file: 'aod-2026-11-04-ovlascenje-pravna-lica',
		word: 'doc',
		pages: 1,
		thumbHeight: 466,
	},
};

export const FORM_KEYS = Object.keys(AOD_FORMS) as FormKey[];
