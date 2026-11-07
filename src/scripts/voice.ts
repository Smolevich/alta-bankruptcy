// Диктовка в поле через Web Speech API — тот же код, что backend/src/alta_feedback/static/voice.js
// (форма «Где открыли счёт»). Нет SpeechRecognition (Telegram-браузер, Firefox) — кнопка не появляется.
export type VoiceTexts = { start: string; stop: string; denied: string; silence: string; offline: string; failed: string };

type Options = { button: HTMLButtonElement; label?: HTMLElement | null; status?: HTMLElement | null; box: HTMLInputElement | HTMLTextAreaElement; lang: string; texts: VoiceTexts; onStart?: () => void };

const Recognition = typeof window === 'undefined' ? undefined : (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

export const voiceSupported = Boolean(Recognition);

export function attachVoice({ button, label, status, box, lang, texts, onStart }: Options): boolean {
	if (!Recognition) return false;
	const limit = Number(box.getAttribute('maxlength')) || 1000;
	let recognition: any = null;
	let before = '';

	const setListening = (on: boolean) => {
		button.classList.toggle('on', on);
		if (label) label.textContent = on ? texts.stop : texts.start;
	};
	const errorText = (code: string) => {
		if (code === 'not-allowed' || code === 'service-not-allowed') return texts.denied;
		if (code === 'no-speech') return texts.silence;
		if (code === 'network') return texts.offline;
		return texts.failed;
	};
	const start = () => {
		recognition = new Recognition();
		recognition.lang = lang;
		recognition.interimResults = true;
		recognition.continuous = true;
		before = box.value.trim();
		recognition.onresult = (event: any) => {
			let heard = '';
			for (let i = 0; i < event.results.length; i += 1) heard += event.results[i][0].transcript;
			box.value = ((before ? before + ' ' : '') + heard.trim()).slice(0, limit);
			box.dispatchEvent(new Event('input', { bubbles: true }));
		};
		recognition.onerror = (event: any) => { if (status) status.textContent = errorText(event.error); };
		recognition.onend = () => { recognition = null; setListening(false); };
		if (status) status.textContent = '';
		recognition.start();
		setListening(true);
		onStart?.();
	};

	button.hidden = false;
	button.addEventListener('click', () => {
		if (recognition) recognition.stop();
		else start();
	});
	return true;
}
