/* „Pierwsza służba” – treść kampanii.
   Fikcja fabularna, prawdziwe przepisy. Zakład Karny w Bielinach i wszystkie postacie są zmyślone.
   Składnia scen – patrz gra.js (play()). */
var GRA = window.GRA = {
  ver: 1,
  chars: {
    bielik: { n: 'Chorąży Bielik' },
    wrobel: { n: 'Szer. Wróbel', img: 'p-wrobel' },
    halinka: { n: 'Pani Halinka z kadr', img: 'p-halinka' },
    dyrektor: { n: 'Dyrektor Czapla', img: 'p-dyrektor' },
    kierownik: { n: 'Kierownik działu ochrony Jastrząb', img: 'p-kierownik' },
    sroka: { n: 'Wychowawczyni Sroka', img: 'p-sroka' },
    lekarka: { n: 'Dr Bocianowska', img: 'p-lekarka' },
    instruktor: { n: 'Instruktor Sokół', img: 'p-instruktor' },
    wykladowca: { n: 'Wykładowca Pelikan', img: 'p-wykladowca' },
    magazynier: { n: 'Magazynier Dzięcioł', img: 'p-magazynier' },
    sedzia: { n: 'Sędzia Łabędzka', img: 'p-sedzia' },
    adwokat: { n: 'Mecenas Papuga', img: 'p-adwokat' },
    doktor: { n: '„Doktor” – osadzony', img: 'p-doktor' },
    siwy: { n: '„Siwy” – osadzony', img: 'p-siwy' },
    mlody: { n: '„Młody” – tymczasowo aresztowany', img: 'p-mlody' },
    ty: { n: 'Ty' },
  },
  bgAlt: {
    kadry: 'Biuro kadr', plac: 'Plac apelowy', wyklad: 'Sala wykładowa', mata: 'Sala z matą', strzelnica: 'Strzelnica',
    brama: 'Brama zakładu karnego', wiezyczka: 'Widok z wieżyczki', korytarz: 'Korytarz oddziału', cela: 'Cela mieszkalna',
    widzenia: 'Sala widzeń', konwoj: 'Pojazd konwojowy pod szpitalem', dyzurka: 'Dyżurka z monitoringiem', przyjecia: 'Przyjęcia i depozyt',
    sklep: 'Osiedlowy sklep wieczorem', gabinet: 'Gabinet psychologa', sad: 'Sala posiedzeń', krata: 'Widok zza krat', final: 'Uroczystość na placu',
  },
  pins: {
    brama: { n: 'Brama', x: 46, y: 82 },
    wartownia: { n: 'Wartownia', x: 61, y: 77 },
    wiezyczka: { n: 'Wieżyczka', x: 88, y: 10 },
    pawilonA: { n: 'Pawilon A', x: 24, y: 30 },
    pawilonB: { n: 'Pawilon B', x: 75, y: 31 },
    administracja: { n: 'Administracja', x: 50, y: 17 },
    centralny: { n: 'Budynek centralny', x: 50, y: 59 },
    widzenia: { n: 'Widzenia', x: 15, y: 67 },
    parking: { n: 'Parking konwojów', x: 85, y: 69 },
  },
  acts: [
    { n: 'I', t: 'Przyjęcie', s: 'Kadry, sito, ślubowanie', chapters: ['list', 'sito', 'slubowanie'] },
    { n: 'II', t: 'Wstępniak', s: 'Apel, wykłady, mata, strzelnica', chapters: ['apel', 'wyklad', 'mata', 'strzelnica', 'egzamin1'] },
    { n: 'III', t: 'Stanowiska', s: 'Brama, wieżyczka, oddział, widzenia, konwój', chapters: ['brama', 'wiezyczka', 'oddzial', 'rewizja', 'widzenia', 'konwoj', 'dyzurka', 'przyjecia'] },
    { n: 'IV', t: 'Życie codzienne', s: 'Grafik, pasek, po godzinach, Fejsbuk', chapters: ['grafik', 'pasek', 'pogodzinach', 'znajomy', 'fejsbuk'] },
    { n: 'V', t: 'Propozycja', s: '„Doktor” ma plan', chapters: ['propozycja'] },
    { n: 'VI', t: 'Awans', s: 'Raport, nowe obowiązki, egzamin', chapters: ['raport', 'gabinet', 'kryzys', 'opinia', 'dowodca', 'alarm', 'notatka', 'final'] },
  ],
  order: ['list', 'sito', 'slubowanie', 'apel', 'wyklad', 'mata', 'strzelnica', 'egzamin1', 'brama', 'wiezyczka', 'oddzial', 'rewizja',
    'widzenia', 'konwoj', 'dyzurka', 'przyjecia', 'grafik', 'pasek', 'pogodzinach', 'znajomy', 'fejsbuk', 'propozycja', 'raport',
    'gabinet', 'kryzys', 'opinia', 'dowodca', 'alarm', 'notatka', 'final'],

  /* Przestępstwa – kary według aktualnego Kodeksu karnego (Dz.U. 2025 poz. 383). */
  crimes: {
    '228': { art: 'art. 228 § 1 kk', n: 'przyjęcie korzyści majątkowej w związku z pełnieniem funkcji publicznej', kara: 'od 6 miesięcy do 8 lat pozbawienia wolności' },
    '228_3': { art: 'art. 228 § 3 kk', n: 'przyjęcie korzyści majątkowej za zachowanie stanowiące naruszenie przepisów prawa', kara: 'od roku do 10 lat pozbawienia wolności' },
    '231_1': { art: 'art. 231 § 1 kk', n: 'przekroczenie uprawnień lub niedopełnienie obowiązków na szkodę interesu publicznego lub prywatnego', kara: 'do 3 lat pozbawienia wolności' },
    '231_3': { art: 'art. 231 § 3 kk', n: 'nieumyślne niedopełnienie obowiązków, które wyrządziło istotną szkodę', kara: 'grzywna, ograniczenie wolności albo pozbawienie wolności do 2 lat', nieumyslne: true },
    '247': { art: 'art. 247 § 1 kk', n: 'znęcanie się nad osobą prawnie pozbawioną wolności', kara: 'od 3 miesięcy do 5 lat pozbawienia wolności' },
    '247_3': { art: 'art. 247 § 3 kk', n: 'dopuszczenie – wbrew obowiązkowi – do znęcania się nad osobą pozbawioną wolności', kara: 'jak za samo znęcanie: od 3 miesięcy do 5 lat pozbawienia wolności' },
    '266': { art: 'art. 266 § 2 kk', n: 'ujawnienie przez funkcjonariusza informacji uzyskanej w związku z czynnościami służbowymi', kara: 'do 3 lat pozbawienia wolności' },
    '271': { art: 'art. 271 § 1 kk', n: 'poświadczenie nieprawdy w dokumencie', kara: 'od 3 miesięcy do 5 lat pozbawienia wolności' },
    '178a': { art: 'art. 178a § 1 kk', n: 'prowadzenie pojazdu w stanie nietrzeźwości', kara: 'do 3 lat pozbawienia wolności, obowiązkowy zakaz prowadzenia pojazdów i świadczenie pieniężne' },
    'falsz': { art: 'art. 234 i 238 kk (po stronie „Doktora”)', n: 'pobicie osadzonego – fałszywe oskarżenie', kara: '–' },
  },

  /* Ścieżka „Zawieszony”. A – prawdziwe przestępstwo, B – fałszywe oskarżenie. */
  zawieszony: {
    A: [
      { t: 'Zatrzymanie', bg: 'brama', lines: [
        ['nar', 'Poranna odprawa. W drzwiach stoją dwaj policjanci i prokurator z teczką. Cała zmiana nagle bardzo uważnie ogląda swoje buty.'],
        ['kierownik', 'Funkcjonariusz {imie}. Proszę zdać broń, klucze i legitymację. Pójdzie {pan|pani} z panami.'],
        ['wrobel', 'To ja… to ja już nie będę mówił, że się znamy. Dobra? Dobra.'],
      ], info: ['Zarzut', 'Podejrzenie: {czyn} – {art}. Zagrożenie: {kara}.', 'Kodeks karny'] },
      { t: 'Przesłuchanie', bg: 'sad', lines: [
        ['adwokat', 'Mecenas Papuga. Bez komentarza. To znaczy… komentarz będzie, ale ode mnie. Ma {pan|pani} prawo do obrońcy i prawo odmówić wyjaśnień. Proszę z tego mądrze korzystać.'],
      ], c: 'Prokurator przedstawia zarzut. Co robisz?', o: [
        { t: 'Przyznaję się i składam rzetelne wyjaśnienia', r: 'meh', d: [0, 0, 0], b: 'Uczciwie. Przyznanie się i współpraca mogą wpłynąć na wymiar kary – ale samego czynu nie odkręcą.', x: 'Podejrzany może składać wyjaśnienia albo odmówić ich składania bez podawania powodu. Ma też prawo do obrony, w tym do korzystania z pomocy obrońcy.', z: 'art. 6 i art. 175 § 1 kpk' },
        { t: 'Odmawiam składania wyjaśnień do czasu rozmowy z obrońcą', r: 'meh', d: [0, 0, 0], b: 'Rozsądnie. Najpierw adwokat, potem gadanie. Nawet papuga to wie.', x: 'To twoje prawo – odmowa wyjaśnień nie może być traktowana jako dowód winy.', z: 'art. 175 § 1 kpk' },
        { t: 'Mówię, że to wszystko wina Wróbla', r: 'bad', lie: true, d: [-5, 0, -10], b: 'Wróbla przesłuchali w pięć minut, a monitoring zrobił resztę. Twoja wiarygodność przed sądem właśnie spadła do zera – a kolegę straci{łeś|łaś} na zawsze.', x: 'Podejrzany ma prawo do obrony, ale zrzucanie winy na innych szybko wychodzi przy konfrontacji z dowodami i podważa wiarygodność wszystkich jego wyjaśnień. Za fałszywe oskarżenie (art. 234 kk) podejrzany odpowiada wtedy, gdy pomówienie nie służy wyłącznie jego własnej obronie.', z: 'art. 234 kk; uchwała SN z 11.01.2006, I KZP 49/05' },
      ] },
      { t: 'Zawieszenie', bg: 'kadry', lines: [
        ['halinka', 'Decyzja o zawieszeniu w czynnościach służbowych, proszę tu podpisać. I tu. I jeszcze tu, bo pieczątka krzywo wyszła.'],
        ['bielik', 'Siedzisz w domu, pensja o połowę mniejsza, a koledzy na zmianie pytają, czy to prawda. To jest ta część, której nie pokazują w filmach.'],
      ], info: ['Zawieszenie w czynnościach służbowych', 'Obligatoryjne – w razie tymczasowego aresztowania. Fakultatywne – po wszczęciu postępowania karnego o przestępstwo ścigane z oskarżenia publicznego (umyślne albo nieumyślne) lub postępowania dyscyplinarnego, gdy wymaga tego dobro postępowania albo służby. Zawieszenie trwa do 3 miesięcy, w szczególnie uzasadnionych przypadkach – do zakończenia postępowania. Decyduje przełożony właściwy do mianowania. Od najbliższego terminu płatności zawiesza się 50% uposażenia.', 'art. 94–95 ustawy o SW'] },
      { t: 'Rozprawa', bg: 'sad', lines: [
        ['sedzia', 'Sąd zważył, co następuje: oskarżony jako funkcjonariusz publiczny wiedział dokładnie, czego mu nie wolno. I zrobił to mimo wszystko.'],
        ['adwokat', 'Wnoszę o łagodny wymiar kary. Bez dalszego komentarza.'],
      ] },
      { t: 'Wyrok', bg: 'krata', lines: [
        ['sedzia', 'Sąd uznaje oskarżonego za winnego popełnienia czynu z {art}.'],
        ['bielik', 'Skazanie za przestępstwo umyślne kończy służbę z mocy prawa. Nie ma odwołania do „ale ja tylko raz”. Zawieszona połowa pensji też nie wróci.'],
      ], info: ['Co dalej ze służbą?', 'Stosunek służbowy wygasa w razie prawomocnego skazania za przestępstwo umyślne ścigane z oskarżenia publicznego. Zawieszona część uposażenia nie zostanie wypłacona.', 'art. 97 ust. 1 pkt 4 i art. 95 ust. 2 ustawy o SW'] },
    ],
    B: [
      { t: 'Zawiadomienie', bg: 'korytarz', lines: [
        ['nar', 'Tydzień po twojej odmowie „Doktor” składa zawiadomienie: rzekomo pobi{łeś|łaś} go w celi bez świadków. Siniak na przedramieniu ma prawdziwy. Pochodzenie – mniej.'],
        ['kierownik', 'Prokuratura wszczęła postępowanie. Dyrektor zdecydował o zawieszeniu na czas wyjaśnień. Przykro mi, takie są procedury.'],
      ], info: ['Dlaczego zawieszenie, skoro nic nie zrobi{łem|łam}?', 'Zawieszenie fakultatywne nie przesądza o winie. Przełożony może je zastosować po wszczęciu postępowania karnego, jeśli jest to celowe z uwagi na dobro postępowania lub dobro służby. Na czas zawieszenia wstrzymuje się 50% uposażenia.', 'art. 94 ust. 2 i art. 95 ust. 1 ustawy o SW'] },
      { t: 'Przesłuchanie', bg: 'sad', lines: [
        ['adwokat', 'Mecenas Papuga. Proszę mówić prawdę i nic ponad prawdę. Reszta – bez komentarza.'],
      ], c: 'Co wnosisz do sprawy?', o: [
        { if: 'notatka21', t: 'Wskazuję notatkę służbową o propozycji „Doktora” i proszę o zabezpieczenie monitoringu', r: 'ok', d: [3, 0, 0], b: 'Notatka z datą, godziną i treścią rozmowy – dla prokuratora to złoto. Papierologia uratowała ci skórę.', x: 'Udokumentowanie zdarzenia od razu (notatka służbowa, zgłoszenie przełożonemu) i wskazanie dowodów (zapis monitoringu, świadkowie) to najlepsza ochrona przed fałszywym oskarżeniem.', z: 'zasady dokumentowania czynności służbowych' },
        { if: '!notatka21', t: 'Mówię, jak było, choć niczego nie zgłaszał{em|am}', r: 'meh', d: [0, 0, 0], b: 'Prawda się obroni, tylko dłużej to potrwa. Następnym razem pisz notatkę od razu – długopis jest tańszy niż adwokat.' },
        { t: 'Nic nie mówię – i tak mi nie uwierzą', r: 'meh', d: [-2, 0, 0], b: 'Masz do tego prawo. Ale przy fałszywym oskarżeniu milczenie nie pomaga udowodnić, że kłamie on, a nie ty.', z: 'art. 175 § 1 kpk' },
      ] },
      { t: 'Umorzenie', bg: 'kadry', lines: [
        ['nar', 'Nagranie z monitoringu pokazuje korytarz o tej godzinie: ty przy drzwiach celi, „Doktor” w środku, rozmowa trwa 40 sekund. Żadnego kontaktu fizycznego.'],
        ['nar', 'Prokurator umarza postępowanie: czynu nie popełniono. Kropka.'],
        ['bielik', 'Zawieszenie uchylone, wracasz na zmianę. A „Doktor” będzie się tłumaczył z fałszywego zawiadomienia. Sprawiedliwość czasem chodzi wolno, ale ma dobre buty.'],
      ], info: ['A pieniądze?', 'Po uchyleniu zawieszenia funkcjonariusz otrzymuje zawieszoną część uposażenia wraz z podwyżkami – także gdy postępowanie karne prawomocnie umorzono albo zapadło uniewinnienie (nie dotyczy umorzenia z powodu przedawnienia, amnestii i warunkowego umorzenia). Zawiadomienie o niepopełnionym przestępstwie i fałszywe oskarżenie są przestępstwami.', 'art. 95 ust. 2–4 ustawy o SW; art. 234 i 238 kk'] },
    ],
    N: [
      { t: 'Postępowanie', bg: 'kadry', lines: [
        ['nar', 'Prokuratura wszczyna postępowanie w sprawie ucieczki z konwoju. Zostajesz przesłuchan{y|a} w charakterze podejrzanego o nieumyślne niedopełnienie obowiązków.'],
        ['kierownik', 'Dyrektor zawiesił {pana|panią} w czynnościach na czas postępowania. Broń i legitymacja do depozytu.'],
      ], info: ['Zarzut i zawieszenie', 'Podejrzenie: {czyn} – {art}. Zagrożenie: {kara}. Zawieszenie jest tu fakultatywne – możliwe także przy przestępstwie nieumyślnym; na ten czas wstrzymuje się 50% uposażenia.', 'art. 231 § 3 kk; art. 94 ust. 2 i art. 95 ust. 1 ustawy o SW'] },
      { t: 'Przesłuchanie', bg: 'sad', lines: [
        ['adwokat', 'Mecenas Papuga. Proszę pamiętać: ma {pan|pani} prawo do obrońcy i prawo odmówić wyjaśnień. Bez komentarza do mediów.'],
      ], c: 'Co mówisz prokuratorowi?', o: [
        { t: 'Opisuję zgodnie z prawdą, co się stało i co zrobi{łem|łam} po ucieczce', r: 'ok', d: [2, 0, 0], b: 'Dobrze. Natychmiastowy alarm i rzetelny raport działają na twoją korzyść.', x: 'Podejrzany ma prawo składać wyjaśnienia lub odmówić ich składania; ma prawo do obrońcy.', z: 'art. 6 i art. 175 § 1 kpk' },
        { t: 'Odmawiam wyjaśnień do czasu rozmowy z obrońcą', r: 'meh', d: [0, 0, 0], b: 'Twoje prawo. Najpierw mecenas, potem opowieść.', z: 'art. 175 § 1 kpk' },
        { t: 'Twierdzę, że kajdanki zdjął kolega z konwoju', r: 'bad', lie: true, d: [-6, 0, -10], b: 'Monitoring szpitala widział inaczej. Wiarygodność – zero, przyjaźń – też zero.', x: 'Zrzucanie winy na kolegę podważa wiarygodność wszystkich wyjaśnień. Odpowiedzialność za fałszywe oskarżenie grozi, gdy pomówienie nie służy wyłącznie własnej obronie.', z: 'art. 234 kk; uchwała SN I KZP 49/05' },
      ] },
      { t: 'Wyrok', bg: 'sad', lines: [
        ['sedzia', 'Sąd uznaje oskarżonego za winnego nieumyślnego niedopełnienia obowiązków i wymierza karę grzywny.'],
        ['bielik', 'Grzywna to nie koniec służby – stosunek służbowy wygasa przy skazaniu za przestępstwo umyślne albo na bezwzględne pozbawienie wolności. Ale postępowanie dyscyplinarne już na ciebie czeka.'],
      ], info: ['Co dalej?', 'Przewinienie dyscyplinarne podlega karze niezależnie od odpowiedzialności karnej. Przełożony wymierza karę ostrzeżenia o niepełnej przydatności na zajmowanym stanowisku. Ponieważ zosta{łeś|łaś} ukaran{y|a} dyscyplinarnie, zawieszona część uposażenia nie zostanie zwrócona.', 'art. 230 ust. 4, art. 232, art. 95 ust. 2 i art. 97 ust. 1 pkt 3–4 ustawy o SW'] },
    ],
  },

  endings: {
    krata: { t: 'Po drugiej stronie krat', bad: true, bg: 'krata', d: 'Skazanie za przestępstwo umyślne. Stosunek służbowy wygasł z mocy prawa, mundur wrócił do magazynu, a ty przechodzisz przez przyjęcie – tylko z drugiej strony okienka. Znasz procedurę lepiej niż ktokolwiek w celi. Nikogo to nie pociesza.',
      steps: [['Zatrzymanie', 'na służbie, przy kolegach'], ['Zawieszenie', '50% uposażenia wstrzymane'], ['Akt oskarżenia i wyrok', 'skazanie za przestępstwo umyślne'], ['Wygaśnięcie stosunku służbowego', 'art. 97 ust. 1 pkt 4 ustawy o SW']],
      b: 'Mówiłem, że cela ma dwie strony drzwi. Ty wybra{łeś|łaś} tę bez klamki. Wracaj do punktu kontrolnego i spróbuj jak funkcjonariusz, nie jak klient.', z: 'art. 97 ust. 1 pkt 4 ustawy o SW' },
    wydalenie: { t: 'Wydalony ze służby', bad: true, bg: 'brama', d: 'Za dużo przewinień dyscyplinarnych. Przełożony sięgnął po najcięższą karę z katalogu – wydalenie ze służby. Po uprawomocnieniu orzeczenia stosunek służbowy wygasa.',
      b: 'Nagana, ostrzeżenie, ostrzeżenie… Kolekcjonujesz kary jak Wróbel naklejki. Wracaj do punktu kontrolnego. Tym razem kolekcjonuj pochwały.', z: 'art. 232 pkt 7 i art. 97 ust. 1 pkt 2 ustawy o SW' },
    nieprzydatny: { t: 'Nieprzydatny do służby', bad: true, bg: 'kadry', d: 'Służba przygotowawcza kończy się opinią służbową. Twoja stwierdza nieprzydatność do służby. W takim wypadku zwolnienie ze służby jest obligatoryjne – przełożony nie ma tu wyboru.',
      b: 'Dwa lata patrzyłem, jak się starasz. Problem w tym, że starał{eś|aś} się głównie unikać roboty. Wracaj do punktu kontrolnego.', z: 'art. 96 ust. 1 pkt 1 ustawy o SW' },
    niezdany: { t: 'Egzamin niezdany', bad: false, bg: 'wyklad', d: 'Komisja egzaminacyjna nie miała litości, a ty – wystarczającej liczby poprawnych odpowiedzi. Na szczęście egzamin można powtórzyć.',
      b: 'Wiedza nie wchodzi przez skórę od noszenia munduru. Siadaj do fiszek i podejdź jeszcze raz.' },
    przygody: { t: 'Chorąży „z przygodami”', bg: 'final', d: 'Egzamin zdany, pagony chorążego na ramionach. W teczce osobowej zostały jednak adnotacje o karach dyscyplinarnych – z czasem ulegną zatarciu, ale przełożeni wciąż o nich pamiętają.',
      b: 'Zdał{eś|aś}. Gratuluję. Będę cię obserwował – z przyzwyczajenia i z zawodowej ciekawości.', z: 'kary dyscyplinarne podlegają zatarciu po upływie określonego czasu (np. nagana – 12 miesięcy)' },
    wzorowy: { t: 'Wzorowy chorąży', bg: 'final', d: 'Egzamin zdany, teczka czysta, opinia dobra. Na placu apelowym dostajesz pagony chorążego, a Wróbel bije brawo tak głośno, że kierownik ochrony odwraca się dwa razy.',
      b: 'No proszę. Z ciebie jednak będzie funkcjonariusz. Tylko nie mów nikomu, że to powiedziałem.' },
    sekret: { t: 'Bielik idzie na emeryturę', bg: 'final', d: 'Egzamin zdany, ani jednego rażącego błędu, opinia wyróżniająca. Po uroczystości Bielik zdejmuje furażerkę, kładzie ją na stole i mówi, że jego robota tutaj skończona. Na pożegnanie zostawia ci swój stary notes z uwagami o każdym rozdziale.',
      b: 'Trzydzieści lat służby, a nikt mnie tak nie zaskoczył. Pilnuj Wróbla. I siebie. Ja idę łowić ryby – one przynajmniej nie mają regulaminu.' },
  },
};
GRA.chapters = {};
function rozdzial(id, o) { o.id = id; GRA.chapters[id] = o; }
/* ================= AKT I – PRZYJĘCIE ================= */

