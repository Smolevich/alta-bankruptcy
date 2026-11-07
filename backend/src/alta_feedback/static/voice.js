// Голосовой ввод в комментарий через распознавание речи браузера (без нашего сервера).
// Нет SpeechRecognition — кнопка остаётся скрытой, остаётся микрофон клавиатуры телефона.
(() => {
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;

  const RU = {
    start: "Голосом", stop: "Стоп",
    denied: "Нет доступа к микрофону — разрешите его в браузере.",
    silence: "Ничего не услышали, попробуйте ещё раз.",
    offline: "Распознавание недоступно без интернета.",
    failed: "Не получилось распознать, можно напечатать.",
  };

  // Карта отделений создаёт поле в попапе на лету и на трёх языках, поэтому привязка — функцией.
  const attach = ({ button, label, status, box, lang = "ru-RU", texts = RU }) => {
    if (!Recognition || !button || !box) return false;
    const limit = Number(box.getAttribute("maxlength")) || 1000;
    let recognition = null;
    let before = "";

    const setListening = (on) => {
      button.classList.toggle("on", on);
      if (label) label.textContent = on ? texts.stop : texts.start;
    };

    const errorText = (code) => {
      if (code === "not-allowed" || code === "service-not-allowed") return texts.denied;
      if (code === "no-speech") return texts.silence;
      if (code === "network") return texts.offline;
      return texts.failed;
    };

    const start = () => {
      recognition = new Recognition();
      recognition.lang = lang;
      recognition.interimResults = true;
      recognition.continuous = true;
      before = box.value.trim();
      recognition.onresult = (event) => {
        let heard = "";
        for (let i = 0; i < event.results.length; i += 1) heard += event.results[i][0].transcript;
        box.value = ((before ? before + " " : "") + heard.trim()).slice(0, limit);
      };
      recognition.onerror = (event) => { if (status) status.textContent = errorText(event.error); };
      recognition.onend = () => { recognition = null; setListening(false); };
      if (status) status.textContent = "";
      recognition.start();
      setListening(true);
    };

    button.hidden = false;
    button.addEventListener("click", () => {
      if (recognition) recognition.stop();
      else start();
    });
    return true;
  };

  window.altaVoice = { attach, supported: Boolean(Recognition) };

  const attached = attach({
    button: document.getElementById("mic"),
    label: document.getElementById("mic-label"),
    status: document.getElementById("mic-status"),
    box: document.getElementById("comment"),
  });
  const note = document.getElementById("mic-note");
  if (attached && note) note.hidden = false;
})();
