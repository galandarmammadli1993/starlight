# Baş məşqçi karyerası

Oyunda **Baş məşqçi** seç. Qərargahda heyəti, hadisələri və növbəti matçı görəcəksən. **Matçı izlə** ilə 3D matça daxil ol; **Matçı simulyasiya et** həmin turu sürətli hesablayır. Hər ikisi eyni liqaya, heyətə və maliyyəyə yazılır.

## Oynanan sistemlər

- 8 uydurma klub, 176 daimi futbolçu, 14 turluq ikidövrəli mövsüm və 56 matç. Tur tamamlananda rəqiblərin nəticələri və liqa cədvəli yenilənir. Yeni mövsümdə yaş, inkişaf, müqavilə müddəti və mövsüm hədəfləri davam edir.
- Əsas heyət, yeddi ehtiyat, mövqe, fərdi atributlar, fiziki hazırlıq, yorğunluq, zədə və cəza uyğunluğu. Transfer, satış, maaş büdcəsi, müqavilə yeniləmə və akademiyadan yeni futbolçu həqiqi heyət üzvlərini dəyişir. Hazırlıq fəaliyyəti hər turda üç dəfə mümkündür; skaut hesabatı real transfer namizədlərini açır.
- Eqolu ulduz, gəncin həyəcanı, veteranın rolu, qruplaşma, mentorluq, oyun vaxtı vədləri, gecə həyatı, məşqə gecikmə, qırmızı kart, rəhbərlik təzyiqi və qohumluq əsasında seçim tələbi. Şayiə araşdırıla bilər; nəticə sonrakı gündə gəlir. Mətbuat, sosial şəbəkə və TV materialları oyunun uydurma dünyasına aiddir.
- Mənəvi durum, özünəinam, etimad, gərginlik, eqo, peşəkarlıq, ambisiya, nüfuz, liderlik və təcrübə. Qərarlar bunları, komanda birliyini, idarə heyətinin etimadını, maliyyəni və bəzən əsas heyəti dəyişir. Verilən dəqiqə vədi sonrakı iki turda həqiqətən oynanmış dəqiqələrlə yoxlanır. Mentor münasibəti vaxt keçdikcə inkişaf və ya ünsiyyət problemi yaradır.
- Oyundan əvvəl, fasilədə və oyundan sonra altı danışıq üslubu: sakit, dəstəkləyici, ruhlandırıcı, taktiki, tələbkar, əsəbi. Xarakter, yaş, etimad və hesab reaksiyanı dəyişir. Ayrıca üslub seçmədən davam etsən, qərargahda saxladığın məşqçi üslubu tətbiq edilir. Eyni matçın eyni mərhələsində təkrar çıxış əlavə gücləndirmə vermir. Fasilə təsiri həm meydandakı oyunçulara, həm ehtiyatlara dərhal ötürülür.
- Top dayanan zaman **HEYƏT ⇄** seç, çıxacaq oyunçunun ⇄ düyməsinə bas, ehtiyatı, səbəbi və izah üslubunu seç. Erkən çıxarılan eqolu ulduz, 80-ci dəqiqədən sonra daxil olan iddialı gənc və yorğunluqdan qorunan veteran fərqli reaksiya verir. Həqiqi adlar və daimi futbolçu ID-ləri dəyişir; çıxmış futbolçu geri qayıtmır. Matç hesabatında hər iki şəxsin dəqiqələri, qolları, assistləri, kartları, reytinqi və hazırlığı qalır.
- 1×, 2×, 4×, 8× matç sürəti. Saat və fizika birlikdə sürətlənir. Uzun fasilə yarananda matç dayanır. Məşqçi klaviatura ilə oyunçuları hərəkət etdirə, ötürmə və zərbə vura bilmir.
- Maaşlar, işçi heyəti xərcləri, matç gəliri və əməliyyat tarixçəsi. Mövsüm hədəfi ilk dördlük və 23 yaşadək futbolçulara ən azı 180 dəqiqədir. Hər iki tələb ayrıca yoxlanır. Aşağı idarə heyəti etimadı məşqçini qiymətləndirmə mərhələsinə gətirir.
- Cihazda yaddaş, əvvəlki sağlam yaddaş surətindən bərpa, JSON çıxarma və idxal. Futbolçu karyerası və digər rejimlərin saxlanmış matçları müstəqildir.

## Implementation map

| Module | Owns |
| --- | --- |
| `manager-world.mjs` | Persistent clubs/players, schedule, standings, selection, market, finances, seasons |
| `manager-psychology.mjs` | Character traits, dilemmas, groups, mentoring, promises, media, talks and substitution reactions |
| `manager-session.mjs` | One authoritative bridge between career summaries, world, psychology and live match |
| `manager-ui.mjs` / `.css` | Nine dashboard sections and actual decision forms |
| `engine.mjs` | Physical slots plus persistent person IDs, real bench, individual ledger and mental performance modifiers |
| `game-loop.mjs` | Consistent real-time stepping, speed and lag pause |
| `storage.mjs` | Validated snapshots, independent career saves, backup, import/export |

## Limits

This is a fictional browser management simulation. The psychology values are authored game rules, not a clinical model. It uses the existing procedural 3D figures. There are no licensed real-world club/player databases, network multiplayer, native Unity/APK packaging, international competitions, loan contracts or automatic firing/job-market loop. Contract expiry currently gives the user club a temporary one-season extension with a wage increase and an inbox notice; renewal remains a separate decision. Fast simulation computes an aggregate result rather than running every rendered physics frame.

## Verification

`npm test` discovers all `tests/*.test.mjs`, including world, psychology, session, engine and storage integration suites. With the Astro development server running, `python tests/manager_browser.py` verifies the actual pre-match/halftime/post-match speech, real substitution, saved resume and league progression flows. `python tests/browser_smoke.py` and `python tests/offball_browser.py` retain quick-match, personal-career, 3D and pass-request regressions. Deterministic browser fixtures use the development-only inspection hook; production exposes no such controls.