rozdzial('list', { t: 'List z kadr', bg: 'kadry', tag: 'Okręgowy inspektorat · dział kadr',
  outro: 'Pierwszy formularz za tobą. Zostało ich jeszcze około czterech tysięcy. Przyzwyczajaj się.',
  s: [
    { nar: 'Szara koperta z pieczątką. W środku zaproszenie do postępowania kwalifikacyjnego do Służby Więziennej i ankieta personalna na sześć stron. Czujesz, że to początek czegoś dużego. Albo przynajmniej długiego.' },
    { who: 'halinka', t: 'Dzień dobry, kadry! Brakuje mi pana… przepraszam, {pana|pani} ankiety. I podania ze wskazaniem działu i stanowiska. Bez tego nawet herbaty tu nie dostaniesz.' },
    { who: 'halinka', t: 'A tak w ogóle – wie {pan|pani}, gdzie się zgłasza? Bo w zeszłym tygodniu był tu jeden, co myślał, że to Policja. Do dziś szuka radiowozu.' },
    { c: 'Czym właściwie jest Służba Więzienna?', o: [
      { t: 'Umundurowaną i uzbrojoną formacją apolityczną podległą Ministrowi Sprawiedliwości', r: 'ok', d: [4, 0, 0], who: 'halinka', b: 'O, ktoś czytał ustawę. Zapiszę sobie w notesie: „kandydat nie straszny”.', x: 'Tak definiuje SW art. 1 ustawy o Służbie Więziennej. Formacja ma własną strukturę organizacyjną, a koszty jej działania pokrywa budżet państwa.', z: 'art. 1 ustawy o SW' },
      { t: 'Formacją podległą Ministrowi Spraw Wewnętrznych i Administracji', r: 'bad', d: [-3, 0, 0], who: 'halinka', b: 'Ojej. To tamci, co mają radiowozy. My mamy Ministra Sprawiedliwości.', x: 'SW podlega Ministrowi Sprawiedliwości, nie MSWiA.', z: 'art. 1 ustawy o SW' },
      { t: 'Prywatną firmą ochroniarską z umową z państwem', r: 'bad', d: [-4, 0, 0], who: 'halinka', b: 'Proszę pana… pani. Tu się składa ślubowanie, a nie podpisuje B2B.', z: 'art. 1 ustawy o SW' },
    ] },
    { nar: 'Ankieta personalna, pytanie 14: „Czy był{eś|aś} kiedykolwiek karan{y|a} lub czy toczy się przeciwko tobie postępowanie karne?”. Przypominasz sobie sprawę sprzed lat – stłuczkę, w której pasażer drugiego auta złamał rękę. Sąd warunkowo umorzył postępowanie o nieumyślne spowodowanie wypadku. „Kto by to sprawdzał” – szepcze cichy głos.' },
    { c: 'Co wpisujesz w ankiecie?', o: [
      { t: 'Wpisuję prawdę i dołączam kopię wyroku', r: 'ok', d: [5, 0, 0], who: 'bielik', b: 'Szczerość to w tej służbie waluta. A kadry i tak sprawdzą cię w rejestrach szybciej, niż zdążysz powiedzieć „kto by to sprawdzał”.', x: 'Kandydat nie może być skazany za przestępstwo umyślne ani mieć prawomocnego wyroku warunkowo umarzającego postępowanie o takie przestępstwo. Twoja sprawa dotyczyła przestępstwa nieumyślnego, więc cię nie wyklucza – ale zatajenie wyjdzie przy sprawdzaniu w rejestrach i podważy rękojmię prawidłowego wykonywania zadań.', z: 'art. 38 ust. 1 pkt 4–5 ustawy o SW', set: 'szczery' },
      { t: 'Pomijam – to było dawno', r: 'bad', d: [-8, 0, 0], who: 'bielik', b: 'Dawno? Rejestry pamiętają dłużej niż twoja babcia urodziny wnuków. Zatajenie to pierwszy krok do odrzucenia kandydatury.', x: 'Sprawa o przestępstwo nieumyślne nie wyklucza z naboru – wykluczenie dotyczy przestępstw umyślnych (także warunkowo umorzonych). Ale kłamstwo w ankiecie podważa rękojmię prawidłowego wykonywania zadań, a to już jest wymóg z ustawy.', z: 'art. 38 ust. 1 pkt 4–5 ustawy o SW' },
      { t: 'Dzwonię do kadr i pytam, jak to opisać', r: 'ok', d: [4, 0, 0], who: 'halinka', b: 'No i ładnie! Proszę wpisać zgodnie z prawdą i dołączyć dokument. My tu nie gryziemy. Kadry nie gryzą. Głównie.', x: 'Wątpliwości warto wyjaśniać przed złożeniem dokumentów – zawsze zgodnie z prawdą.', z: 'art. 38 ust. 1 ustawy o SW', set: 'szczery' },
    ] },
    { who: 'halinka', t: 'Jeszcze jedno: struktura. Na rozmowie lubią o to pytać. Kto jest organem Służby Więziennej, a kto nie – to klasyk.' },
    { quiz: ['sw-m04', 'pragmatyka-m01', 'pragmatyka-m02', 'prag-t20', 'kurs-p-02'], n: 3, t: 'Ściąga od pani Halinki', who: 'halinka', say: 'Szybki sprawdzian, zanim pana… panią puszczę dalej.', by: 'halinka',
      okLine: 'Bezbłędnie! Pani dyrektor będzie zachwycona. Ja już jestem.', midLine: 'Może być. Do rozmowy jeszcze sobie powtórzymy.', badLine: 'Oj. Proszę sobie zrobić notatki. Najlepiej dwie.' },
  ] });

rozdzial('sito', { t: 'Sito', bg: 'kadry', tag: 'Postępowanie kwalifikacyjne',
  outro: 'Przesz{edłeś|łaś} przez sito. Wróbel też – nikt nie wie jak. Komisja chyba też nie.',
  s: [
    { nar: 'Postępowanie kwalifikacyjne ma swoje etapy: wstępny, sprawdzający, ranking kandydatów i końcowy, w którym komisja lekarska ustala zdolność fizyczną i psychiczną do służby. Po drodze: test wiedzy, test sprawności fizycznej i rozmowa kwalifikacyjna.' },
    { who: 'wrobel', t: 'Cześć! Wróbel jestem. Też do więzienia? To znaczy do pracy w więzieniu! Haha. Słuchaj, a ten test sprawności to trzeba zaliczyć czy tylko przyjść?' },
    { who: 'wrobel', t: 'Bo ja trenowałem. Dwa razy. W tym roku.', pause: true },
    { c: 'Komisja pyta, które z wymogów musi spełniać kandydat do SW. Które zdanie jest prawdziwe?', o: [
      { t: 'Obywatelstwo polskie, pełnia praw publicznych, co najmniej wykształcenie średnie lub średnie branżowe, zdolność fizyczna i psychiczna', r: 'ok', d: [4, 0, 0], who: 'bielik', b: 'Zgadza się. Do tego uregulowany stosunek do służby wojskowej, niekaralność, rękojmia i zachowanie tajemnicy.', x: 'Pełny katalog: obywatelstwo polskie; uregulowany stosunek do służby wojskowej; pełnia praw publicznych; rękojmia prawidłowego wykonywania zadań; niekaralność za przestępstwo umyślne; rękojmia zachowania tajemnicy; co najmniej wykształcenie średnie lub średnie branżowe; zdolność fizyczna i psychiczna do służby w formacji uzbrojonej, podległej szczególnej dyscyplinie.', z: 'art. 38 ust. 1 ustawy o SW' },
      { t: 'Wystarczy wykształcenie podstawowe i prawo jazdy kat. B', r: 'bad', d: [-3, 0, 0], who: 'bielik', b: 'Prawo jazdy przydaje się w konwoju, ale nie zastępuje matury.', z: 'art. 38 ust. 1 pkt 7 ustawy o SW' },
      { t: 'Kandydat musi mieć ukończone 25 lat', r: 'bad', d: [-3, 0, 0], who: 'bielik', b: 'Ustawa nie podaje takiej granicy wieku. Ty natomiast podajesz mi powód do zmartwień.', z: 'art. 38 ust. 1 ustawy o SW' },
    ] },
    { nar: 'Rozmowa kwalifikacyjna. Trzy osoby za stołem, szklanka wody i pytanie, którego się bał{eś|aś}: „Dlaczego chce {pan|pani} służyć w SW?”' },
    { c: 'Co odpowiadasz komisji?', o: [
      { t: 'Chcę pracować z ludźmi w trudnej sytuacji i pilnować, żeby kara była wykonywana zgodnie z prawem', r: 'ok', d: [5, 0, 3], who: 'bielik', b: 'Dobre. Motywacja odwołująca się do własnych predyspozycji – komisja to lubi, bo rzadko to słyszy.', x: 'Podczas rozmowy ocenia się m.in. motywację do podjęcia służby, w tym racjonalne jej uzasadnienie odwołujące się do własnych predyspozycji, umiejętności i doświadczeń.', z: 'rozporządzenie MS w sprawie postępowania kwalifikacyjnego do SW' },
      { t: 'Bo jest stabilna pensja i wcześniejsza emerytura', r: 'meh', d: [-1, 0, 0], who: 'bielik', b: 'Szczere. Komisja doceniła szczerość, ale zapisała coś bardzo małymi literkami.' },
      { t: 'Bo lubię mieć władzę nad ludźmi', r: 'bad', d: [-8, 0, -5], who: 'bielik', b: 'Brawo. Właśnie opisa{łeś|łaś} dokładnie ten typ, którego szukamy, żeby go nie przyjąć.', x: 'Służba wymaga poszanowania godności ludzkiej – to element roty ślubowania. Motywacja oparta na władzy nad innymi to czerwona flaga.', z: 'art. 41 ust. 1 ustawy o SW' },
    ] },
    { who: 'wrobel', t: 'A ja im powiedziałem, że zawsze chciałem nosić mundur, bo pasuje mi do oczu. Myślisz, że to dobrze?' },
    { c: 'Wróbel pyta, czy na teście sprawności można „pożyczyć” wynik od kolegi i wpisać się na jego listę. Co mu mówisz?', o: [
      { t: 'Nie ma mowy – to oszustwo, a test i tak robi komisja z listą obecności', r: 'ok', d: [3, 0, 2], who: 'wrobel', b: 'No dobra, dobra. To pobiegnę sam. Wolno, ale sam.' },
      { t: 'Spróbuj, najwyżej cię wyrzucą', r: 'bad', d: [-4, 0, -3], who: 'bielik', b: 'Zachęcanie kolegi do oszustwa przy naborze. Ładny początek kariery. Dla was obu.' },
    ] },
    { quiz: ['prag-t57', 'kurs-p-01', 'prag-t28', 'pragmatyka-m10'], n: 3, t: 'Pytania komisji', who: 'bielik', say: 'Komisja ma jeszcze kilka pytań. Ja tylko przypadkiem tu stoję.' },
  ] });

