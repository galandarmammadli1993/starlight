# Futbolçu karyerası: Football Legacy ilə sintez

İstinad: [Football Legacy — MAGICMILIK, Google Play](https://play.google.com/store/apps/details?id=football.legacy&hl=en). Müqayisə 2 noyabr 2026 tarixində oxunmuş rəsmi mağaza təsviri və ekran görüntülərinə əsaslanır. APK yüklənməyib və həmin oyunun daxili kodu yoxlanmayıb. İstinadın mexanikaları bizim öz canlı 11×11 oyunumuz üçün uyğunlaşdırılıb; şəkil, brend, mətn və modellər köçürülməyib.

## Oynamaq

**Futbolçu karyerası** seç. Sunrise Academy-də 18 yaşlı futbolçu kimi başlayırsan. **Mənim yolum**, **Məşq / Bacarıq**, **Klub / Müqavilə**, **Münasibətlər**, **Hadisələr**, **Şəxsi həyat**, **Karyera izi** və **Təqvim / Liqa** bölmələri eyni daimi karyeranı dəyişir.

Məşqçi əsas heyəti və taktikanı seçir. Sən yalnız öz futbolçunu idarə edirsən. Enerji, forma, bacarıq, məşqçi etimadı, zədə və cəza növbəti matçdakı yerini müəyyən edir. Təqvimdə matça qədər olan bərpa günləri də seçimdə nəzərə alınır.

- Əsas heyətdə başlasan, birbaşa öz futbolçunla oynayırsan.
- Ehtiyatda olsan, matçı izləyirsən. Məşqçi planlaşdırılmış dəqiqədən sonra top dayananda səni həqiqi ehtiyat skamyasından meydana daxil edir. İzləmə sürətini 8×-ə qədər artıra bilərsən.
- Heyətə daxil edilməsən, komandanı izləyə və ya turu sürətli tamamlaya bilərsən. Başqasının dəqiqə və qolları sənə yazılmır.
- Məşqçi yorğunluq, zəif çıxış və ya planlaşdırılmış dəyişiklik səbəbilə səni əvəzləyə bilər. Qırmızı kartdan və əvəzetmədən sonra başqa futbolçuya nəzarət keçmir.

**R / TOP İSTƏ** ötürmə istəmək üçündür. Top səndəykən **NİŞANLA VƏ VUR** seç və meydanda hədəfə sürüşdür. Uzun sürüşdürmə gücü artırır; falso və topa təmas sürgüləri həmin tək topun həqiqi uçuşunu dəyişir. Adi klaviatura və mobil zərbə düymələri də qalır.

## İstinaddan uyğunlaşdırılan sistemlər

| İstinadın karyera mövzusu | Footba11 Heroes-da işləyən davranış |
| --- | --- |
| Kiçik klubdan yüksəliş | Ayrı səkkiz klublu dünya, 14 tur, həqiqi liqa cədvəli, öz forma və oyun vaxtın |
| Müqavilə, transfer, icarə, azad agentlik | Agentin real təklifləri, son tarixlər, maaş və imza bonusu, klub/heyət dəyişikliyi, icarə və ana kluba qayıdış, müddəti bitən müqavilə |
| Bacarıq və mövqelər | Matç dəqiqəsi və reytinqə görə qazanılan inkişaf xalı, bacarıq artırma və əlavə mövqe açma |
| Enerji, forma və münasibətlər | Məşq/bərpa, məşqçi, komanda, azarkeş, mətbuat və ailə ilə ayrı münasibətlər; əhval, özünəinam və gərginliyin real matç atributlarına təsiri |
| Futbolçunun şəxsi həyatı | On beş növ hadisə, müxtəlif nəticəli cavablar, araşdırma davamı, sponsor, intizam, ailə, sosial media və mentorla məşq |
| Ev, avtomobil və ev heyvanı | Şəxsi vəsaitdən real alış, aktiv seçim, gündəlik saxlanma öhdəliyi, borc və rifah təsirləri |
| Fərdi görünüş | Həqiqi 3D modeldə saç, saqqal, buts və dəri tonu; forma nömrəsi; saç/buts seçimlərinin göstərilən qiyməti |
| Karyera irsi | Şəxsi dəqiqə, qol, assist, ötürmə, əsas ötürmə, zərbə, kart və reytinq; debüt, ilk qol, mərhələlər, rekordlar, mövsüm mükafatları və pensiya |

Həftəlik maaş, gündəlik yaşayış xərci və əşyaların saxlanma haqqı eyni təqvimlə hesablanır. Matç sürətli hesablandıqda da əvvəlki bərpa, enerji xərci və günlər canlı matçla eyni ardıcıllığı izləyir. Matç günündə hazırlıq fəaliyyəti, mövsüm sonunda isə mövsüm keçidi tələb olunur. Təkrar cavab, alış, matç və ya idxal əlavə bonus yaratmır.

Futbolçu karyerasının klubları, nəticələri, pulu və münasibətləri **Baş məşqçi** karyerasından ayrıdır. Hər rejimin yarımçıq matçı ayrıca saxlanılır. JSON çıxarma/idxal və sağlam əvvəlki yaddaş surətindən bərpa işləyir.

## Kod və yoxlama

- `player-world.mjs`: şəxsiyyət, klublar, mövsüm, seçim, müqavilə, təkliflər və fərdi nəticələr.
- `player-life.mjs`: hadisələr, münasibətlər, mentor, alış, görünüş və psixoloji matç təsirləri.
- `player-session.mjs`: təqvim, maaş/xərclər, məşq, canlı və sürətli matçların vahid bağlantısı.
- `player-ui.mjs` / `.css`: səkkiz bölməli şəxsi karyera.
- `engine.mjs` / `human-model.mjs`: öz futbolçuna nəzarət, həqiqi ehtiyatdan daxilolma/çıxma, fərdi hesabat, nişanlı zərbə və görünən modellər.
- `storage.mjs`: təsdiqlənmiş şəxsiyyət, ehtiyat, vaxt, uçan top və karyera yaddaşı.

`npm test` bütün test modullarını işlədir. Astro önizləməsi ilə `python tests/player_browser.py` həqiqi UI qərarlarını, görünüşü, zərbəni, ehtiyatdan daxilolmanı, yorğunluqla əvəzetməni, yaddaşı, transferi və mobil ölçüləri yoxlayır. Mövcud `browser_smoke.py`, `offball_browser.py` və `manager_browser.py` digər rejimlərin yoxlamalarıdır. Deterministik səhnələr yalnız inkişaf rejimindəki yoxlama vasitəsi ilə hazırlanır; yayımlanan oyunda bu vasitə yoxdur.

## Sərhədlər

Bu, öz uydurma klubları və modelləri olan brauzer oyunudur. Football Legacy-nin elan etdiyi 1,600 klub, 212 milli komanda, beynəlxalq yarışlar, 75 səhnə və bütün mini oyunlar bu versiyaya köçürülməyib. Üç çətinlik səviyyəsi, hava sistemi, sürülən avtomobil küçəsi, matç təkrarı, onlayn dost rejimi və native APK bu dəyişiklikdə qurulmayıb. Avtomobil şəxsi həyat və maliyyə seçimidir. Psixoloji göstəricilər oyun qaydalarıdır; real insan davranışının klinik modeli deyil.
