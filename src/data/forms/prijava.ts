// Claim form of a natural person ("Пријава потраживања физичког лица"): description for DocEditor. The debtor and the case are filled in per the court decision
// 10 Ст 275/2026, the PIB per the Public Debt Administration list; everything is editable.
import regularUrl from '../../assets/fonts/LiberationSerif-Regular-sub.ttf?url';
import boldUrl from '../../assets/fonts/LiberationSerif-Bold-sub.ttf?url';
import type { DocSpec } from '../../lib/doc-editor/spec';

export const prijava = {
	id: 'prijava',
	anchor: 'fill-in',
	text: 'prijava',
	fileName: 'prijava-potrazivanja.pdf',
	fonts: { regular: regularUrl, bold: boldUrl },
	blocks: true,
	groups: [
		{
			key: 'creditor',
			fields: [
				{ name: 'name', sr: 'име и презиме' },
				{ name: 'address', sr: 'адреса', type: 'lines' },
				{ name: 'jmbg', sr: 'ЈМБГ' },
				{ name: 'passport', sr: 'пасош' },
				{ name: 'phone', sr: 'телефон' },
				{ name: 'email', sr: 'мејл' },
				{ name: 'account', sr: 'рачун бр.', type: 'lines' },
				{ name: 'bank', sr: 'назив банке', type: 'lines' },
				{ name: 'bankSeat', sr: 'седиште банке' },
				{ name: 'deliveryAddress', sr: 'адреса за достављање' },
				{ name: 'deliveryEmail', sr: 'адреса електронске поште' },
			],
		},
		{
			key: 'claim',
			fields: [
				{ name: 'amount', sr: 'укупан износ', type: 'lines' },
				{ name: 'contracts', sr: 'уговори', type: 'lines' },
				{ name: 'funds', sr: 'средства на дан отварања', type: 'lines' },
				{ name: 'received', sr: 'примљено по осигурању', type: 'lines' },
				{ name: 'remaining', sr: 'остатак потраживања', type: 'lines' },
				{ name: 'rate', sr: 'курс НБС', value: '117,5698' },
				{ name: 'basis', sr: 'по основу', type: 'lines' },
				{
					name: 'evidence',
					sr: 'докази',
					type: 'lines',
					value: 'Преглед података о депозитима и нереализованим чековима\nУговори о текућим рачунима и платним картицама\nКопија личног документа',
				},
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
				{ name: 'gazetteNo', sr: '„Службени гласник” бр.', value: '109' },
				{ name: 'gazetteDate', sr: 'од', value: '06.11.2026.' },
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