rozdzial('slubowanie', { t: 'Ślubuję', bg: 'plac', tag: 'Plac apelowy · ślubowanie',
  outro: 'Ślubowanie złożone. Od dziś każda twoja głupota ma numer legitymacji. Witaj w służbie przygotowawczej.',
  s: [
    { nar: 'Akt mianowania podpisany przez kierownika jednostki. Mundur jeszcze pachnie magazynem, furażerka trzyma się na słowo honoru. Na placu stoi ktoś, kto wygląda, jakby urodził się w mundurze i od tamtej pory nie usiadł.' },
    { who: 'bielik', t: 'Chorąży Bielik. Będę twoim przełożonym przez najbliższe lata. Nie, nie musisz się cieszyć. Wystarczy, że będziesz punktualnie.' },
    { who: 'bielik', t: 'Za chwilę złożysz ślubowanie. To nie jest formułka do odklepania. Odmowa złożenia ślubowania powoduje nieważność aktu mianowania. Jednym zdaniem – albo ślubujesz, albo idziesz do domu.' },
    { item: 'prag-rota', who: 'bielik', say: 'Ułóż rotę we właściwej kolejności. Na uroczystości nie będzie suflera.', after: ['Bez zająknięcia. Prawie jestem wzruszony. Prawie.', 'Pomylił{eś|aś} kolejność. Na placu przed sztandarem to by było… zapamiętywalne.'] },
    { c: 'Po uroczystości Wróbel pyta: „Ile w ogóle trwa ta służba przygotowawcza? I co, jak nas nie polubią?”', o: [
      { t: 'Co do zasady 2 lata; jeśli opinia stwierdzi nieprzydatność do służby – zwolnienie jest obowiązkowe', r: 'ok', d: [4, 0, 0], who: 'bielik', b: 'Dokładnie. Dwa lata patrzenia ci na ręce. Moich rąk.', x: 'Służba przygotowawcza trwa 2 lata (może być przedłużona, np. o urlop bezpłatny lub wychowawczy). Funkcjonariusza zwalnia się obligatoryjnie, jeśli w okresie służby przygotowawczej opinia służbowa stwierdzi jego nieprzydatność do służby.', z: 'ustawa o SW: art. 42 (służba przygotowawcza), art. 96 ust. 1 pkt 1' },
      { t: 'Rok, a potem automatycznie służba stała', r: 'bad', d: [-3, 0, 0], who: 'bielik', b: 'Automatycznie to się drzwi w sklepie otwierają. Tu decyduje opinia.', z: 'ustawa o SW: art. 42, art. 96 ust. 1 pkt 1' },
      { t: 'Pół roku próbnego, jak w cywilu', r: 'bad', d: [-3, 0, 0], who: 'bielik', b: 'To nie umowa na okres próbny w sklepie z butami.', z: 'ustawa o SW: art. 42' },
    ] },
    { who: 'magazynier', t: 'Dzięcioł, magazyn. Mundur dostajesz z dniem przyjęcia, ale własnością staje się dopiero z mianowaniem do służby stałej. Więc jak go zniszczysz, to jakbyś zniszczy{ł|ła}… mój mundur. A ja liczę skarpetki. Każdą.' },
    { quiz: ['prag-t23', 'prag-t68', 'prag-t34', 'pragmatyka-m33', 'prag-t27', 'kwatermistrz-m04', 'prag-t29'], n: 4, t: 'Rozmowa po uroczystości', who: 'bielik', say: 'Zanim pójdziesz świętować – kilka pytań. Tradycja.' },
  ] });

/* ================= AKT II – WSTĘPNIAK ================= */

rozdzial('apel', { t: 'Pierwszy apel', bg: 'plac', tag: 'Ośrodek szkolenia · 6:00',
  outro: 'Przeży{łeś|łaś} pierwszy dzień wstępniaka. Wróbel też, choć dwa razy pomylił lewo z prawo. W tym raz celowo.',
  s: [
    { nar: 'Szkolenie wstępne ma trzy etapy: wstępną adaptację zawodową w jednostce, kurs przygotowawczy w ośrodku szkolenia – czyli słynny „wstępniak” – i praktykę zawodową. Całość powinna się zakończyć przed upływem 11 miesięcy od przyjęcia do służby.' },
    { who: 'bielik', t: 'Godzina 6:00. Słońce jeszcze śpi. Wróbel też – stoi, ale śpi. Kursanci, baczność!' },
    { who: 'wrobel', t: '(szeptem) Słuchaj, zaspałem na rozprowadzenie… Jak wyczytają moje nazwisko, krzyknij „jestem” moim głosem? Mam niski, ty też dasz radę.', pause: true },
    { c: 'Wyczytują nazwisko Wróbla. Wróbla w szeregu nie ma.', o: [
      { t: 'Milczę – a po apelu mówię Wróblowi, żeby sam zgłosił się do przełożonego', r: 'ok', d: [4, 0, 1], who: 'bielik', b: 'Lojalność wobec kolegi to nie krycie jego wpadek. Dobrze, że to rozumiesz.', x: 'Wprowadzenie w błąd przełożonego, które może wyrządzić szkodę służbie, jest wprost wymienione wśród naruszeń dyscypliny służbowej.', z: 'art. 230 ust. 3 pkt 5 ustawy o SW' },
      { t: 'Krzyczę „jestem!” niskim głosem', r: 'dysc', kara: 'rozmowa', why: 'Krycie nieobecności kolegi na apelu', d: [-6, 0, 2], who: 'bielik', b: 'Bas jak u Pavarottiego. Szkoda, że stał{eś|aś} trzy metry obok miejsca Wróbla. Rozmowa dyscyplinująca – na pierwszy raz.', x: 'Wprowadzenie w błąd przełożonego to naruszenie dyscypliny służbowej. Przy przewinieniu mniejszej wagi przełożony może zamiast postępowania przeprowadzić udokumentowaną rozmowę dyscyplinującą.', z: 'art. 230 ust. 3 pkt 5 i ust. 6 ustawy o SW' },
      { t: 'Melduję, że Wróbla nie ma i wiem, że zaspał', r: 'meh', d: [2, 0, -3], who: 'wrobel', b: 'No dzięki. Serio. Dzięki. Zapamiętam.', mem: 'Wróbel jest na ciebie lekko obrażony. Przejdzie mu… pewnie.' },
    ] },
    { who: 'bielik', t: 'Teraz musztra. Oddawanie honorów. Kto salutuje lewą ręką, ten przez tydzień czyści mi buty. Prawą też będzie czyścił, ale już dobrowolnie.' },
    { quiz: ['pragmatyka-m17', 'pragmatyka-m18', 'pragmatyka-m19', 'kwatermistrz-m11', 'kwatermistrz-m12'], n: 3, t: 'Musztra i umundurowanie', who: 'bielik', say: 'Pytania z regulaminu. Na stojąco.' },
    { who: 'bielik', t: 'I jeszcze jedno: szkolenie wstępne kończy się egzaminem i oceną przydatności. Kto obleje także poprawkę, dostaje opinię – a opinia o nieprzydatności w służbie przygotowawczej oznacza obowiązkowe zwolnienie. Nie „może”. Obowiązkowe.' },
  ] });

rozdzial('wyklad', { t: 'Sala wykładowa', bg: 'wyklad', tag: 'Wstępniak · zajęcia teoretyczne',
  outro: 'Wykładowca Pelikan powiedział „zależy” czterdzieści siedem razy. Liczy{łeś|łaś}. To też jest jakaś forma uwagi.',
  s: [
    { who: 'wykladowca', t: 'Dzień dobry państwu. Pelikan. Ustawa o Służbie Więziennej, Kodeks karny wykonawczy, prawa człowieka. Na każde państwa pytanie mam jedną odpowiedź: zależy. Na moje pytania państwo takiej odpowiedzi nie mają.' },
    { quiz: ['kkw-m84', 'kkw-m09', 'pragmatyka-m16', 'pragmatyka-m15', 'pragmatyka-m13', 'metodyka-m03', 'pragmatyka-m36'], n: 4, t: 'Kartkówka u Pelikana', who: 'wykladowca', say: 'Kartkówka. Telefony do plecaków. Wróbel, plecak do plecaka.', by: 'wykladowca',
      okLine: 'Komplet. Zależy, czy przypadek. Raczej nie.', midLine: 'Poprawnie… w zależności od kryteriów. Moje są łagodne. Dziś.', badLine: 'Zależy, kogo zapytać. Mnie lepiej nie pytać.' },
    { nar: 'Przerwa. Wróbel macha do ciebie telefonem: „Mam zdjęcia testu z zeszłego turnusu. Wyślę ci na egzamin końcowy, będziemy kozakami”.' },
    { c: 'Co robisz z „przeciekiem” Wróbla?', o: [
      { t: 'Odmawiam i mówię mu, żeby skasował – to nieuczciwe i grozi wywaleniem z kursu', r: 'ok', d: [5, 0, 2], who: 'bielik', b: 'Zasady etyki zawodowej obowiązują i w służbie, i poza nią. Także na kursie. Zwłaszcza na kursie.', x: 'Zasady etyki zawodowej funkcjonariuszy SW dotyczą zachowania zarówno w służbie, jak i poza nią. Szkolenie wstępne kończy się egzaminem i oceną przydatności do służby – nieuczciwość przy egzaminie może skończyć się negatywną oceną.', z: 'ustawa o SW: art. 43j; zasady etyki zawodowej funkcjonariuszy SW', set: 'uczciwyKurs' },
      { t: 'Biorę, ale tylko „żeby zobaczyć, jakie są tematy”', r: 'dysc', kara: 'nagana', why: 'Korzystanie z nielegalnie zdobytych materiałów egzaminacyjnych', d: [-8, 0, 0], who: 'bielik', b: 'Komendant ośrodka też chciał tylko „zobaczyć tematy” – w twoim telefonie. Nagana. I uwierz mi: to najłagodniejsza wersja tej historii.', x: 'Nieuczciwość podczas szkolenia narusza zasady etyki i dyscyplinę służbową. Nagana to pierwsza kara z katalogu kar dyscyplinarnych.', z: 'art. 230 i 232 ustawy o SW' },
    ] },
    { who: 'wykladowca', t: 'Ostatnie pytanie dnia: czy funkcjonariusz może należeć do partii politycznej? Proszę nie odpowiadać „zależy”. Ten zwrot jest zarezerwowany dla mnie.' },
    { c: 'Odpowiadasz Pelikanowi:', o: [
      { t: 'Nie może – z chwilą przyjęcia do służby dotychczasowe członkostwo ustaje', r: 'ok', d: [4, 0, 0], who: 'wykladowca', b: 'Bez „zależy”. Imponujące.', x: 'Funkcjonariusz nie może być członkiem partii politycznej; z chwilą przyjęcia do służby jego dotychczasowe członkostwo ustaje. Musi też poinformować przełożonego o przynależności do stowarzyszeń krajowych. Może natomiast należeć do związku zawodowego.', z: 'art. 163 ustawy o SW' },
      { t: 'Może, byle nie nosił munduru na wiecach', r: 'bad', d: [-3, 0, 0], who: 'wykladowca', b: 'Zależy… nie, nie zależy. Źle.', z: 'art. 163 ust. 1 ustawy o SW' },
      { t: 'Może, jeśli uzyska zgodę dyrektora', r: 'bad', d: [-3, 0, 0], who: 'wykladowca', b: 'Dyrektor może wiele, ale nie to.', z: 'art. 163 ust. 1 ustawy o SW' },
    ] },
  ] });

rozdzial('mata', { t: 'Szarpanina na macie', bg: 'mata', tag: 'Wstępniak · ŚPB i pierwsza pomoc',
  outro: 'Pozorant wciąż masuje nadgarstek. Ty – ego. Środki przymusu to nie zabawka, tylko narzędzie z instrukcją.',
  s: [
    { who: 'bielik', t: 'Środki przymusu bezpośredniego. Ustawa z 24 maja 2013 roku. Pierwsza zasada: używasz ich w sposób niezbędny, proporcjonalny do zagrożenia i wybierasz środek możliwie najmniej dolegliwy. Druga zasada: patrz zasada pierwsza.' },
    { nar: 'Ćwiczenie. Pozorant gra osadzonego, który odmawia wyjścia z celi na rozmowę z wychowawcą. Siedzi na pryczy, krzyżuje ręce, nie atakuje, nie ucieka. Po prostu nie.' },
    { c: 'Jak reagujesz jako oddziałowy?', o: [
      { t: 'Rozmawiam, wydaję polecenie, informuję o konsekwencjach i zgłaszam przełożonemu – bez zamachu i ucieczki nie decyduję sam o ŚPB', r: 'ok', d: [5, 3, 2], who: 'bielik', b: 'Właśnie tak. Bierny opór to nie wojna. O ŚPB w takiej sytuacji decyduje przełożony, nie twoja ambicja.', x: 'Funkcjonariusz SW może samodzielnie podjąć decyzję o użyciu ŚPB m.in. przy usiłowaniu zamachu na życie lub zdrowie, usiłowaniu ucieczki czy w pościgu. Odmowa wykonania polecenia w celi, bez zamachu i ucieczki, do nich nie należy. Przed użyciem ŚPB wzywa się do zachowania zgodnego z prawem.', z: 'ustawa o ŚPB: art. 6, art. 34, art. 35 ust. 2 pkt 10' },
      { t: 'Od razu zakładam mu kajdanki – nie będzie mi tu siedział', r: 'bad', d: [-6, -2, -6], who: 'bielik', b: 'Gratuluję. Właśnie użył{eś|aś} kajdanek wobec kogoś, kto tylko siedział. Kajdanek nie stosuje się, gdy jedyną podstawą jest pokonanie biernego oporu.', x: 'Kajdanek nie wolno użyć, gdy jedyną podstawą jest pokonanie biernego oporu. ŚPB stosuje się proporcjonalnie, wybierając środek najmniej dolegliwy.', z: 'ustawa o ŚPB, art. 6 i przepisy o kajdankach' },
      { t: 'Wywlekam go siłą, żeby inni widzieli, kto tu rządzi', r: 'dysc', kara: 'nagana', why: 'Nieproporcjonalne użycie siły fizycznej na ćwiczeniach', d: [-9, -3, -8], who: 'bielik', b: 'Na ćwiczeniach skończyło się naganą. Na oddziale skończyłoby się prokuratorem. Zapamiętaj tę różnicę.', x: 'Pokaz siły „dla przykładu” to przekroczenie uprawnień. ŚPB służą konkretnym celom określonym w ustawie, nie budowaniu autorytetu.', z: 'ustawa o ŚPB, art. 6; art. 230 ust. 3 pkt 4 ustawy o SW' },
    ] },
    { quiz: ['spb-m22', 'spb-m01', 'spb-m03', 'spb-m04', 'spb-m12', 'kurs-5-05', 'kurs-5-17', 'spb-m13'], n: 4, t: 'Sprawdzian ze ŚPB', who: 'bielik', say: 'Teoria. Szybko, bo pozorant się nudzi.' },
    { who: 'lekarka', t: 'Dr Bocianowska. Teraz pierwsza pomoc. Na oddziale to wy będziecie pierwsi przy człowieku, a nie ja. Ja dobiegnę. Długie nogi, ale jednak dobiegnę.' },
    { nar: 'Fantom leży na macie. Nie reaguje na głos ani na potrząsanie. Sprawdzasz oddech – brak.' },
    { c: 'Co robisz?', who: 'lekarka', say: 'Zegar tyka.', o: [
      { t: 'Wzywam pomoc, każę przynieść AED i zaczynam RKO: 30 uciśnięć, 2 oddechy', r: 'ok', d: [5, 4, 3], who: 'lekarka', b: 'Wzorowo. AED – i rób, co mówi głos. On jest mądrzejszy od nas obu o tej porze.', x: 'U dorosłego stosunek uciśnięć do oddechów ratowniczych wynosi 30:2. Oddech ocenia się maksymalnie przez 10 sekund. Po uruchomieniu AED wykonuje się polecenia urządzenia.', z: 'zasady pierwszej pomocy (wytyczne resuscytacji)' },
      { t: 'Układam go w pozycji bocznej i czekam na lekarza', r: 'bad', d: [-6, -4, 0], who: 'lekarka', b: 'Pozycja boczna jest dla nieprzytomnego, który ODDYCHA. Ten nie oddycha. Czekając, czekasz na nekrolog.', z: 'zasady pierwszej pomocy' },
    ] },
    { quiz: ['pp-m01', 'pp-m02', 'pp-m04', 'pp-m05', 'pp-m06', 'pp-m08', 'pp-m16'], n: 3, t: 'Pytania dr Bocianowskiej', by: 'lekarka', okLine: 'Brawo. Można was wypuścić do ludzi.', midLine: 'Dobrze. Ale powtórzcie wbity nóż. Zostaje w ranie!', badLine: 'Proszę powtórzyć. Ja też kiedyś nie wiedziałam. Dawno. Bardzo dawno.' },
  ] });

rozdzial('strzelnica', { t: 'Strzelnica', bg: 'strzelnica', tag: 'Wstępniak · strzelanie z GLOCK 17',
  outro: 'Wszystkie łuski zebrane, wszystkie palce na miejscu. Instruktor Sokół prawie się uśmiechnął. Prawie.',
  s: [
    { who: 'instruktor', t: 'Sokół. Instruktor. Zasady są trzy. Lufa zawsze w stronę tarcz albo kulochwytu. Palec poza spustem, wzdłuż szkieletu, dopóki nie zdecydujesz o strzale. A trzecia zasada: ja mówię, wy robicie. Nie odwrotnie.' },
    { quiz: ['glock-sm01', 'glock-sm02', 'glock-sm04', 'glock-sm05', 'glock-sm06', 'glock-sm10', 'bron-m11', 'bron-m12'], n: 4, t: 'Przed wejściem na stanowisko', who: 'instruktor', say: 'Komendy. Jak ich nie znasz, nie strzelasz.', by: 'instruktor',
      okLine: 'Dopuszczony.', midLine: 'Dopuszczony. Pod obserwacją.', badLine: 'Dopuszczony… bo muszę. Ale stoję za tobą.' },
    { nar: '„W cel – ognia!”. Strzelasz serię. Nagle za plecami Wróbel woła: „Ej, zobacz, jaką mam dziurę w dziesiątce!”' },
    { c: 'Masz broń w ręku. Co robisz?', o: [
      { t: 'Zostaję w postawie, lufa w stronę tarcz, palec poza spustem – i czekam na komendę', r: 'ok', d: [5, 5, 0], who: 'instruktor', b: 'Dobrze. Wróbel może sobie wołać. Lufa patrzy na tarczę, nie na kolegów.', x: 'Na strzelnicy lufę kieruje się wyłącznie w stronę tarcz lub kulochwytu, a palec trzyma poza spustem, dopóki nie podejmie się decyzji o strzale.', z: 'regulamin strzelnicy; zasady bezpiecznego obchodzenia się z bronią' },
      { t: 'Odwracam się do Wróbla z bronią w ręku, żeby zobaczyć', r: 'dysc', kara: 'nagana', why: 'Skierowanie broni w stronę osób na strzelnicy', d: [-10, -8, 0], who: 'instruktor', b: 'STÓJ! Broń w dół! Zejdź ze stanowiska. Na dziś koniec strzelania. Za to się wylatuje z kursu, a czasem z życia – czyjegoś.', x: 'Skierowanie lufy w stronę ludzi to najcięższe naruszenie zasad bezpieczeństwa na strzelnicy. Instruktor przerywa strzelanie, a zachowanie trafia do oceny – i do przełożonego.', z: 'regulamin strzelnicy; art. 230 ustawy o SW' },
    ] },
    { quiz: ['glock-m01', 'glock-m07', 'glock-m11', 'glock-m24', 'bron-m02', 'bron-m03', 'glock-m23'], n: 3, t: 'Budowa GLOCK 17', who: 'instruktor', say: 'Na koniec teoria. Broń trzeba rozumieć, nie tylko trzymać.', by: 'instruktor' },
  ] });

