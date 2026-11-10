// Пријава потраживања физичког лица — описание для DocEditor. Должник и дело вписаны по решению суда
// 10 Ст 275/2026, ПИБ — по списку Управы за јавни дуг; всё правится.
import regularUrl from '../../assets/fonts/LiberationSerif-Regular-sub.ttf?url';
import boldUrl from '../../assets/fonts/LiberationSerif-Bold-sub.ttf?url';
import type { DocSpec } from '../../lib/doc-editor/spec';

export const prijava = {
	id: 'prijava',
	anchor: 'fill-in',
	text: 'prijava',
	fileName: 'prijava-potrazivanja.pdf',
	fonts: { regular: regularUrl, bold: boldUrl },
	groups: [
		{
			key: 'creditor',
			fields: [
				{ name: 'name', sr: 'име и презиме' },
				{ name: 'address', sr: 'адреса' },
				{ name: 'jmbg', sr: 'ЈМБГ' },
				{ name: 'phone', sr: 'телефон' },
				{ name: 'email', sr: 'мејл' },
				{ name: 'account', sr: 'рачун бр.' },
				{ name: 'bank', sr: 'назив банке' },
				{ name: 'bankSeat', sr: 'седиште банке' },
			],
		},
		{
			key: 'claim',
			fields: [
				{ name: 'amount', sr: 'укупан износ' },
				{ name: 'basis', sr: 'по основу', type: 'lines' },
				{ name: 'evidence', sr: 'докази', type: 'lines' },
			],
		},
		{
			key: 'sign',
			fields: [
				{ name: 'place', sr: 'У', value: 'Београду' },
				{ name: 'date', sr: 'дана' },
			],
		},
		{
			key: 'case',
			fields: [
				{ name: 'caseNo', sr: 'Ст.', value: '275/2026' },
				{ name: 'decisionDate', sr: 'Решењем од', value: '03.11.2026.' },
				{ name: 'gazetteNo', sr: '„Службени гласник” бр.' },
				{ name: 'gazetteDate', sr: 'од' },
				{ name: 'days', sr: 'у року од … дана', value: '90' },
				{ name: 'debtor', sr: 'стечајни дужник', value: 'ALTA BANKA AD BEOGRAD – U STEČAJU' },
				{ name: 'debtorSeat', sr: 'из', value: 'Београда' },
				{ name: 'debtorRep', sr: 'ког заступа', value: 'Агенција за осигурање депозита, стечајни управник' },
				{ name: 'debtorMb', sr: 'матични број', value: '07074433' },
				{ name: 'debtorPib', sr: 'ПИБ', value: '100001829' },
			],
		},
	],
} satisfies DocSpec;
