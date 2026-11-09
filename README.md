# Nauka SW – aplikacja do nauki (PWA)

Statyczna strona: `index.html`, `style.css`, `app.js`, `manifest.json`, `service-worker.js`, `ikony/`,
dane `pytania_sw.json` i skrypty `skrypt_unitarna.md`, `skrypt_psycholog.md` (zakładka „Czytaj”).

## Narzędzia (wymagają Node.js)

```
node narzedzia/sprawdz.js        # sprawdza pytania_sw.json (id, answer, luki, talie)
node narzedzia/serwer.js         # podgląd lokalny: http://localhost:8080
node narzedzia/ikony.js          # ponowne wygenerowanie ikon
node narzedzia/docx2md.js <rozpakowany_docx> <wynik.md>   # konwersja skryptu z Worda
```

## Po zmianie treści

1. Popraw `pytania_sw.json` i uruchom `node narzedzia/sprawdz.js`.
2. W `service-worker.js` zwiększ `CACHE = 'nauka-sw-v1'` → `v2` (inaczej telefon może pokazywać starą wersję).
3. Wgraj zmienione pliki na GitHub Pages. Telefon pobierze nową wersję przy drugim otwarciu aplikacji.

## Postęp

Pudełka Leitnera, historia odpowiedzi i wyniki egzaminów są zapisywane tylko w przeglądarce telefonu
(localStorage). Wyczyszczenie danych przeglądarki usuwa postęp.