rozdzial('egzamin1', { t: 'Egzamin końcowy wstępniaka', bg: 'wyklad', tag: 'Kurs przygotowawczy · egzamin',
  outro: 'Kurs przygotowawczy zaliczony. Czas zobaczyć prawdziwy zakład karny. Prawdziwy Wróbel już tam jest – przydzielili was razem. Los bywa złośliwy.',
  s: [
    { who: 'wykladowca', t: 'Egzamin końcowy. Ocenie podlega wiedza, umiejętności i przydatność do służby. Kto nie zda, ten… zależy. Głównie od tego, czy zda za drugim razem.' },
    { quiz: ['pragmatyka-m03', 'prag-t29', 'spb-m22', 'spb-m23', 'pp-m01', 'glock-sm06', 'pragmatyka-m20', 'pragmatyka-m23', 'kkw-m84', 'prag-t68', 'spb-m27', 'kurs-5-02'], n: 8, pass: 0.6, t: 'Egzamin wstępniaka', by: 'wykladowca',
      failLine: 'Niezaliczone. Usiądź, przejrzyj notatki i podejdź jeszcze raz. W prawdziwym życiu masz na to ograniczony czas.',
      failX: 'Szkolenie wstępne kończy się egzaminem i oceną przydatności do służby. Po niezdanym egzaminie poprawkowym wydaje się opinię służbową, a opinia stwierdzająca nieprzydatność w okresie służby przygotowawczej oznacza obligatoryjne zwolnienie ze służby.', failZ: 'art. 43i–43j i art. 96 ust. 1 pkt 1 ustawy o SW',
      okLine: 'Bezbłędnie. Nie będę mówił „zależy”. Jest dobrze.', midLine: 'Zdane. Gratuluję. Bez fajerwerków, ale zdane.' },
    { who: 'bielik', t: 'Zdane. Dostajesz przydział: Zakład Karny w Bielinach, dział ochrony. Ja też tam jestem. Nie, to nie przypadek. Nikt inny nie chciał was z Wróblem.' },
  ] });
/* ================= AKT III – STANOWISKA (ZK w Bielinach) ================= */

rozdzial('brama', { t: 'Brama', bg: 'brama', pin: 'brama', tag: 'ZK w Bielinach · wejście',
  outro: 'Pierwsza zmiana na bramie. Nikt nie wszedł, kto nie powinien. Wróbel próbował wyjść przed czasem – też się nie udało.',
  s: [
    { who: 'kierownik', t: 'Jastrząb. Kierownik działu ochrony. Za bezpieczeństwo jednostki odpowiadają wszyscy, ale z moim działem rozmawia się pierwszym. Zaczynasz od bramy – tu widać, kto myśli, a kto tylko stoi.' },
    { who: 'bielik', t: 'Brama to nie bramka w supermarkecie. Każdy, kto wchodzi, ma udowodnić, kim jest i po co przyszedł. „Pan mnie zna” to nie dokument.' },
    { nar: 'Elegancki mężczyzna z teczką uśmiecha się szeroko: „Mecenas Kowalczyk, do klienta. Legitymację zostawiłem w samochodzie, ale pan mnie przecież zna, byłem tu w zeszłym miesiącu!”. Widzisz go pierwszy raz w życiu.' },
    { c: 'Co robisz?', o: [
      { t: 'Uprzejmie odmawiam wejścia, dopóki nie okaże dokumentu tożsamości i uprawnień – i informuję dowódcę zmiany', r: 'ok', d: [5, 5, 0], who: 'bielik', b: 'Dobrze. Prawdziwy adwokat wróci z legitymacją. Fałszywy już nie wróci – i o to chodzi.', x: 'Wejście do jednostki wymaga ustalenia tożsamości i uprawnień osoby. Wątpliwości rozstrzyga się z dowódcą zmiany, a nie „na znajomość”. Brak kontroli przy wejściu to klasyczna droga przemytu.', z: 'zasady ochrony jednostek organizacyjnych SW' },
      { t: 'Wpuszczam – skoro twierdzi, że już tu był, to pewnie był', r: 'bad', d: [-6, -8, 0], who: 'bielik', b: 'Pewnie był. W innym więzieniu. Po drugiej stronie biurka. Kontrola przy wejściu to nie uprzejmość, to obowiązek.', x: 'Niedopełnienie obowiązków przy kontroli ruchu osób narusza dyscyplinę służbową i bezpieczeństwo jednostki.', z: 'art. 230 ust. 3 pkt 2 ustawy o SW' },
      { t: 'Każę mu poczekać i sam{|a} dzwonię do kancelarii z numeru, który mi poda', r: 'meh', d: [1, -2, 0], who: 'bielik', b: 'Prawie. Tylko że numer podał ci on. Równie dobrze możesz zadzwonić do jego szwagra.' },
    ] },
    { nar: 'Pół godziny później podjeżdża kurier: „Paczka dla pana kierownika Jastrzębia, do rąk własnych. Wejdę na chwilę, położę mu na biurku, dobra?”' },
    { c: 'Kurier chce wejść z paczką na teren jednostki.', o: [
      { t: 'Kurier nie wchodzi – przesyłkę przyjmuje się w wyznaczonym miejscu, a adresata zawiadamiam', r: 'ok', d: [4, 4, 0], who: 'kierownik', b: 'Dobrze. Moje paczki też nie chodzą same po jednostce. Nawet te z kawą.' },
      { t: 'Wpuszczam, ale idę z nim', r: 'bad', d: [-4, -5, 0], who: 'kierownik', b: 'I zostawił{eś|aś} bramę bez obsady. Dwa błędy w cenie jednego.' },
    ] },
    { quiz: ['kurs-3-01', 'kurs-3-02', 'kurs-4-01', 'kurs-3-08', 'ochrona-m51', 'ochrona-m57', 'kurs-3-06'], n: 4, t: 'Odprawa po zmianie', who: 'kierownik', say: 'Odprawa. Krótko i konkretnie.', by: 'kierownik',
      okLine: 'Konkretnie. Lubię to.', midLine: 'Wystarczy. Na razie.', badLine: 'Proszę douczyć instrukcję. Do jutra.' },
  ] });

rozdzial('wiezyczka', { t: 'Wieżyczka', bg: 'wiezyczka', pin: 'wiezyczka', tag: 'Stanowisko uzbrojone · 02:40',
  outro: 'Noc na wieżyczce. Termos pusty, oczy otwarte, broń w kaburze. Bielik o 3:00 sprawdził, czy nie śpisz. Nie spał{eś|aś}. On – też nie.',
  s: [
    { who: 'bielik', t: 'Wartownika zmienia się nie rzadziej niż co 4 godziny. Opóźnić zmianę można tylko ze względów bezpieczeństwa – nie dlatego, że zmiennik nie może znaleźć czapki.' },
    { who: 'bielik', t: 'Jak widoczność ograniczona, a ktoś się zbliża – „Stój! Kto idzie?”. Jak ktoś nieuprawniony wejdzie na pas ochronny – „Stój! W tył zwrot!” i natychmiast melduje się dowódcy zmiany.' },
    { nar: '02:40. Mgła. Od strony lasu, za zewnętrznym ogrodzeniem, przesuwa się sylwetka. Zatrzymuje się przy płocie i coś przy nim robi. Rzut? Pakunek? Wiatr?' },
    { c: 'Twoja pierwsza reakcja?', o: [
      { t: 'Obserwuję, zgłaszam dowódcy zmiany przez radio i podaję dokładne miejsce', r: 'ok', d: [5, 6, 0], who: 'bielik', b: 'O to chodzi. Ty jesteś oczami, dowódca zmiany – rękami. Grupa sprawdzi, co to za „wiatr”.', x: 'Informację o zagrożeniu funkcjonariusz niezwłocznie przekazuje przełożonemu. Reagować trzeba na każde zauważone zagrożenie bezpieczeństwa.', z: 'zasady ochrony jednostek; obowiązki wartownika', set: 'meldunekNoc' },
      { t: 'Strzelam w jego kierunku, żeby uciekł', r: 'karne', crime: '231_1', d: [-25, -10, -5], who: 'bielik', b: 'Strzał do człowieka bez podstawy prawnej i bez procedury ostrzegawczej. To nie „odstraszanie”. To przestępstwo.', x: 'Broni palnej można użyć wyłącznie w przypadkach wskazanych w ustawie o ŚPB i z zachowaniem procedury ostrzegawczej (wezwanie, ostrzeżenie, strzał ostrzegawczy). Strzał bez podstawy to przekroczenie uprawnień – a przy skutkach dla zdrowia lub życia znacznie więcej.', z: 'ustawa o ŚPB (art. 45, 47–48); art. 231 § 1 kk' },
      { t: 'Udaję, że nie widzę – to przecież za ogrodzeniem', r: 'bad', d: [-6, -8, 0], who: 'bielik', b: 'Za ogrodzeniem dziś, w celi jutro. Rano znaleźliby przerzut: telefony w piłce tenisowej. A ty byś „nie widział{|a}”.' },
    ] },
    { nar: '03:15. Wewnątrz, przy ogrodzeniu wewnętrznym, osadzony z oddziału gospodarczego wspina się na siatkę. Jest już w połowie.' },
    { c: 'Usiłowanie ucieczki. Co robisz?', o: [
      { t: 'Alarmuję dowódcę zmiany, wzywam do zatrzymania się, ostrzegam – i dopiero jako ostatnie ostrzeżenie oddaję strzał ostrzegawczy w bezpiecznym kierunku', r: 'ok', d: [6, 8, 0], who: 'bielik', b: 'Usłyszał „Stój!”, zobaczył lufę skierowaną w niebo i zszedł szybciej, niż wszedł. Grupa interwencyjna zrobiła resztę. Podręcznikowo.', x: 'Usiłowanie ucieczki to przypadek, w którym funkcjonariusz może sam podjąć decyzję o użyciu ŚPB. Przed użyciem broni stosuje się procedurę ostrzegawczą; strzał ostrzegawczy w bezpiecznym kierunku jest jej ostatnim elementem. Odstąpić od niej można tylko, gdy zwłoka groziłaby bezpośrednim niebezpieczeństwem dla życia lub zdrowia.', z: 'ustawa o ŚPB: art. 35, 45, 48' },
      { t: 'Od razu strzelam do niego bez ostrzeżenia', r: 'karne', crime: '231_1', d: [-25, -5, -10], who: 'bielik', b: 'Nie atakował nikogo, nie było bezpośredniego zagrożenia życia. Pomin{ąłeś|ęłaś} całą procedurę. Prokurator zapyta, dlaczego. Nie będziesz mieć dobrej odpowiedzi.', x: 'Od procedury ostrzegawczej odstępuje się wyłącznie wtedy, gdy jej realizacja groziłaby bezpośrednim niebezpieczeństwem dla życia lub zdrowia. Strzał bez tej przesłanki to przekroczenie uprawnień.', z: 'ustawa o ŚPB, art. 45 i 48; art. 231 § 1 kk' },
      { t: 'Krzyczę do niego, żeby zszedł, ale nie zgłaszam – szkoda robić zamieszanie', r: 'bad', d: [-6, -6, 0], who: 'bielik', b: 'Ucieczka – nawet usiłowanie – to zdarzenie nadzwyczajne. Nie ma „szkoda robić zamieszanie”. Zamieszanie to twoja praca.', z: 'zasady postępowania w razie zdarzeń nadzwyczajnych' },
    ] },
    { quiz: ['stanowiska-m17', 'stanowiska-m22', 'stanowiska-m32', 'stanowiska-m33', 'stanowiska-m34', 'stanowiska-m35', 'spb-m23', 'spb-m24', 'spb-m31', 'kurs-4-08'], n: 4, t: 'Wartownik – pytania kontrolne', who: 'bielik', say: 'Zanim zejdziesz z wieżyczki – pytania. Wiem, ziewasz. Ja też. Odpowiadaj.' },
  ] });

rozdzial('oddzial', { t: 'Oddział', bg: 'korytarz', pin: 'pawilonB', tag: 'Pawilon B · 21:40',
  outro: 'Pierwszy wieczór na oddziale. Poznał{eś|aś} „Doktora”, „Siwego” i „Młodego”. Oni ciebie też. I uwierz – oni robili notatki dokładniejsze niż ty.',
  s: [
    { who: 'sroka', t: 'Dzień dobry, Sroka, wychowawczyni. Wiem wszystko o wszystkich na tym oddziale. Na przykład wiem, że „Doktor” już zapytał, jak masz na imię. To nie jest dobry znak.' },
    { who: 'bielik', t: 'Apel. Otwierasz drzwi jednej celi naraz, liczysz, zamykasz, następna. Nie otwierasz całego korytarza, żeby „szybciej poszło”. Szybciej to pójdzie co najwyżej ucieczka.' },
    { who: 'siwy', t: 'Dobry wieczór, panie oddziałowy. Czternaście lat tu siedzę, przepisy znam lepiej niż pan. Na przykład: na każdą decyzję dyrektora mogę złożyć skargę do sądu penitencjarnego. W siedem dni. Tak tylko mówię.' },
    { nar: 'Zamykasz celę 14. „Doktor” – nienagannie ogolony, okulary w złotych oprawkach – przytrzymuje drzwi i ścisza głos.' },
    { c: 'Panie oddziałowy, kolega z dwunastki ma urodziny. Niech pan tylko przeniesie mu ten list. Nikt nie będzie wiedział.', who: 'doktor', say: '(podaje złożoną kartkę)', hint: 'Ta decyzja może wrócić w późniejszych rozdziałach.', o: [
      { t: 'Odmawiam i po zmianie piszę notatkę służbową', r: 'ok', d: [8, 4, -4], who: 'bielik', b: 'Dobrze. Dziś list, jutro „mały telefon”, pojutrze ty w celi obok. „Doktor” nie ma urodzin. Ma plan.', x: 'Korespondencję osadzonych przyjmuje i wysyła administracja zakładu (przyjmowana w każdym dniu roboczym, wysyłana najpóźniej drugiego dnia roboczego od przekazania). Funkcjonariusz nie pośredniczy w przekazywaniu przedmiotów ani wiadomości między osadzonymi. Próbę nakłonienia do „przysługi” dokumentuje się notatką i zgłasza przełożonemu.', z: 'kkw – przepisy o korespondencji; obowiązki oddziałowego', set: 'notatkaList', mem: 'Zapamiętane: „Doktor” wie, że nie dasz się łatwo podejść. Spróbuje inaczej.' },
      { t: 'Odmawiam i każę mu wysłać list drogą przez administrację', r: 'meh', d: [3, 2, 0], who: 'bielik', b: 'Odmowa dobra. Ale nikt nie wie, że próbował. Bez notatki jego „próby” nie istnieją – aż do dnia, w którym jedna się uda.', set: 'odmowaList' },
      { t: 'Biorę list – to tylko kartka papieru', r: 'bad', d: [-10, -6, 6], who: 'bielik', b: 'Tylko kartka. W tej kartce może być wszystko: groźba dla świadka, plan, zamówienie. Zosta{łeś|łaś} właśnie listonoszem więziennej poczty pantoflowej.', x: 'Pośredniczenie w kontaktach między osadzonymi to niedopełnienie obowiązków i początek „spoufalania się” – jednej z głównych przyczyn zdarzeń z winy funkcjonariuszy.', z: 'art. 230 ust. 3 ustawy o SW', set: 'wzialList' },
    ] },
    { nar: 'W celi 9 „Młody” – tymczasowo aresztowany, dwudziestolatek – stoi przy drzwiach z czerwonymi oczami: „Proszę pana, niech mi pan da zadzwonić do mamy. Z pana telefonu, minutka. Ona nie wie, gdzie jestem”.' },
    { c: 'Co robisz?', o: [
      { t: 'Wyjaśniam, że tymczasowo aresztowany może telefonować tylko za zgodą organu, do którego dyspozycji pozostaje – i proszę wychowawczynię o pomoc we wniosku', r: 'ok', d: [5, 2, 6], who: 'sroka', b: 'Ładnie. Jutro rano złożymy wniosek. Mama dostanie informację oficjalną drogą. A ty dosta{łeś|łaś} u niego plusa.', x: 'Tymczasowo aresztowany nie korzysta z telefonu bez zgody organu, do którego dyspozycji pozostaje (sąd lub prokurator). Funkcjonariusz nie udostępnia własnego telefonu osadzonemu.', z: 'kkw – przepisy o wykonywaniu tymczasowego aresztowania', set: 'mlodyPomoc' },
      { t: 'Daję mu swój telefon na minutę', r: 'dysc', kara: 'ost_stan', why: 'Udostępnienie prywatnego telefonu tymczasowo aresztowanemu', d: [-12, -8, 8], who: 'bielik', b: 'Minutka. W tę minutkę mógł zadzwonić do wspólnika i ustalić zeznania. Dlatego aresztowany telefonuje za zgodą sądu lub prokuratora, a nie z twojej komórki. Ostrzeżenie o niepełnej przydatności na stanowisku.', x: 'Kontakt tymczasowo aresztowanego ze światem zewnętrznym kontroluje organ dysponujący – właśnie po to, by nie utrudniał postępowania. Funkcjonariusz udostępniający telefon przekracza uprawnienia.', z: 'kkw – tymczasowe aresztowanie; art. 230 i 232 ustawy o SW' },
      { t: 'Mówię „nie” i odchodzę bez słowa wyjaśnienia', r: 'meh', d: [1, 0, -6], who: 'bielik', b: 'Formalnie poprawnie. Ludzko – słabo. Zaufanie też jest narzędziem ochrony.' },
    ] },
    { quiz: ['ochrona-m39', 'ochrona-m36', 'kkw-m55', 'kkw-m56', 'kkw-m108', 'ochrona-m60', 'ochrona-m11', 'ochrona-m70', 'kurs-4-03'], n: 4, t: 'Odprawa u Bielika', who: 'bielik', say: 'Pytania z oddziału. Siadaj. Albo nie siadaj, i tak zaraz idziesz.' },
  ] });

rozdzial('rewizja', { t: 'Kontrola celi', bg: 'cela', pin: 'pawilonB', tag: 'Pawilon B · cela 14',
  outro: 'Cela przeszukana, protokół podpisany. „Doktor” uśmiecha się, jakby wszystko szło zgodnie z jego planem. Może idzie.',
  s: [
    { who: 'bielik', t: 'Kontrola celi mieszkalnej. Co jest w jednostce niedozwolone, określa zatwierdzony wykaz – więc nie wymyślasz zakazów z głowy. Telefon, ostre narzędzie czy alkohol to jednak klasyka.' },
    { hunt: { bg: 'cela', say: 'Pięć rzeczy nie powinno tu być. Reszta – zwykłe życie w celi. Nie zabieraj im jabłka, bo zrobisz się sławn{y|a} na cały pawilon.', q: 'Zaznacz przedmioty niedozwolone i niebezpieczne.',
      items: [
        { n: 'telefon pod poduszką', ic: '📱', x: 26, y: 58, bad: 1, x2: 'przedmiot niedozwolony – kanał kontaktu poza kontrolą' },
        { n: 'żyletka w bucie', ic: '🔪', x: 22, y: 86, bad: 1, x2: 'ostre narzędzie – zagrożenie dla życia i zdrowia' },
        { n: 'butelka „zacieru” za sedesem', ic: '🍾', x: 80, y: 70, bad: 1, x2: 'alkohol domowej roboty' },
        { n: 'tabletki luzem w kubku', ic: '💊', x: 42, y: 52, bad: 1, x2: 'leki nieznanego pochodzenia – leki wydaje służba zdrowia' },
        { n: 'grzałka z odsłoniętymi przewodami', ic: '🔌', x: 8, y: 84, bad: 1, x2: 'przerobione urządzenie – ryzyko pożaru i porażenia' },
        { n: 'książka', ic: '📖', x: 19, y: 66, x2: 'w porządku' },
        { n: 'radio', ic: '📻', x: 52, y: 48, x2: 'w porządku, jeśli zgodne z porządkiem wewnętrznym' },
        { n: 'kalendarz na ścianie', ic: '🗓️', x: 74, y: 37, x2: 'w porządku' },
        { n: 'szampon', ic: '🧴', x: 90, y: 50, x2: 'w porządku' },
        { n: 'jabłko', ic: '🍎', x: 58, y: 50, x2: 'w porządku – to jest jabłko' },
        { n: 'list od rodziny', ic: '✉️', x: 37, y: 29, x2: 'w porządku – korespondencja osadzonego' },
      ],
      okLine: 'Pięć na pięć, zero fałszywych alarmów. Masz oko. Uważaj, bo „Doktor” też to zauważył.',
      midLine: 'Prawie. Coś przegapił{eś|aś} albo zabrał{eś|aś} za dużo. Następnym razem wolniej i dokładniej.',
      badLine: 'Słabo. W celi zostało więcej niż wyniosł{eś|aś}. Kontrola celi to nie spacer.',
      z: 'zasady kontroli; wykaz przedmiotów niedozwolonych w jednostce' } },
    { nar: 'Gdy wynosisz telefon w worku, „Doktor” – wracający ze spaceru – mija cię w drzwiach: „Panie oddziałowy, ten telefon to nie mój, ale… gdyby zginął po drodze, rodzina kolegi umiałaby się odwdzięczyć. Dwieście złotych to dużo dla młodego funkcjonariusza”.' },
    { c: '200 zł za „zgubienie” telefonu.', o: [
      { t: 'Odmawiam, zabezpieczam telefon zgodnie z procedurą i opisuję propozycję w notatce', r: 'ok', d: [8, 5, -3], who: 'bielik', b: 'Druga próba „Doktora”, druga notatka. Prokuratorzy uwielbiają takie kolekcje.', x: 'Ujawniony przedmiot niedozwolony zabezpiecza się zgodnie z procedurami. Propozycja korzyści w zamian za naruszenie obowiązków to próba przekupstwa – przyjęcie jej byłoby przestępstwem.', z: 'art. 228 i 229 kk; zasady kontroli', set: 'notatkaTel' },
      { t: 'Biorę 200 zł i „gubię” telefon', r: 'karne', crime: '228_3', d: [-40, -15, 0], who: 'bielik', b: 'Za dwieście złotych sprzeda{łeś|łaś} mundur, legitymację i wolność. Kiepski kurs wymiany.', x: 'Przyjęcie korzyści majątkowej za zachowanie stanowiące naruszenie przepisów prawa to przestępstwo sprzedajności w typie kwalifikowanym.', z: 'art. 228 § 3 kk' },
      { t: 'Odmawiam, ale nie robię z tego sprawy', r: 'meh', d: [2, 0, 0], who: 'bielik', b: 'Odmowa dobra, ale bez notatki „Doktor” dalej jest czysty jak łza. Pisz. Zawsze pisz.' },
    ] },
    { quiz: ['ochrona-m09', 'ochrona-m10', 'ochrona-m04', 'kurs-3-08', 'kurs-3-11', 'ochrona-m34', 'kurs-4-14', 'ochrona-m63'], n: 4, t: 'Kontrole – pytania', who: 'bielik', say: 'Teoria do praktyki. Kontrole.' },
  ] });

rozdzial('widzenia', { t: 'Widzenia', bg: 'widzenia', pin: 'widzenia', tag: 'Sala widzeń · sobota',
  outro: 'Widzenia zakończone. Nikt nic nie przemycił – a przynajmniej nie na twojej zmianie. Pluszak był tylko pluszakiem. Tym razem.',
  s: [
    { who: 'bielik', t: 'Widzeniowy przed rozpoczęciem i po zakończeniu widzeń sprawdza zabezpieczenia techniczno-ochronne i to, czy w pomieszczeniu nie ma przedmiotów niedozwolonych. Zawsze. Nawet jak się spieszysz na obiad.' },
    { nar: 'Przy stoliku „Doktor” i jego żona. Pani w futrze uśmiecha się do ciebie znacząco. Kątem oka widzisz, jak wsuwa mężowi w dłoń coś małego, złożonego w kwadracik.' },
    { c: 'Reagujesz?', o: [
      { t: 'Podchodzę, przerywam przekazanie, przedmiot zabezpieczam i melduję przełożonemu – widzenie może zostać przerwane', r: 'ok', d: [7, 6, -4], who: 'bielik', b: 'W kwadraciku był znaczek pocztowy. Pod znaczkiem – coś, czego na poczcie nie sprzedają. Dobra robota.', x: 'Przedmioty dla osadzonego nie przechodzą „z ręki do ręki” przy stoliku – każdy podlega kontroli. Jeżeli uczestnicy widzenia naruszają jego porządek, funkcjonariusz nadzorujący może je przerwać.', z: 'kkw – przepisy o widzeniach; porządek wewnętrzny', set: 'widzeniaZona' },
      { t: 'Udaję, że nie widzę – to przecież żona', r: 'bad', d: [-8, -10, 2], who: 'bielik', b: 'Żony też potrafią przemycać. Zwłaszcza żony ludzi, których nazywają „Doktorem”.' },
    ] },
    { nar: 'Przy drzwiach stoi matka „Młodego”. Płacze: „Proszę pana, ja tylko na chwilę, przytulić syna. Nie mam żadnych papierów, ale przecież jestem matką”.' },
    { c: '„Młody” jest tymczasowo aresztowany. Co robisz?', o: [
      { t: 'Spokojnie tłumaczę, że widzenie z aresztowanym wymaga zgody organu, do którego dyspozycji pozostaje, i mówię, gdzie złożyć wniosek', r: 'ok', d: [5, 3, 5], who: 'bielik', b: 'Twardo, ale po ludzku. Tak się to robi.', x: 'Tymczasowo aresztowany ma prawo co najmniej do jednego widzenia w miesiącu z osobą najbliższą, ale zgodę na widzenie wydaje organ, do którego dyspozycji pozostaje. Widzenie odbywa się co do zasady pod nadzorem, w sposób uniemożliwiający bezpośredni kontakt.', z: 'kkw – przepisy o widzeniach tymczasowo aresztowanych', set: 'mlodyMatka' },
      { t: 'Wpuszczam ją na minutkę bez zgody – jest matką', r: 'dysc', kara: 'nagana', why: 'Dopuszczenie do widzenia z tymczasowo aresztowanym bez zgody organu dysponującego', d: [-8, -6, 6], who: 'bielik', b: 'Matka czy nie matka – zgodę wydaje sąd albo prokurator. Może właśnie ona jest świadkiem w sprawie. Nagana.', z: 'kkw; art. 230 ustawy o SW' },
    ] },
    { quiz: ['kkw-m09', 'kkw-m10', 'kkw-m12', 'kkw-m69', 'kkw-m70', 'kkw-m71', 'kkw-m72', 'ochrona-m37'], n: 4, t: 'Widzenia – pytania', who: 'bielik', say: 'Kto ile ma widzeń? Jedziemy.' },
  ] });

rozdzial('konwoj', { t: 'Konwój', bg: 'konwoj', pin: 'parking', tag: 'Konwój do szpitala · noc',
  outro: 'Konwój wrócił w komplecie. To najważniejsze zdanie w każdym raporcie z konwoju.',
  s: [
    { who: 'kierownik', t: 'Konwój do szpitala. „Siwy”, serce. Ty, Wróbel, kierowca. Konwój to co najmniej dwóch konwojentów, kierowca się nie liczy. Za bezpieczeństwo odpowiada dowódca konwoju. Dziś – ty.' },
    { who: 'wrobel', t: 'Ej, patrz, oficer z innej jednostki! Zasalutować?' },
    { c: 'Wróbel pyta, czy oddać honory mijanemu oficerowi.', o: [
      { t: 'Nie – podczas konwojowania osób pozbawionych wolności nie oddaje się honorów; oczy na konwojowanym', r: 'ok', d: [4, 3, 0], who: 'bielik', b: 'Dobrze. Oficer przeżyje brak salutu. Ucieczki „Siwego” moglibyście nie przeżyć – zawodowo.', x: 'Funkcjonariusz nie oddaje honorów m.in. podczas konwojowania osób pozbawionych wolności.', z: 'ceremoniał SW' },
      { t: 'Tak, regulamin to regulamin', r: 'bad', d: [-3, -3, 0], who: 'bielik', b: 'Regulamin mówi akurat odwrotnie. Wróbel salutuje, „Siwy” rozgląda się za wyjściem.' },
    ] },
    { nar: 'Szpital. „Siwy” prosi o toaletę: „Panie dowódco, zdejmijcie mi te bransoletki i dajcie chwilę samemu. W moim wieku to ja nawet do autobusu nie zdążę”.' },
    { c: 'Co robisz?', hint: 'Najważniejsza zasada konwoju: konwojowany nigdy bez ochrony i obserwacji.', o: [
      { t: 'Kajdanki zostają zgodnie z decyzją, toaleta pod obserwacją – Wróbel przy drzwiach, ja przy oknie', r: 'ok', d: [7, 8, -2], who: 'bielik', b: 'Okno w toalecie było otwarte. „Siwy” zobaczył ciebie przy nim i nagle przestało mu się tak spieszyć.', x: 'Konwojowany przez cały czas pozostaje pod ochroną i obserwacją konwoju – także w toalecie, w gabinecie lekarskim i na korytarzu szpitala.', z: 'zasady konwojowania' },
      { t: 'Zdejmuję kajdanki i czekam na korytarzu – to starszy pan', r: 'karne', crime: '231_3', d: [-15, -20, 4], who: 'bielik', b: 'Starszy pan wyszedł przez okno w toalecie. Kardiolog był pod wrażeniem jego kondycji. Prokurator też.', x: 'Pozostawienie konwojowanego bez ochrony i obserwacji łamie podstawową zasadę konwojowania. Jeżeli skutkiem jest istotna szkoda – jak ucieczka – wchodzi w grę odpowiedzialność karna za nieumyślne niedopełnienie obowiązków, niezależnie od dyscyplinarnej.', z: 'art. 231 § 3 kk; art. 230 ust. 4 ustawy o SW; zasady konwojowania' },
    ] },
    { quiz: ['ochrona-m18', 'ochrona-m19', 'ochrona-m20', 'ochrona-m21', 'ochrona-m22', 'ochrona-m23', 'kurs-4-09', 'kurs-4-10', 'kurs-4-11', 'kurs-4-17'], n: 4, t: 'Konwój – pytania', who: 'kierownik', say: 'Raport z konwoju przyjęty. Teraz pytania.', by: 'kierownik' },
  ] });

rozdzial('dyzurka', { t: 'Dyżurka', bg: 'dyzurka', pin: 'wartownia', tag: 'Monitoring · 19:05',
  outro: 'Ekrany gasną o świcie, a ty masz wrażenie, że widział{eś|aś} całe więzienie naraz. Bo widział{eś|aś}.',
  s: [
    { who: 'bielik', t: 'Monitoring służy bezpieczeństwu i porządkowi, nie oglądaniu seriali. Ucieczka, próba samobójcza, bunt – to zdarzenia nadzwyczajne. Na nie reaguje się natychmiast, a dokumentuje dokładnie.' },
    { nar: 'Na ekranie 4: bójka w świetlicy pawilonu A, trzech na jednego. Jednocześnie dzwoni telefon wewnętrzny – dyrektor Czapla: „Proszę mi natychmiast przynieść grafik na przyszły miesiąc!”.' },
    { c: 'Masz dwie rzeczy naraz. Co najpierw?', o: [
      { t: 'Ogłaszam alarm i kieruję siły do świetlicy, dyrektorowi melduję o zdarzeniu – grafik poczeka', r: 'ok', d: [7, 8, 0], who: 'dyrektor', b: 'Dobrze pan zrobił… zrobiła. Grafik poczeka. Ja też poczekam. Raz.', x: 'Bezpieczeństwo osób ma pierwszeństwo przed sprawami administracyjnymi. Prawidłowy obieg informacji i natychmiastowa reakcja to podstawa bezpieczeństwa jednostki.', z: 'zasady reagowania na zdarzenia; obowiązki dowódcy zmiany' },
      { t: 'Biegnę z grafikiem do dyrektora – szef to szef', r: 'bad', d: [-8, -12, -4], who: 'dyrektor', b: 'Grafik dostałem. A pobity osadzony dostał karetkę. Następnym razem proszę odwrotnie.' },
    ] },
    { nar: 'Godzina później. Ekran 7: w celi przejściowej osadzony siedzi pod ścianą, z przedramienia leje się krew. Samouszkodzenie.' },
    { c: 'Co robisz?', o: [
      { t: 'Natychmiast wysyłam funkcjonariuszy i wzywam służbę zdrowia, potem powiadamiam przełożonych', r: 'ok', d: [6, 8, 4], who: 'lekarka', b: 'Zdążyliśmy. Zszyłam, przeżyje. Dobrze, że pan… pani nie czekał{|a} na pozwolenie.', x: 'Samouszkodzenie wymaga natychmiastowych działań ratowniczych i powiadomienia przełożonych. Zdarzenie się dokumentuje – dokumentacja służy analizie przyczyn i zapobieganiu kolejnym.', z: 'zasady postępowania w zdarzeniach nadzwyczajnych' },
      { t: 'Najpierw dzwonię do dowódcy zmiany i czekam na decyzję', r: 'meh', d: [-2, -4, 0], who: 'lekarka', b: 'Dwie minuty czekania. Przy takim krwawieniu dwie minuty to dużo. Ratuje się najpierw, melduje równolegle.' },
    ] },
    { nar: 'Przed końcem zmiany wpada Wróbel, blady: „Słuchaj, na kamerze 2 widać, jak zostawiłem otwartą śluzę na pięć minut. Skasuj ten fragment, co? Nikt nie zauważy”.' },
    { c: 'Wróbel prosi o skasowanie nagrania.', o: [
      { t: 'Odmawiam – nagranie zostaje, a Wróbel ma sam zameldować przełożonemu', r: 'ok', d: [6, 4, -2], who: 'bielik', b: 'Wróbel dostanie rozmowę dyscyplinującą. Ty dosta{łbyś|łabyś} prokuratora. Dobra wymiana.', x: 'Zapis monitoringu to dowód. Usunięcie go, żeby ukryć błąd kolegi, to przekroczenie uprawnień i ukrywanie dokumentacji zdarzenia.', z: 'art. 231 § 1 kk; art. 230 ustawy o SW' },
      { t: 'Kasuję – kumpel to kumpel', r: 'karne', crime: '231_1', d: [-30, -10, 3], who: 'bielik', b: 'Audyt systemu pokazuje, kto i kiedy kasował nagranie. Twoje hasło, twoja godzina. Kumpel dostał rozmowę dyscyplinującą. Ty – zarzut.', x: 'Usunięcie zapisu monitoringu, by ukryć zdarzenie, to działanie na szkodę interesu publicznego z przekroczeniem uprawnień.', z: 'art. 231 § 1 kk' },
    ] },
    { quiz: ['kurs-3-03', 'kurs-3-04', 'kurs-3-05', 'kurs-3-10', 'kurs-3-16', 'kurs-3-19', 'kurs-3-20', 'ochrona-m26', 'ochrona-m27'], n: 4, t: 'Zdarzenia nadzwyczajne', who: 'bielik', say: 'Pytania z nocy. Kawa nie pomoże, wiedza tak.' },
  ] });

rozdzial('przyjecia', { t: 'Przyjęcie nowego', bg: 'przyjecia', pin: 'centralny', tag: 'Przyjęcia i ewidencja · niedziela, 21:10',
  outro: 'Ostatnia zmiana w przyjęciach. Wiesz już, że w tej służbie papier waży więcej niż kajdanki. Akt III zaliczony.',
  s: [
    { who: 'bielik', t: 'Przyjęcia. Tu każdy dokument jest ważniejszy od człowieka, który go przynosi. Brzmi brutalnie? Bez podstawy prawnej przyjęcie byłoby pozbawieniem wolności bez podstawy prawnej.' },
    { nar: 'Niedziela, 21:10. Policja doprowadza mężczyznę skazanego na karę pozbawienia wolności. Jest odpis wyroku. Nie ma nakazu przyjęcia. Policjant ziewa: „Dowieziemy jutro, przyjmijcie go, my mamy koniec zmiany”.' },
    { c: 'Brakuje nakazu przyjęcia.', o: [
      { t: 'Nie przyjmuję – zgłaszam dowódcy zmiany, który decyduje o odmowie przyjęcia pod nieobecność dyrektora; sporządzamy notatkę urzędową', r: 'ok', d: [7, 6, 0], who: 'bielik', b: 'Policjant przewrócił oczami tak mocno, że prawie zobaczył własne potylice. Ale dokumenty dowiózł w godzinę.', x: 'Każda podstawa przyjęcia skazanego musi być uzupełniona nakazem przyjęcia. O nieprzyjęciu decyduje dyrektor, a w czasie jego nieobecności dowódca zmiany. Odmowę dokumentuje notatka urzędowa (dane osoby, doręczone dokumenty, organ doprowadzający, przyczyna odmowy).', z: 'rozporządzenie MS w sprawie czynności administracyjnych związanych z wykonywaniem tymczasowego aresztowania oraz kar i środków przymusu skutkujących pozbawieniem wolności' },
      { t: 'Przyjmuję – papiery dojadą jutro', r: 'dysc', kara: 'ost_stan', why: 'Przyjęcie osoby bez kompletu dokumentów stanowiących podstawę przyjęcia', d: [-12, -6, 0], who: 'bielik', b: 'Papiery nie dojechały. Okazało się, że wyrok był już wykonany. Przez noc trzymał{eś|aś} człowieka bez podstawy. Ostrzeżenie o niepełnej przydatności na stanowisku – i ciesz się, że tylko tyle.', x: 'Bez kompletu dokumentów stanowiących podstawę przyjęcia nie wolno przyjąć osoby do jednostki.', z: 'rozporządzenie MS w sprawie czynności administracyjnych…; art. 230 i 232 ustawy o SW' },
    ] },
    { nar: 'Druga doprowadzona: tymczasowo aresztowana kobieta, z kompletem dokumentów. Trzeba przeprowadzić kontrolę osobistą. Wróbel: „Dobra, ja ją skontroluję, a ty idź po kawę”.' },
    { c: 'Kontrola osobista aresztowanej – kto ją przeprowadza?', o: [
      { t: 'Funkcjonariuszka, w pomieszczeniu bez osób postronnych – {wzywam koleżankę z innego posterunku|przeprowadzam ją sama, zgodnie z procedurą}, a Wróbel czeka za drzwiami', r: 'ok', d: [5, 4, 2], who: 'bielik', b: 'Kawa poczeka. Kontrola osobista nie. A Wróbel niech poczeka razem z kawą.', x: 'Kontrolę osobistą przeprowadza osoba tej samej płci co kontrolowana, w pomieszczeniu bez obecności osób postronnych.', z: 'art. 116 § 2 kkw i przepisy wykonawcze' },
      { t: 'Idę po kawę – Wróbel da radę', r: 'bad', d: [-5, -4, -2], who: 'bielik', b: 'Wróbel „dał radę”. Kontrola przeprowadzona przez mężczyznę – skarga, protokół do kosza, a żyletka w bucie i tak przeszła. Smacznej kawy.', x: 'Kontrolę osobistą przeprowadza osoba tej samej płci co kontrolowana.', z: 'art. 116 § 2 kkw' },
    ] },
    { quiz: ['ewidencja-m01', 'ewidencja-m03', 'ewidencja-m04', 'ewidencja-m10', 'ewidencja-m11', 'ewidencja-m12', 'ewidencja-m14', 'ochrona-m03', 'ochrona-m05'], n: 4, t: 'Przyjęcia – pytania', who: 'bielik', say: 'Ewidencja. Najnudniejsze pytania, najważniejsze skutki.' },
  ] });
/* ================= AKT IV – ŻYCIE CODZIENNE ================= */

rozdzial('grafik', { t: 'Grafik', bg: 'kadry', pin: 'administracja', tag: 'Administracja · grafik służb',
  outro: 'Grafik ułożony. Wróbel zamienił się z tobą tylko raz – i to oficjalnie. Postęp.',
  s: [
    { who: 'halinka', t: 'Czas służby: przeciętnie 40 godzin tygodniowo w okresie rozliczeniowym. Okresy są dwa: od 1 stycznia do 30 czerwca i od 1 lipca do 31 grudnia. Odpoczynek dobowy – co najmniej 11 godzin, tygodniowy – 35. Proszę nie robić takiej miny, to nie ja to wymyśliłam.' },
    { nar: 'Wróbel wpada z wiadomością: „Zamieniłem się z Kaczmarkiem na sobotnią nockę. Na gębę. Nikomu nie mówiłem, bo po co. Ty też się zamień ze mną na niedzielę, będzie git”.' },
    { c: 'Zamiana służby „na gębę”?', o: [
      { t: 'Zamiana tylko za zgodą przełożonego i z wpisem do grafiku – inaczej nikt nie wie, kto jest na stanowisku', r: 'ok', d: [5, 5, 0], who: 'bielik', b: 'Dokładnie. W nocy z soboty na niedzielę wartownia szukałaby Kaczmarka, a Kaczmarek – piwa.', x: 'Grafik służb ustala przełożony; zmiany wymagają jego decyzji. Dowódca zmiany musi wiedzieć, kto pełni służbę na którym stanowisku.', z: 'zasady organizacji czasu służby' },
      { t: 'Zgoda, jakoś to będzie', r: 'dysc', kara: 'rozmowa', why: 'Samowolna zamiana służby bez zgody przełożonego', d: [-5, -6, 2], who: 'bielik', b: 'Było. W niedzielę na wieżyczce nie było nikogo przez godzinę, bo każdy myślał, że drugi przyjdzie. Rozmowa dyscyplinująca dla was obu.', x: 'Przy przewinieniu mniejszej wagi przełożony może przeprowadzić udokumentowaną rozmowę dyscyplinującą zamiast postępowania.', z: 'art. 230 ust. 6 ustawy o SW' },
    ] },
    { c: 'Masz zaległy urlop. Wróbel podpowiada: „Zrzeknij się, to ci wypłacą”. Co odpowiadasz?', o: [
      { t: 'Nie można zrzec się prawa do urlopu wypoczynkowego – zaległy trzeba wykorzystać', r: 'ok', d: [4, 0, 0], who: 'halinka', b: 'Brawo! Urlop jest po to, żeby odpocząć, a nie żeby handlować. I trzeba go wykorzystać najpóźniej do końca września następnego roku.', x: 'Funkcjonariusz nie może zrzec się prawa do urlopu wypoczynkowego. Niewykorzystany urlop udziela się najpóźniej do końca września następnego roku; przy podziale na części jedna musi obejmować co najmniej 14 kolejnych dni kalendarzowych.', z: 'ustawa o SW – przepisy o urlopach' },
      { t: 'Dobry pomysł, napiszę wniosek', r: 'bad', d: [-3, 0, 0], who: 'halinka', b: 'Proszę nie pisać. Wniosek wróci do pana… pani z czerwonym kółkiem.' },
    ] },
    { quiz: ['pragmatyka-m20', 'pragmatyka-m21', 'pragmatyka-m22', 'pragmatyka-m23', 'prag-t58', 'pragmatyka-m30', 'pragmatyka-m31', 'pragmatyka-m38', 'pragmatyka-m25'], n: 4, t: 'Czas służby', who: 'halinka', say: 'Kilka pytań, zanim wydrukuję grafik.', by: 'halinka',
      okLine: 'Idealnie! Wydrukuję panu… pani grafik w kolorze.', midLine: 'Wydrukuję w czarno-białym.', badLine: 'Wydrukuję… i dołączę ściągę.' },
  ] });

rozdzial('pasek', { t: 'Pasek', bg: 'kadry', pin: 'administracja', tag: 'Kadry i finanse',
  outro: 'Pensja przyszła z góry, oświadczenie złożone, L4 – tylko na zdrowie. Dorosłe życie w mundurze.',
  s: [
    { who: 'halinka', t: 'Uposażenie zasadnicze i dodatki o charakterze stałym płacimy miesięcznie z góry, w pierwszym dniu roboczym miesiąca. Tak, z góry! Proszę się nie przyzwyczajać, że w życiu wszystko jest z góry.' },
    { nar: 'Środa. Bilety na mecz reprezentacji kupione pół roku temu. Grafik pokazuje nockę. Wróbel: „Weź L4, wszyscy tak robią. Lekarz mój kuzyn, wypisze ci przeziębienie”.' },
    { c: 'L4 na mecz?', o: [
      { t: 'Nie – składam wniosek o urlop wypoczynkowy albo proszę przełożonego o zamianę służby', r: 'ok', d: [5, 0, 0], who: 'bielik', b: 'Mecz obejrzysz z powtórek. A z teczki osobowej powtórek nie ma.' },
      { t: 'Biorę L4 od kuzyna Wróbla i idę na mecz', r: 'dysc', kara: 'nagana', why: 'Wykorzystywanie zwolnienia lekarskiego niezgodnie z jego celem', d: [-10, 0, 0], who: 'bielik', b: 'Kamera telewizyjna złapała cię w trzecim rzędzie, z szalikiem i bez cienia przeziębienia. Nagana – a kuzyn Wróbla ma własne kłopoty.', x: 'Na zwolnieniu lekarskim funkcjonariusz otrzymuje co do zasady 80% uposażenia. Prawidłowość orzekania i wykorzystywania zwolnień może być kontrolowana; wykorzystanie zwolnienia niezgodnie z jego celem może stanowić przewinienie dyscyplinarne. Wystawienie zaświadczenia bez choroby to osobny problem – lekarza.', z: 'ustawa o SW – przepisy o uposażeniu i kontroli zwolnień; art. 230' },
    ] },
    { who: 'halinka', t: 'A teraz najważniejsze: oświadczenie o stanie majątkowym. Przy nawiązaniu stosunku służbowego, potem co roku do 31 marca – według stanu na 31 grudnia – i przy rozwiązaniu stosunku służbowego. Obejmuje majątek osobisty i wspólny z małżonkiem.' },
    { c: 'Odziedziczył{eś|aś} po babci kawalerkę. Wpisywać?', o: [
      { t: 'Oczywiście – wpisuję wszystko zgodnie z prawdą', r: 'ok', d: [4, 0, 0], who: 'halinka', b: 'No i pięknie. Oświadczenie trzymamy 6 lat, potem niszczymy. Kawalerka niech panu… pani służy dłużej.', x: 'Funkcjonariusz składa oświadczenie o stanie majątkowym (majątek osobisty i objęty małżeńską wspólnością) przy nawiązaniu stosunku służbowego, co roku do 31 marca według stanu na 31 grudnia roku poprzedniego oraz przy rozwiązaniu stosunku służbowego.', z: 'art. 161 ustawy o SW' },
      { t: 'Nie – to przecież nie moja wina, że babcia mi zostawiła', r: 'dysc', kara: 'nagana', why: 'Zatajenie składnika majątku w oświadczeniu majątkowym', d: [-8, 0, 0], who: 'bielik', b: 'Oświadczenia są analizowane. Księgi wieczyste – publiczne. Babcia byłaby zawiedziona.', z: 'art. 161 ustawy o SW; art. 230' },
    ] },
    { quiz: ['prag-t51', 'prag-t38', 'prag-t48', 'prag-t70', 'prag-t50', 'pragmatyka-m09', 'pragmatyka-m12', 'pragmatyka-m32'], n: 4, t: 'Pieniądze i dokumenty', who: 'halinka', say: 'Jeszcze kilka pytań. Finansowych, czyli moich ulubionych.', by: 'halinka' },
  ] });

rozdzial('pogodzinach', { t: 'Po godzinach', bg: 'sklep', tag: 'Miasteczko · sobota wieczór',
  outro: 'Weekend przetrwany. Mundur w szafie, ale ty – nadal funkcjonariusz. Etyka nie kończy się o 15:00.',
  s: [
    { who: 'bielik', t: 'Zasady etyki zawodowej obowiązują i w służbie, i poza nią. Twoje „prywatne” życie jest prywatne do momentu, w którym trafia do internetu albo na komisariat.' },
    { nar: 'Znajomy z siłowni proponuje: „Potrzebujemy ochroniarza na bramkę w klubie, piątki i soboty. Gotówka do ręki, nikt nie musi wiedzieć”.' },
    { c: 'Dorobić na bramce?', o: [
      { t: 'Tylko po uzyskaniu pisemnej zgody przełożonego – składam wniosek', r: 'ok', d: [4, 0, 0], who: 'bielik', b: 'Zgoda albo odmowa przyjdzie w ciągu 14 dni. Bez zgody nie stajesz w drzwiach klubu, w którym za tydzień może bawić się twój osadzony na przepustce.', x: 'Funkcjonariusz może podjąć zajęcie zarobkowe poza służbą tylko za pisemną zgodą przełożonego. Przełożony odpowiada w ciągu 14 dni.', z: 'art. 160 ustawy o SW; rozporządzenie MS z 18.06.2010 r. (Dz.U. nr 122, poz. 834)' },
      { t: 'Biorę – gotówka nie śmierdzi', r: 'dysc', kara: 'nagana', why: 'Podjęcie zajęcia zarobkowego bez zgody przełożonego', d: [-8, 0, 0], who: 'bielik', b: 'W trzeci weekend przyszła kontrola skarbowa i policja. A ty w kamizelce „SECURITY” bez zgody przełożonego. Nagana. I wstyd na całe miasteczko.', z: 'art. 160 ustawy o SW; art. 230' },
    ] },
    { nar: 'Wesele kuzyna. Wypił{eś|aś} trzy piwa, jest pierwsza w nocy. Do domu 8 kilometrów, taksówki brak. Kluczyki w kieszeni.' },
    { c: 'Jak wracasz?', o: [
      { t: 'Zostaję na noc albo dzwonię po kogoś trzeźwego – nie siadam za kierownicę', r: 'ok', d: [4, 0, 0], who: 'bielik', b: 'Najlepsza decyzja tego wieczoru. Lepsza nawet niż rezygnacja z wódki.' },
      { t: 'Jadę – to tylko 8 kilometrów, znam drogę', r: 'karne', crime: '178a', d: [-30, 0, 0], who: 'bielik', b: 'Patrol na rondzie. Alkomat: 0,7 promila. To nie wykroczenie, to przestępstwo. Umyślne. A to w naszej służbie znaczy jedno.', x: 'Prowadzenie pojazdu w stanie nietrzeźwości (powyżej 0,5‰ we krwi lub 0,25 mg/dm³ w wydychanym powietrzu) jest przestępstwem; w stanie po użyciu alkoholu – wykroczeniem. Prawomocne skazanie funkcjonariusza za przestępstwo umyślne ścigane z oskarżenia publicznego kończy jego służbę.', z: 'art. 178a § 1 kk; art. 97 ust. 1 pkt 4 ustawy o SW' },
    ] },
    { quiz: ['pragmatyka-m13', 'pragmatyka-m37', 'prag-t04', 'prag-t32', 'kurs-p-19', 'prag-t49'], n: 3, t: 'Etyka i obowiązki', who: 'bielik', say: 'Poniedziałek. Kawa. Pytania.' },
  ] });

rozdzial('znajomy', { t: 'Znajomy z celi', bg: 'sklep', tag: 'Osiedlowy sklep · wtorek',
  outro: 'Granica między służbą a życiem prywatnym jest cienka. Dobrze, że pilnujesz jej jak bramy.',
  s: [
    { nar: 'Kolejka do kasy. Pani w futrze odwraca się do ciebie z uśmiechem. Żona „Doktora”. „O, pan… pani oddziałowy! Mieszka pan tu niedaleko, prawda? Niebieski blok, trzecie piętro?”' },
    { who: 'bielik', t: '(w twojej głowie) Jeśli ona zna twój adres, to on też. I to nie jest przypadek.' },
    { c: 'Żona „Doktora” zna twój adres i proponuje: „Mąż prosił pozdrowić. Może coś panu podrzucić, w ramach wdzięczności?”', o: [
      { t: 'Ucinam rozmowę, niczego nie przyjmuję i jeszcze dziś zgłaszam przełożonemu oraz piszę notatkę', r: 'ok', d: [7, 5, 0], who: 'kierownik', b: 'Dobrze, że od razu. Przeniesiemy „Doktora” na inny oddział i przyjrzymy się, skąd ma twoje dane.', x: 'Funkcjonariusz unika sytuacji, które mogą narazić go na zależność od osadzonych i ich rodzin. Próby nawiązania kontaktu poza służbą i znajomość danych osobowych funkcjonariusza przez osadzonego trzeba zgłosić przełożonemu – to sygnał werbowania.', z: 'zasady etyki zawodowej; bezpieczeństwo funkcjonariuszy', set: 'notatkaZona' },
      { t: 'Grzecznie dziękuję, ale nikomu nic nie mówię – nie chcę robić afery', r: 'meh', d: [-2, -4, 0], who: 'bielik', b: 'Afera zrobi się sama. Lepiej, żeby przełożony usłyszał o tym od ciebie, a nie od prokuratora.' },
      { t: 'Biorę „podziękowanie” – kawa w prezencie to nie łapówka', r: 'karne', crime: '228', d: [-40, -10, 0], who: 'bielik', b: 'W „kawie” była koperta. Przyjęcie korzyści w związku z pełnieniem funkcji publicznej – nawet bez żadnej przysługi w zamian.', x: 'Przyjęcie korzyści majątkowej lub osobistej (albo jej obietnicy) w związku z pełnieniem funkcji publicznej jest przestępstwem – nie trzeba nic zrobić w zamian.', z: 'art. 228 § 1 kk' },
    ] },
    { nar: 'Tydzień później na liście przyjętych widzisz nazwisko kolegi z podstawówki. Siedzieliście w jednej ławce. Trafia na twój oddział.' },
    { c: 'Kolega z dzieciństwa na twoim oddziale.', o: [
      { t: 'Informuję przełożonego o znajomości – niech zdecyduje, czy zmienić przydział', r: 'ok', d: [5, 3, 0], who: 'kierownik', b: 'Właściwie. Rotacja i przydziały są po to, żeby nikt nie był w konflikcie. Ani on, ani ty.', x: 'Znajomość z osadzonym może prowadzić do konfliktu interesów i spoufalania się – jednego z głównych zagrożeń z winy funkcjonariuszy. Przełożony powinien o niej wiedzieć.', z: 'zasady etyki zawodowej; organizacja ochrony' },
      { t: 'Nic nie mówię, ale trochę mu pomogę – stare czasy', r: 'bad', d: [-8, -5, 5], who: 'bielik', b: 'Trochę pomocy dziś, trochę „przysług” jutro. Spoufalanie się z osadzonymi to prosta droga na moją listę problemów.' },
    ] },
    { quiz: ['ochrona-m60', 'ochrona-m61', 'kurs-3-09', 'kurs-3-15', 'kurs-3-17', 'metodyka-m14'], n: 3, t: 'Bezpieczeństwo funkcjonariusza', who: 'bielik', say: 'Teoria bezpieczeństwa. Twojego, dla odmiany.' },
  ] });

rozdzial('fejsbuk', { t: 'Fejsbuk', bg: 'korytarz', pin: 'pawilonB', tag: 'Media społecznościowe',
  outro: 'Internet nie zapomina. Ale przynajmniej dziś nie zapamiętał niczego, czego nie powinien.',
  s: [
    { nar: 'Telefon wibruje. Wróbel wrzucił nowe zdjęcie: selfie na korytarzu pawilonu B, w mundurze, z kciukiem w górę. W tle widać tablicę z rozmieszczeniem cel i pęk kluczy. Podpis: „Pierwszy dzień jako król oddziału 👑”. 47 lajków.' },
    { c: 'Co robisz?', o: [
      { t: 'Dzwonię do Wróbla, żeby natychmiast usunął zdjęcie, i zgłaszamy to przełożonemu', r: 'ok', d: [6, 6, -1], who: 'bielik', b: 'Usunął po 40 minutach. Dobrze, że nie po 40 dniach. Rozmowa dyscyplinująca dla niego, spokój dla jednostki.', x: 'Informacje dotyczące bezpieczeństwa jednostki (rozmieszczenie, zabezpieczenia, klucze) podlegają ochronie. Funkcjonariusz, który ujawnia informację uzyskaną w związku z czynnościami służbowymi, jeśli może to narazić na szkodę prawnie chroniony interes, odpowiada karnie. Zasady etyki obowiązują także w sieci.', z: 'art. 266 § 2 kk; zasady etyki zawodowej', set: 'zglosilFoto' },
      { t: 'Daję lajka – śmieszne', r: 'bad', d: [-6, -6, 2], who: 'bielik', b: 'Lajk numer 48. Zrzut ekranu krąży już po pawilonie A. Osadzeni też mają rodziny z Facebookiem.' },
      { t: 'Komentuję: „Królu, co to za klucze? 😂”', r: 'bad', d: [-7, -6, 2], who: 'bielik', b: 'Właśnie zwróci{łeś|łaś} uwagę tysiąca osób na klucze. Brawo, analityku.' },
    ] },
    { quiz: ['ochrona-m40', 'ochrona-m41', 'ochrona-m44', 'ochrona-m66', 'kurs-3-15', 'pragmatyka-m13'], n: 3, t: 'Informacje chronione', who: 'bielik', say: 'Klauzule. Tak, będzie o klauzulach.' },
  ] });

/* ================= AKT V – PROPOZYCJA ================= */

rozdzial('propozycja', { t: 'Propozycja', bg: 'korytarz', pin: 'pawilonB', tag: 'Pawilon B · dwa lata później',
  outro: 'Najtrudniejsza decyzja w tej grze nie dotyczyła przepisów. Dotyczyła tego, kim chcesz być w mundurze.',
  s: [
    { nar: 'Minęły dwa lata służby przygotowawczej. Czas na opinię służbową – od niej zależy mianowanie do służby stałej.' },
    { review: { title: 'Opinia służbowa – koniec służby przygotowawczej', gate: 'nieprzydatny',
      lines: [
        { if: 'szczery', t: 'Od początku rzetelny w dokumentach – zgodnie z prawdą wypełnił ankietę personalną.' },
        { if: 'notatkaList', t: 'Konsekwentnie dokumentuje próby nakłaniania przez osadzonych do „przysług”.' },
        { if: 'meldunekNoc', t: 'Na stanowisku uzbrojonym czujny, prawidłowo melduje o zagrożeniach.' },
        { if: 'mlodyPomoc', t: 'Potrafi łączyć stanowczość z życzliwością wobec osadzonych.' },
        { if: 'notatkaZona', t: 'Prawidłowo reaguje na próby kontaktu ze strony rodzin osadzonych.' },
        { if: 'zglosilFoto', t: 'Dba o bezpieczeństwo informacji dotyczących jednostki.' },
        { if: 'wzialList', t: 'Zdarzało mu się pośredniczyć w kontaktach między osadzonymi – wymaga nadzoru.' },
        { if: 'kary', t: 'W okresie służby przygotowawczej ukarany dyscyplinarnie.' },
      ],
      hi: 'Wyróżniająca. Tak, sam to napisałem. Nie, nie byłem pod wpływem.', mid: 'Pozytywna. Mianowanie do służby stałej – gratuluję. Nie spocznij na laurach, bo laury są w magazynie u Dzięcioła.', lo: 'Opinia stwierdza nieprzydatność do służby. Przykro mi, ale nie będę kłamał w dokumencie – to też przestępstwo.' } },
    { who: 'bielik', t: 'Mianowanie do służby stałej. Mundur jest teraz naprawdę twój. Dzięcioł płakał, oddając go na własność.' },
    { nar: 'Wieczór na oddziale. „Doktor” od miesięcy jest uprzejmy, pamięta o twoich urodzinach, raz nawet ostrzegł cię przed „nerwowym” współosadzonym. Dziś prosi o rozmowę przy drzwiach celi.' },
    { who: 'doktor', t: 'Panie oddziałowy, będę szczery. Jeden telefon. Mały, bez aparatu. Pięć tysięcy złotych, gotówką, dostarczone tam, gdzie pan zechce. Wiem, gdzie pan mieszka – niebieski blok, trzecie piętro. Mówię to, żeby pan wiedział, że jestem… dobrze poinformowany.' },
    { c: 'Pięć tysięcy za telefon – i ukryta groźba.', hint: 'To jest ta decyzja. Wszystkie poprzednie były treningiem.', o: [
      { t: 'Odmawiam stanowczo, natychmiast melduję przełożonemu i piszę szczegółową notatkę – z groźbą włącznie', r: 'ok', d: [10, 8, -8], set: 'notatka21', who: 'bielik', b: 'Właśnie po to są notatki. Groźba wobec funkcjonariusza to sprawa dla prokuratora – po stronie „Doktora”.', x: 'Propozycja korzyści za naruszenie obowiązków to próba przekupstwa, a nawiązanie do miejsca zamieszkania – groźba. Natychmiastowe zgłoszenie i udokumentowanie chroni funkcjonariusza i pozwala jednostce zareagować (np. przeniesieniem osadzonego).', z: 'art. 228–229 kk; obowiązki funkcjonariusza', go: 'zemsta' },
      { t: 'Odmawiam, ale nikomu nie mówię – boję się, że naprawdę coś zrobi', r: 'meh', d: [-4, -4, 0], who: 'bielik', b: 'Strach jest zrozumiały. Milczenie – nie. Bez zgłoszenia jesteś z nim sam{|a}. A on właśnie tego chce.', go: 'zemsta' },
      { t: 'Biorę – pięć tysięcy to pięć tysięcy, a on wie, gdzie mieszkam', r: 'karne', crime: '228_3', d: [-50, -20, 0], who: 'bielik', b: 'Telefon znaleziono przy kontroli tydzień później. Monitoring i rozmowy pokazały resztę. „Doktor” sam cię wskazał – w zamian za łagodniejsze potraktowanie.', x: 'Przyjęcie korzyści za zachowanie stanowiące naruszenie przepisów to przestępstwo z art. 228 § 3 kk. Ten, kto dał korzyść, a następnie zawiadomił organ ścigania i ujawnił okoliczności, zanim organ się o nich dowiedział, może uniknąć kary (art. 229 § 6 kk) – dlatego przekupujący tak chętnie „sypią” przekupionych.', z: 'art. 228 § 3 i art. 229 § 6 kk' },
    ] },
    { lab: 'zemsta' },
    { nar: 'Tydzień później. Kierownik Jastrząb wzywa cię do gabinetu. Ma poważną minę i kartkę z pieczątką prokuratury.' },
    { c: '„Doktor” złożył zawiadomienie, że pobi{łeś|łaś} go w celi. Co robisz?', o: [
      { t: 'Idę na rozmowę i mówię prawdę', r: 'susp', crime: 'falsz', fake: true, d: [0, 0, 0], who: 'kierownik', b: 'Wiem. Ale procedury muszą zadziałać. Proszę się przygotować na kilka trudnych tygodni.' },
    ], shuffle: false },
    { who: 'bielik', t: 'Wróci{łeś|łaś}. Cał{y|a}, oczyszczon{y|a}, z wyrównaną pensją. „Doktor” pojechał na inny oddział i ma teraz własną sprawę. Wiesz, co jest najlepsze? Że miał{eś|aś} notatkę. Albo że prawda i tak się obroniła.' },
    { quiz: ['ochrona-m60', 'kurs-3-09', 'kurs-3-08', 'prag-t54', 'prag-t22', 'kurs-p-18'], n: 3, t: 'Po burzy', who: 'bielik', say: 'Wyciągnijmy wnioski. Pytania.' },
  ] });

/* ================= AKT VI – AWANS ================= */

rozdzial('raport', { t: 'Raport o przeniesienie', bg: 'kadry', pin: 'administracja', tag: 'Administracja · gabinet dyrektora',
  outro: 'Decyzja zapadła. Teraz już tylko… nauka, praca i egzamin. Bułka z masłem. Bardzo twarda bułka.',
  s: [
    { forcepath: true, goto: 'po_wyborze' },
    { who: 'dyrektor', t: 'Proszę usiąść. Mam pana… pani opinię, mam pana… pani raport. Pytanie brzmi: co dalej? Na stanowiskach chorążych wymaga się co najmniej tytułu licencjata lub równorzędnego, a stopnie w korpusie chorążych nadaje Dyrektor Generalny. Pan… pani ma za sobą studia psychologiczne, prawda?' },
    { who: 'bielik', t: 'Do tej pory pilnował{eś|aś}, żeby nie uciekli. Możesz pilnować dalej – jako dowódca zmiany. Albo zacząć pilnować, żeby chcieli zostać ludźmi – jako psycholog. Jedno i drugie to służba.' },
    { if: 'kary', goto: 'kary_raport' },
    { go: 'wybor' },
    { lab: 'kary_raport' },
    { who: 'dyrektor', t: 'Widzę w teczce kary dyscyplinarne. Nie przekreślają awansu, ale będą o panu… pani świadczyć, dopóki nie ulegną zatarciu. Proszę o tym pamiętać na każdej zmianie.' },
    { lab: 'wybor' },
    { c: 'Którą drogę wybierasz?', shuffle: false, o: [
      { t: 'Zostaję w dziale ochrony – chcę zostać dowódcą zmiany', r: 'ok', path: 'ochrona', d: [3, 3, 0], who: 'kierownik', b: 'Dobrze. Potrzebuję ludzi, którzy wiedzą, po co jest procedura. Od jutra uczysz się dowodzić. Wróbel jest w twojej zmianie. Współczuję.' },
      { t: 'Przechodzę do działu penitencjarnego – na stanowisko psychologa', r: 'ok', path: 'psych', d: [3, 0, 3], who: 'sroka', b: 'Witamy w penitencjarnym! U nas zamiast kluczy są testy, a zamiast alarmów – rozmowy. Choć alarmy też bywają.' },
    ] },
    { lab: 'po_wyborze' },
    { quiz: ['prag-t31', 'pragmatyka-m33', 'prag-t30', 'prag-t53', 'prag-t66', 'prag-t13', 'prag-t36'], n: 3, t: 'Kadry i awans', who: 'halinka', say: 'Zanim wypiszę rozkaz personalny – małe pytania o awans.', by: 'halinka' },
  ] });

/* ---- ścieżka: psycholog ---- */

rozdzial('gabinet', { t: 'Nowy gabinet', bg: 'gabinet', pin: 'centralny', path: 'psych', tag: 'Dział penitencjarny · psycholog',
  outro: 'Pierwszy tydzień za biurkiem psychologa. Krzesła ustawione naprzeciw siebie, chusteczki pod ręką. Ten pokój widział już wiele. Teraz zobaczy ciebie.',
  s: [
    { who: 'sroka', t: 'Twój pierwszy pacjent… to znaczy skazany. Zgadnij kto. „Młody”. Już prawomocnie skazany, idzie do klasyfikacji. Komisja penitencjarna czeka na twoje badanie.' },
    { if: 'mlodyPomoc', goto: 'mlody_ufa' },
    { if: 'mlodyMatka', goto: 'mlody_ufa' },
    { who: 'mlody', t: 'To pan… pani? Pamiętam pana… panią z oddziału. Nie mam nic do powiedzenia. I nie zgadzam się na żadne testy.' },
    { go: 'badanie' },
    { lab: 'mlody_ufa' },
    { who: 'mlody', t: 'O, to pan… pani! Pan… pani mi wtedy pomogła z mamą. Dobra. Mogę gadać. Ale testów nie lubię.' },
    { stat: [0, 0, 5] },
    { lab: 'badanie' },
    { c: '„Młody” – skazany młodociany – odmawia zgody na badanie psychologiczne. Co robisz?', o: [
      { t: 'Wyjaśniam cel badania i buduję kontakt; gdy dalej odmawia, informuję – dyrektor może wystąpić do sędziego penitencjarnego o zarządzenie badania', r: 'ok', d: [6, 0, 6], who: 'sroka', b: 'Właśnie tak. Zwykle wystarcza rozmowa. A jak nie – jest procedura, a nie przymus „na siłę”.', x: 'Badania osobopoznawcze służą m.in. klasyfikacji i planowaniu oddziaływań. Bez zgody skazanego badanie może zarządzić sędzia penitencjarny; gdy młodociany nie wyraża zgody, dyrektor występuje do sędziego penitencjarnego.', z: 'kkw – przepisy o badaniach skazanych' },
      { t: 'Każę mu siadać i wypełniać, bo inaczej dostanie karę dyscyplinarną', r: 'bad', d: [-6, 0, -10], who: 'sroka', b: 'Groźba zamiast diagnozy. Dostaniesz wyniki, które nic nie znaczą, i skazanego, który już nic ci nie powie.' },
      { t: 'Odpuszczam – bez badania też napiszę opinię', r: 'bad', d: [-6, 0, 0], who: 'sroka', b: 'Opinia bez badania to wróżenie z fusów. Psycholog pisze o tym, co zbadał, nie o tym, co mu się wydaje.' },
    ] },
    { who: 'sroka', t: 'Pamiętaj o kolejności: diagnoza, prognoza, planowanie, realizacja, ocena. Indywidualny program oddziaływania opracowuje wychowawca z udziałem skazanego – ty wnosisz diagnozę i zalecenia.' },
    { quiz: ['psy-m01', 'psych-proc-m04', 'psych-proc-m05', 'psych-proc-m14', 'psych-proc-m20', 'penit-m10', 'kkw-m23', 'kkw-m24', 'psy-m02'], n: 4, t: 'Klasyfikacja i badania', who: 'sroka', say: 'Pytania z działu penitencjarnego. Bez stresu. No, z małym.', by: 'sroka' },
  ] });

rozdzial('kryzys', { t: 'Noc kryzysowa', bg: 'korytarz', pin: 'pawilonA', path: 'psych', tag: 'Pawilon A · 22:30',
  outro: 'Ta noc nie trafi do kroniki. I bardzo dobrze. Najlepsze interwencje to te, po których nic złego się nie dzieje.',
  s: [
    { who: 'sroka', t: 'Dzwonił oddziałowy z pawilonu A. Nowy osadzony, Kowal. Od trzech dni nie wychodzi na spacer, oddaje komuś papierosy i mówi, że „już niedługo nie będzie nikomu przeszkadzał”. Zgłosiłam to od razu i uruchomiłam procedurę. Teraz ty.' },
    { c: 'Co robisz?', o: [
      { t: 'Rozmawiam z nim jeszcze dziś, oceniam ryzyko i zalecam wzmożone oddziaływania i obserwację; uprzedzam, żeby nie zostawał sam w celi', r: 'ok', d: [8, 6, 6], who: 'sroka', b: 'Tak jest. Rozmowa trwała dwie godziny. Kowal pierwszy raz od tygodnia zjadł kolację.', x: 'Wycofanie z kontaktów, rozdawanie rzeczy i wypowiedzi o bezsensie życia to sygnały ostrzegawcze. Przy podejrzeniu ryzyka samobójczego reaguje się od razu: informacja trafia do wychowawcy i psychologa, psycholog niezwłocznie ocenia ryzyko i zaleca wzmożone oddziaływania, a osadzonego nie zostawia się samego w celi.', z: 'procedury zapobiegania samobójstwom w jednostkach SW' },
      { t: 'Umawiam go na poniedziałek – każdy tak mówi, jak chce zwrócić na siebie uwagę', r: 'bad', d: [-12, -10, -6], who: 'sroka', b: 'Na szczęście oddziałowy był czujny i w nocy wezwał pomoc. Ale to on uratował sytuację, nie ty. „Każdy tak mówi” to najniebezpieczniejsze zdanie w tej pracy.', x: 'Sygnałów zagrożenia samobójstwem nie ocenia się „na oko” i nie odkłada. Próba samobójcza to zdarzenie nadzwyczajne.', z: 'procedury zapobiegania samobójstwom w jednostkach SW' },
    ] },
    { nar: 'Następnego dnia „Doktor” – przeniesiony na pawilon A – rani się płytko w przedramię i żąda przeniesienia do innej jednostki, „bo tu go prześladują”.' },
    { c: 'Jak oceniasz zachowanie „Doktora”?', o: [
      { t: 'Najpierw pomoc medyczna, potem rzetelna ocena – jeśli samouszkodzenie ma charakter instrumentalny, opisuję to w opinii', r: 'ok', d: [7, 4, 0], who: 'sroka', b: 'Dokładnie. Instrumentalne samouszkodzenie to próba wymuszenia decyzji. Twoja opinia pozwoli dyrektorowi wystąpić do sądu penitencjarnego o obciążenie kosztami leczenia.', x: 'Samouszkodzenie, które ma wymusić decyzję organu (np. przeniesienie), ma tło instrumentalne. Gdy w opinii psychologa samouszkodzenie ma taki charakter, dyrektor może wystąpić do sądu penitencjarnego o obciążenie skazanego kosztami leczenia.', z: 'art. 119 kkw' },
      { t: 'To manipulant – nie pomagam, niech się wykrwawia dla nauczki', r: 'karne', crime: '231_1', d: [-30, -10, -15], who: 'sroka', b: 'Odmowa pomocy rannemu – nawet manipulantowi – to nie „nauczka”. To niedopełnienie obowiązków z narażeniem zdrowia człowieka.', x: 'Działania ratownicze podejmuje się zawsze. Ocena motywów przychodzi potem.', z: 'art. 231 § 1 kk; zasady postępowania przy samouszkodzeniach' },
    ] },
    { quiz: ['psych-klin-m01', 'psych-klin-m02', 'psych-klin-m12', 'psych-klin-m13', 'psych-klin-m16', 'psych-klin-m36', 'kom-094', 'kom-139', 'psych-proc-m03', 'kom-066'], n: 4, t: 'Profilaktyka samobójstw', who: 'sroka', say: 'Trudny temat. Tym bardziej trzeba go znać.', by: 'sroka' },
  ] });

rozdzial('opinia', { t: 'Opinia dla sądu', bg: 'sad', pin: 'administracja', path: 'psych', tag: 'Posiedzenie sądu penitencjarnego',
  outro: 'Opinia złożona, podpis twój, prawda – też twoja. Sędzia Łabędzka skinęła głową. U niej to równowartość owacji na stojąco.',
  s: [
    { who: 'sedzia', t: 'Sędzia penitencjarna Łabędzka. Rozpoznajemy wniosek skazanego o warunkowe przedterminowe zwolnienie. Proszę o opinię psychologiczną. Rzetelną, nie ładną.' },
    { nar: 'Dzień wcześniej. Do drzwi gabinetu puka „Siwy”: „Pani… panie psychologu, czternaście lat siedzę. Niech pan… pani napisze ładnie. Rodzina będzie wdzięczna – synowa już przygotowała kopertę. Dla dzieci pana… pani, na wakacje”.' },
    { c: 'Opinia dla „Siwego”.', o: [
      { t: 'Odmawiam przyjęcia czegokolwiek, piszę notatkę i opinię zgodną z wynikami badań', r: 'ok', d: [9, 3, -2], who: 'sedzia', b: 'Opinia rzetelna, z wnioskami i zaleceniami. Dokładnie tego sąd potrzebuje.', x: 'Ostatnim elementem opinii psychologicznej są wnioski lub zalecenia dotyczące postępowania ze skazanym. Psycholog uwzględnia też ocenę ryzyka powrotu do przestępstwa. Przyjęcie korzyści za opinię byłoby przestępstwem.', z: 'procedury opiniowania; art. 228 kk', set: 'opiniaRzetelna' },
      { t: 'Biorę kopertę i piszę opinię „na tak”', r: 'karne', crime: '228_3', d: [-50, -15, 0], who: 'bielik', b: 'Synowa „Siwego” miała w torebce dyktafon. Na wszelki wypadek. Rodzina, jak widać, przewidująca.', x: 'Przyjęcie korzyści za wydanie opinii niezgodnej z prawdą to sprzedajność w typie kwalifikowanym.', z: 'art. 228 § 3 kk' },
      { t: 'Bez koperty, ale wpisuję do opinii lepsze wyniki badań, niż wyszły – szkoda chłopa', r: 'karne', crime: '271', d: [-35, -10, 5], who: 'sedzia', b: 'Wyniki w opinii nie zgadzają się z protokołami badań. Biegły z zewnątrz to zauważył. Wpisanie nieprawdziwych wyników to nie „ładne pisanie” – to poświadczenie nieprawdy.', x: 'Ocena psychologa jest jego zawodowym wnioskiem, ale wyniki badań to fakty. Funkcjonariusz publiczny, który w dokumencie poświadcza nieprawdę co do okoliczności mającej znaczenie prawne, popełnia przestępstwo.', z: 'art. 271 § 1 kk' },
    ] },
    { quiz: ['psych-proc-m07', 'psych-proc-m08', 'psych-proc-m09', 'psych-proc-m10', 'psych-proc-m15', 'penit-m25', 'psy-m06', 'kkw-m59'], n: 4, t: 'Opiniowanie', who: 'sedzia', say: 'Na koniec posiedzenia – kilka pytań do pani… pana psycholog. Proszę się nie stresować. Bardzo.', by: 'sedzia' },
  ] });

/* ---- ścieżka: dowódca zmiany ---- */

rozdzial('dowodca', { t: 'Dowódca zmiany', bg: 'dyzurka', pin: 'wartownia', path: 'ochrona', tag: 'Wartownia · odprawa zmiany',
  outro: 'Pierwsza zmiana jako dowódca. Wszyscy na stanowiskach, stan się zgadza, Wróbel nawet nie spóźnił się na odprawę. Cuda się zdarzają.',
  s: [
    { who: 'kierownik', t: 'Od dziś dowodzisz zmianą. Za organizację służby ochronnej podczas zmiany odpowiada dowódca. W zakładzie typu zamkniętego zmiana liczy co najmniej trzech funkcjonariuszy. A ty odpowiadasz za całą zmianę – łącznie z Wróblem.' },
    { nar: '23:00. Wróbel melduje przez radio z posterunku: „Szefie, ja tu już nic nie mam do roboty, jest cicho. Mogę zejść wcześniej? Dziewczyna czeka”.' },
    { c: 'Wróbel chce zejść z posterunku przed czasem.', o: [
      { t: 'Nie – posterunek opuszcza się po zakończeniu służby albo za zgodą przełożonego, a ja jej nie daję bez zmiennika', r: 'ok', d: [5, 6, -2], who: 'wrobel', b: 'No dobra, szefie… Dziewczyna poczeka. Ona i tak zawsze czeka.', x: 'Funkcjonariusz może opuścić posterunek po zakończeniu służby lub za zgodą przełożonego. Dowódca zmiany nie zostawia stanowiska bez obsady.', z: 'zasady pełnienia służby ochronnej' },
      { t: 'Idź, kolego, jakoś to będzie', r: 'dysc', kara: 'nagana', why: 'Zezwolenie na opuszczenie posterunku bez zmiennika', d: [-8, -10, 4], who: 'bielik', b: 'Posterunek pusty przez dwie godziny. Akurat wtedy przyjechała kontrola z okręgu. Nagana – dla dowódcy, bo to dowódca pozwolił.' },
    ] },
    { nar: '06:00, apel poranny. Oddziałowy pawilonu A melduje: stan niezgodny – brakuje jednego osadzonego. Cela 7, łóżko puste, krata w oknie nienaruszona.' },
    { c: 'Stan się nie zgadza. Twoje pierwsze polecenie?', o: [
      { t: 'Ponowne sprawdzenie stanu, natychmiastowy meldunek do dyrektora, alarm i przeszukanie terenu; pościg, gdy znany jest kierunek', r: 'ok', d: [7, 8, 0], who: 'kierownik', b: 'Znaleźliśmy go w pralni – schował się w koszu z praniem. Nie zdążył wyjść poza mur. Dobra reakcja, szybka i według procedury.', x: 'Ucieczka to zdarzenie nadzwyczajne. Ogłoszenie alarmu i zorganizowanie pościgu należą do działań ochronnych; pościg podejmuje się, gdy zbieg jest w polu widzenia albo znany jest kierunek ucieczki.', z: 'zasady ochrony jednostek – działania ochronne' },
      { t: 'Liczymy jeszcze trzy razy, zanim komukolwiek powiemy – może się pomylili', r: 'bad', d: [-8, -10, 0], who: 'kierownik', b: 'Trzy przeliczenia to dwadzieścia minut. Przez dwadzieścia minut można wyjść przez pralnię, załadownię i parking. Prawie tak zrobił.' },
    ] },
    { quiz: ['kurs-4-02', 'ochrona-m51', 'ochrona-m24', 'ochrona-m25', 'ochrona-m26', 'ochrona-m12', 'ochrona-m13', 'ochrona-m53', 'kurs-3-09'], n: 4, t: 'Dowodzenie zmianą', who: 'kierownik', say: 'Pytania dla dowódcy. Bez litości.', by: 'kierownik' },
  ] });

rozdzial('alarm', { t: 'Alarm', bg: 'korytarz', pin: 'pawilonA', path: 'ochrona', tag: 'Pawilon A · 14:20',
  outro: 'Zdarzenie opanowane, ŚPB użyte zgodnie z ustawą, nikt nie przekroczył granicy. Za to Wróbel przekroczył swój rekord w bieganiu po schodach.',
  s: [
    { nar: 'Alarm z pawilonu A. Osadzony wymachuje nogą od stołka w świetlicy, krzyczy, że „zabije pierwszego, który podejdzie”. Obok dwóch innych osadzonych, przerażonych.' },
    { c: 'Jesteś na miejscu jako dowódca zmiany. Jak działasz?', o: [
      { t: 'Wzywam do porzucenia przedmiotu i uprzedzam o użyciu ŚPB; gdy rusza na innych – obezwładniamy go siłą fizyczną i zakładamy kajdanki, potem lekarz i dokumentacja', r: 'ok', d: [7, 8, 0], who: 'bielik', b: 'Proporcjonalnie, skutecznie, z dokumentacją. Tak wygląda użycie ŚPB zgodne z ustawą.', x: 'Przy zamachu na życie lub zdrowie funkcjonariusz może sam podjąć decyzję o użyciu ŚPB. Stosuje się je proporcjonalnie do zagrożenia, a od wezwania można odstąpić tylko wtedy, gdy zwłoka groziłaby niebezpieczeństwem. Po ustaniu przyczyny niezwłocznie przestaje się stosować ŚPB i sporządza wymaganą dokumentację.', z: 'ustawa o ŚPB: art. 6, art. 34, art. 35' },
      { t: 'Czekamy na decyzję dyrektora o użyciu ŚPB – nie chcę odpowiadać', r: 'bad', d: [-8, -10, 0], who: 'bielik', b: 'Przy zamachu na życie lub zdrowie decyzję możesz – i powinien{eś|naś} – podjąć sam{|a}. W czasie, gdy czekał{eś|aś} na telefon, jeden z osadzonych dostał nogą od stołka.' },
    ] },
    { nar: 'Osadzony obezwładniony, skuty, leży na korytarzu. Starszy kapral Mazur – znany z „krótkiego lontu” – podchodzi i kopie go w żebra. Raz. Bierze zamach drugi raz.' },
    { c: 'Kolega bije skutego osadzonego. Co robisz?', hint: 'Bezczynność też jest decyzją.', o: [
      { t: 'Natychmiast go powstrzymuję, odsuwam od osadzonego, wzywam lekarza i melduję o zdarzeniu', r: 'ok', d: [10, 5, 8], who: 'bielik', b: 'To był najważniejszy moment twojej służby. I zachował{eś|aś} się jak funkcjonariusz, a nie jak kolega z drużyny.', x: 'Funkcjonariusz publiczny, który wbrew obowiązkowi dopuszcza do znęcania się nad osobą pozbawioną wolności, podlega takiej samej karze jak sprawca. Niehumanitarne traktowanie osadzonych to także naruszenie dyscypliny służbowej.', z: 'art. 247 § 1 i § 3 kk; art. 230 ust. 3 pkt 3 ustawy o SW', set: 'powstrzymal' },
      { t: 'Odwracam wzrok – osadzony sam się prosił', r: 'karne', crime: '247_3', d: [-45, -10, -20], who: 'bielik', b: 'Osadzony „sam się prosił”, a ty sam{|a} odpowiesz jak sprawca. Kodeks karny nie zna kategorii „kolega z mojej zmiany”.', x: 'Dopuszczenie – wbrew obowiązkowi – do znęcania się nad osobą prawnie pozbawioną wolności jest zagrożone taką samą karą jak samo znęcanie.', z: 'art. 247 § 3 kk' },
      { t: 'Dołączam – trzeba mu pokazać, gdzie jest jego miejsce', r: 'karne', crime: '247', d: [-50, -10, -25], who: 'bielik', b: 'Monitoring w korytarzu ma dźwięk. I obraz. W bardzo dobrej rozdzielczości.', z: 'art. 247 § 1 kk' },
    ] },
    { quiz: ['spb-m01', 'spb-m11', 'spb-m15', 'spb-m20', 'spb-m26', 'spb-m33', 'kurs-5-03', 'kurs-5-05', 'kurs-5-18', 'pragmatyka-m16'], n: 4, t: 'ŚPB w praktyce', who: 'bielik', say: 'Po akcji – pytania. Tak, zawsze są pytania.' },
  ] });

rozdzial('notatka', { t: 'Notatka', bg: 'dyzurka', pin: 'administracja', path: 'ochrona', tag: 'Wartownia · po zdarzeniu',
  outro: 'Dokumentacja kompletna i prawdziwa. Mazur ma swoją sprawę, ty masz czyste sumienie. To lepszy układ.',
  s: [
    { who: 'bielik', t: 'Po użyciu ŚPB sporządza się wymaganą dokumentację. Notatka ma być prawdziwa. Nie „ładna”, nie „korzystna dla zespołu”. Prawdziwa.' },
    { if: '!powstrzymal', goto: 'bez_mazura' },
    { nar: 'Mazur czeka na ciebie przy wartowni: „Słuchaj, w notatce napisz, że się przewrócił przy obezwładnianiu. Wszyscy tak piszą. Jesteśmy zespołem, nie?”' },
    { c: 'Co wpisujesz do notatki?', o: [
      { t: 'Opisuję wszystko zgodnie z prawdą – łącznie z zachowaniem Mazura', r: 'ok', d: [9, 4, 4], who: 'kierownik', b: 'Trudne. Właściwe. Sprawa Mazura pójdzie do prokuratury, a ty zosta{łeś|łaś} świadkiem, nie współsprawcą.', x: 'Funkcjonariusz publiczny, który w dokumencie poświadcza nieprawdę co do okoliczności mającej znaczenie prawne, popełnia przestępstwo. Rzetelna dokumentacja zdarzeń służy też ochronie funkcjonariuszy, którzy działali zgodnie z prawem.', z: 'art. 271 § 1 kk; ustawa o ŚPB – dokumentowanie użycia', set: 'notatkaPrawda' },
      { t: 'Piszę, że osadzony się przewrócił – zespół to zespół', r: 'karne', crime: '271', d: [-40, -5, -10], who: 'bielik', b: 'Zespół to zespół. Prokurator też ma zespół – i nagrania z kamer. Twoja notatka mówi jedno, monitoring drugie.', x: 'Poświadczenie nieprawdy w notatce służbowej to przestępstwo z art. 271 § 1 kk.', z: 'art. 271 § 1 kk' },
    ] },
    { go: 'koniec_notatki' },
    { lab: 'bez_mazura' },
    { nar: 'Piszesz notatkę o zdarzeniu w świetlicy. Kierownik Jastrząb pyta o kopnięcie Mazura, które zarejestrowała kamera. Nie powstrzymał{eś|aś} go wtedy. Teraz możesz przynajmniej powiedzieć prawdę.' },
    { c: 'Kierownik pyta o zachowanie Mazura.', o: [
      { t: 'Mówię prawdę i uzupełniam notatkę', r: 'meh', d: [2, 2, 0], who: 'kierownik', b: 'Lepiej późno niż wcale. Ale „późno” w tej sprawie oznaczało jeden kopniak za dużo.', set: 'notatkaPrawda' },
      { t: 'Twierdzę, że niczego nie widział{em|am}', r: 'karne', crime: '271', d: [-40, -5, -10], who: 'bielik', b: 'Kamera pokazuje, że stał{eś|aś} metr od nich i patrzył{eś|aś}. Fałsz w notatce.', z: 'art. 271 § 1 kk' },
    ] },
    { lab: 'koniec_notatki' },
    { quiz: ['kurs-5-17', 'kurs-3-19', 'pragmatyka-m16', 'historia-m10', 'pragmatyka-m15', 'kurs-5-20'], n: 3, t: 'Dokumentacja i prawa człowieka', who: 'bielik', say: 'Ostatnie pytania przed egzaminem.' },
  ] });

/* ---- finał ---- */

rozdzial('final', { t: 'Egzamin na chorążego', bg: 'final', final: true, tag: 'Komisja egzaminacyjna · plac apelowy',
  s: [
    { who: 'bielik', t: 'Egzamin na chorążego. Pytania z całej służby – a jeśli został{eś|aś} psychologiem, także ze specjalizacji. Próg: 51%. Ja już nic nie mogę zrobić. Ty – wszystko.' },
    { exam: { n: 15, pass: 51, decks: ['ochrona', 'kkw', 'spb', 'pragmatyka', 'stanowiska', 'ewidencja', 'pp', 'bron', 'sw', 'metodyka'], psych: ['psycholog', 'psych-klin', 'psych-proc', 'penit'] } },
    { nar: 'Plac apelowy, słońce, orkiestra trochę fałszuje. Na aksamitnej poduszce leżą pagony chorążego. Wróbel w trzecim rzędzie macha tak, że kierownik Jastrząb dwa razy się odwraca.' },
    { who: 'dyrektor', t: 'Gratuluję. Stopień chorążego to zaufanie. Proszę go nie zgubić – ani pagonów, ani zaufania.' },
  ] });
