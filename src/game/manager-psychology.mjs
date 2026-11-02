/** Original fictional dressing-room simulation. Traits are game variables, not diagnoses. */
const clamp=(v,a=0,b=100)=>Math.max(a,Math.min(b,v));
const num=(v,d=0,a=0,b=100)=>Number.isFinite(v)?clamp(v,a,b):d;
const text=(v,d='',n=400)=>typeof v==='string'?v.replace(/[\u0000-\u001f\u007f]/g,'').slice(0,n):d;
const obj=v=>v&&typeof v==='object'&&!Array.isArray(v)?v:{};
const hash=s=>{let n=2166136261;for(const c of String(s)){n^=c.charCodeAt(0);n=Math.imul(n,16777619);}return n>>>0;};
const styles=['calm','supportive','demanding','angry','inspire','tactical'];
const own=(w)=>w.players.filter(p=>p.clubId===w.userClubId);
const find=(w,id)=>w.players.find(p=>p.id===id);
const rating=p=>Object.values(p.attributes??{}).reduce((a,b)=>a+(Number(b)||0),0)/Math.max(1,Object.keys(p.attributes??{}).length);
const rounded=v=>Math.round(v*10)/10;
const choice=(id,label,preview)=>({id,label,preview});
const catalog={
 nightlife:{title:'Gecə gəzintisi barədə xəbər',body:p=>`${p.name} barədə gecə klubuna getdiyi iddiası yayılıb. Xəbər hələ təsdiqlənməyib; istirahət günü ilə oyunöncəsi gecə eyni deyil.`,choices:[choice('investigate','Əvvəl faktları yoxla','Növbəti gün araşdırma; təqsir təsdiqlənmədən cəza yoxdur.'),choice('private','Şəxsi söhbət et','Etimad arta bilər; yorğunluğun səbəbini dinlə.'),choice('public','İctimai sərt xəbərdarlıq','İntizam mesajı güclənir, əsassız ittiham etimadı poza bilər.'),choice('ignore','Müdaxilə etmə','Azadlıq hissi qorunur, qayda gözləntisi qeyri-müəyyən qalır.')]},
 nightlife_confirmed:{title:'Gecə hadisəsinin faktları təsdiqləndi',body:p=>`${p.name} matçöncəsi komanda qaydasını pozduğunu qəbul edib. Komanda eyni qaydanın ulduzlara da tətbiqini gözləyir.`,choices:[choice('warning','Şəxsi xəbərdarlıq və bərpa planı','Ədalət və etimad qorunur; yüngül intizam nəticəsi.'),choice('fine','Həftəlik maaşın 20%-i qədər cərimə','Ardıcıl qayda tətbiqi; eqolu futbolçu narazı qala bilər.'),choice('recovery','Səbəbi dinlə, bərpa proqramı ver','Yorğunluq azalır, yumşaqlıq kimi qəbul edilə bilər.'),choice('bench','Bir oyun ehtiyatda saxla','Əsas heyət dəyişir; intizam güclənir, şəxsi narazılıq artır.')]},
 nightlife_unfounded:{title:'Gecə gəzintisi iddiası təsdiqlənmədi',body:p=>`${p.name} barədə yayılan görüntünün köhnə olduğu müəyyənləşdi. Sübut olunmamış iddianı günah kimi təqdim etmək düzgün olmazdı.`,choices:[choice('defend','Futbolçunu faktlarla müdafiə et','Şəxsi etimad və komanda ədalət hissi artır.'),choice('correct','Sakit düzəliş yayımla','Media təzyiqi azalır; faktlar aydınlaşır.'),choice('ignore','Mövzunu böyütmə','Məşqə fokus qorunur, açıq dəstək zəif qalır.')]},
 late_training:{title:'Məşqə gecikmə',body:p=>`${p.name} məşqə gecikib. Təkrar gecikmə ilə bir dəfəlik şəxsi problemi ayırd etməlisən. Digər futbolçular münasibətinin ədalətli olub-olmadığını izləyir.`,choices:[choice('listen','Səbəbi şəxsi söhbətdə dinlə','Etimad artır, nizam-intizam gözləntisi aydınlaşdırılır.'),choice('warning','Hamıya eyni yazılı xəbərdarlıq','Ədalət və peşəkarlıq artır; rahatlıq azalır.'),choice('fine','Qaydaya uyğun 10% maaş cəriməsi','İntizam artır; temperamentdən asılı narazılıq.'),choice('ignore','Bu dəfə görməzliyə vur','Futbolçu rahatlayır, təkrar qayda pozuntusu riski artır.')]},
 star_ego:{title:'Ulduz futbolçu təminat istəyir',body:p=>`${p.name} nüfuzunu əsas gətirib hər matça əsas heyətdə başlama təminatı istəyir. Həddən artıq vəd həm ehtiyatları, həm də lideri narazı sala bilər.`,choices:[choice('merit','Seçimin forma və əməyə bağlı olduğunu de','Komandada ədalət artır; ulduzun qısamüddətli morali düşə bilər.'),choice('promise','İki turda ən azı 60 dəqiqə vəd et','Etimad indi artır; tutulmayan vəd sonradan ciddi itki verəcək.'),choice('private','Nüfuzunu qəbul et, məsuliyyət istə','Əməkdaşlıq və liderlik inkişaf edə bilər.'),choice('bench','İctimai şəkildə ehtiyata göndər','Əsas heyət dəyişir; eqo və qruplaşma riski yüksəlir.')]},
 young_anxiety:{title:'Gənc futbolçu təzyiq altındadır',body:p=>`${p.name} səhv etməkdən qorxduğunu deyir. Dəstək, real tapşırıq və etibarlı mentor ona kömək edə bilər; hamının qarşısında təzyiq əks təsir göstərə bilər.`,choices:[choice('mentor','Uyğun təcrübəli mentor təyin et','Həftəlik inkişaf və etimad; mentor uyğunluğu vacibdir.'),choice('support','Şəxsi dəstək və sadə tapşırıq ver','Özünəinam artır, stress azalır.'),choice('challenge','Hamının qarşısında sərt tələb et','Peşəkar gənc səfərbər ola bilər, həssas oyunçu sarsıla bilər.'),choice('bench','Təzyiqdən qoruyub ehtiyatda saxla','Stress azalır; oyun vaxtı gözləntisi narazılıq yarada bilər.')]},
 veteran_role:{title:'Təcrübəli futbolçu rolunu soruşur',body:p=>`${p.name} azalmaqda olan oyun vaxtına baxmayaraq faydalı olmaq istəyir. Yaş onun avtomatik zəif və ya yaxşı lider olması demək deyil; hazırkı forması və davranışı əsasdır.`,choices:[choice('mentor','Mentor və rotasiya lideri rolu təklif et','Təcrübə gənclərə ötürülür, nüfuzu qorunur.'),choice('rotate','İki turda real oyun vaxtı vəd et','Vəd etimad yaradır; dəqiqələr sonradan yoxlanılır.'),choice('honest','Mövcud formanı şəxsi söhbətdə izah et','Şəffaflıq qorunur, ilk anda narazılıq mümkündür.'),choice('cut','Hamının qarşısında yaşını əsas gətir','Nüfuzuna zərər, yaşlı qrupda etimad və birlik itkisi.')]},
 clique_conflict:{title:'Soyunub-geyinmə otağında qruplaşma',body:p=>`${p.name} fərqli qrupların məşqdə bir-birinə az ötürdüyünü bildirir. Qruplar öz-özünə pis deyil; problem ünsiyyətin və ədalət hissinin pozulmasıdır.`,choices:[choice('bridge','Qarışıq məşq cütləri və ortaq məqsəd','Qruplar arasında ünsiyyət və pas əməkdaşlığı artır.'),choice('captains','Qrup liderləri ilə kiçik görüş keçir','Liderlik güclənir; etimad aşağıdırsa nəticə zəif ola bilər.'),choice('strict','Ayrı-seçkiliyə sərt komanda qaydası qoy','Qayda aydınlaşır, müdafiə mövqeyi və stress arta bilər.'),choice('ignore','Nəticə yaxşıdırsa qarışma','Qısa rahatlıq, uzunmüddətli birlik itkisi.')]},
 red_card:{title:'Qırmızı kartdan sonra qərar',body:p=>`${p.name} meydandan qovulub. Hakimin qərarı ilə onun niyyətini ayır; cəza dayandırılmır, amma davranışına və komandanın reaksiyasına təsir edə bilərsən.`,choices:[choice('review','Epizodu şəxsi söhbətdə təhlil et','Məsuliyyət və özünənəzarət artır; cəza qüvvədə qalır.'),choice('fine','Təsdiqlənmiş qayda pozuntusuna 15% cərimə','İntizam artır, fərdi etimad azalır.'),choice('defend','İctimai dəstək ver, daxilən məsuliyyət istə','Etimad qorunur; mətbuat yumşaqlıq deyə bilər.'),choice('bench','Cəzadan əlavə ehtiyat qərarı ver','Əsas heyət planı dəyişir, narazılıq və stress arta bilər.')]},
 board_relative:{title:'Seçimə kənar müdaxilə',body:p=>`Uydurma şəhər komitəsi üzvünün qohumu olan ${p.name} üçün idarə heyətindən əsas heyət tələbi gəlib. Qohumluq onun futbol bacarığını dəyişmir; statistika və məşq forması ayrıca qiymətləndirilməlidir.`,choices:[choice('merit','Yalnız futbol meyarı ilə seçim et','Komanda ədaləti və etimadı artır; idarə heyəti təzyiqi mümkündür.'),choice('trial','Ölçülən məşq və ehtiyat dəqiqələri ilə sınaq','Şəffaf şans verilir; növbəti iki tur üçün vəd yaranır.'),choice('pressure','Təzyiqi qəbul edib əsas heyətə sal','Heyət dəyişir, idarə heyəti razılaşır; ədalət və qrup etimadı azalır.'),choice('refuse','Müdaxiləni açıq rədd et','Azarkeş etimadı arta bilər; idarə heyəti münasibəti pisləşir.')]},
 media_smear:{title:'Mətbuatda əsassız iddia',body:p=>`Oyundaxili “Futbol Gündəliyi” kanalı məşqçinin ${p.name} ilə münasibəti barədə yoxlanılmamış iddia yayıb. Bu, oyundaxili uydurma xəbərdir; fakt, şayiə və fikir fərqləndirilməlidir.`,choices:[choice('verify','Faktları yoxlat, sonra cavab ver','Növbəti gün aydınlaşdırma; dərhal qarşıdurma yaratmır.'),choice('facts','Məlum faktları sakitcə paylaş','Media təzyiqi azalır, etimad artır.'),choice('attack','Jurnalisti hədəfə alan emosional cavab','Bəzi azarkeşlər alqışlayır, mövzu və təzyiq böyüyür.'),choice('ignore','Komandanı qoruyub cavab vermə','Diqqət məşqdə qalır, boşluq spekulyasiyaya açıq qalır.')]},
 social_backlash:{title:'Sosial şəbəkədə təzyiq',body:p=>`${p.name} oyundaxili sosial şəbəkədə sərt şərhləri şəxsi qəbul edir. Tənqid ilə təhqiri ayırmaq, futbolçunun öz qərarına hörmət etmək vacibdir.`,choices:[choice('support','Şəxsi dəstək və media dəstəyi ver','Özünəinam və etimad artır, stress azalır.'),choice('break','Razılığı ilə qısa media fasiləsi planla','Stress azalır; məcburi susdurma tətbiq edilmir.'),choice('attack','Tənqidçilərlə ictimai mübahisəyə gir','Diqqət artır, təzyiq və müdafiə mövqeyi böyüyür.'),choice('ignore','Özü həll etsin','Müstəqillik saxlanır, dəstək gözləyən gənc tək qala bilər.')]},
 tv_criticism:{title:'TV şərhçisi taktikanı tənqid edir',body:p=>`Uydurma “Matç Masası” verilişi komandanın planını və ${p.name} seçimini müzakirə edir. Sən oyunu izah edə, məsuliyyəti bölüşə və ya emosional reaksiya verə bilərsən.`,choices:[choice('tactical','Taktiki arqument və nümunə ilə cavab ver','Təzyiq azalır, komanda aydınlıq görür.'),choice('accountable','Nəticəyə görə məsuliyyəti üzərinə götür','Futbolçular qorunduğunu hiss edir; idarə heyəti tələbini artırır.'),choice('defend','Oyunçunu müdafiə edib işə fokuslan','Şəxsi etimad və birlik artır.'),choice('attack','Bütün tənqidi düşmənçilik say','Səs-küy və media təzyiqi artır, bəzi eqolu liderlər həvəslənir.')]},
 training_conflict:{title:'Gənc və təcrübəli futbolçu mübahisəsi',body:p=>`${p.name} ilə məşq cütü arasında ünsiyyət problemi yaranıb. Fərqli təcrübə və gözləntilər var; tərəfləri dinləmədən yaşa görə hökm vermək risqlidir.`,choices:[choice('mediate','Hər iki tərəfi dinlə, ortaq tapşırıq ver','Qruplararası münasibət və etimad artır.'),choice('youth','Gənc qrupu avtomatik haqlı say','Gənclər razılaşır, təcrübəli qrupda etimad azalır.'),choice('veteran','Təcrübəli qrupu avtomatik haqlı say','Təcrübəlilər razılaşır, gənclərdə stress və uzaqlaşma artır.'),choice('ignore','Mübahisəni görməzliyə vur','Birlik və əməkdaşlıq azalır.')]},
 contract_discontent:{title:'Müqavilə narazılığı',body:p=>`${p.name} rolu və ödənişinin töhfəsinə uyğun olmadığını düşünür. Şəxsi söhbət ilə real müqavilə danışıqlarını ayırmaq lazımdır.`,choices:[choice('negotiate','Danışıq və maliyyə baxışı təklif et','Etimad artır; müqavilə avtomatik dəyişmir, danışıqlar tapşırığı yaranır.'),choice('explain','Klubun vəziyyətini şəffaf izah et','Ədalət artır; ambisiyalı oyunçu yenə narazı qala bilər.'),choice('promise','Oyun vaxtı ilə özünü göstərmə şansı vəd et','İki turda 60 dəqiqə öhdəliyi yaranır.'),choice('transfer','Transfer istəyi üçün açıq qapı saxla','Transfer niyyəti qeydə alınır, etimad qorunur.')]},
 captain_challenge:{title:'Lider məşqçi ilə razılaşmır',body:p=>`${p.name} komanda lideri kimi qərarlarına etiraz edir. Nüfuz yarışı ilə əsaslı tənqidi ayırmaq üçün danışığın tonu önəmlidir.`,choices:[choice('private','Şəxsi görüşdə arqumentləri dinlə','Etimad və əməkdaşlıq artır.'),choice('shared','Liderə aydın məsuliyyət ver','Nüfuzu ortaq məqsədə yönəlir; eqo nəzarəti vacib qalır.'),choice('replace','Liderliyi başqasına ver','Yeni lider imkanı yaranır, köhnə qrupun dəstəyi itə bilər.'),choice('ignore','Etirazı cavabsız qoy','Qrup münasibəti və məşqçi nüfuzu zəifləyə bilər.')]},
 fitness_overload:{title:'Məşq yükü barədə xəbərdarlıq',body:p=>`${p.name} yorğunluğu barədə danışıb. Sərt hazırlıq ilə bərpa ehtiyacının balansı seçimlərə və növbəti matça təsir edir.`,choices:[choice('rest','Bərpa günü ver','Fiziki hazırlıq yaxşılaşır, etimad artır.'),choice('listen','Fərdi yük planını razılaşdır','Fokus və etimad artır, stress azalır.'),choice('push','Eyni yükü israrla davam etdir','İradəli oyunçu qısa səfərbərlik göstərə bilər, yorğunluq və stress artır.'),choice('medical','Tibbi heyətlə qiymətləndir','€200 xərc, bərpa və inam; zədə avtomatik diaqnoz edilmir.')]},
 playing_time:{title:'Oyun vaxtı narazılığı',body:p=>`${p.name} ehtiyatda çox qaldığını bildirir. Gözləntilər, real dəqiqələr və verdiyin vədlər bir-birinə uyğun gəlməlidir.`,choices:[choice('merit','Rolunu və seçim meyarını izah et','Ədalət qorunur, qısa müddətdə moral itə bilər.'),choice('promise','İki turda 45 dəqiqə söz ver','Etimad indi artır, vəd sonradan yoxlanılır.'),choice('loan','İcarə üçün uyğun yol axtar','İcarə niyyəti yaranır; real transfer ekranında əməliyyat tələb olunur.'),choice('ignore','Mövzunu bağla','Eqolu futbolçuda etimad və əməkdaşlıq azalır.')]},
};
export const MANAGER_EVENT_TYPES=Object.freeze(Object.keys(catalog));
const normalEvent=e=>{const type=text(e.type);if(!catalog[type])return null;return {id:text(e.id,'',120),type,title:text(e.title,catalog[type].title),body:text(e.body,'',900),playerId:text(e.playerId),day:num(e.day,1,1,1e7),dueDay:num(e.dueDay,e.day??1,1,1e7),status:['pending','scheduled','resolved'].includes(e.status)?e.status:'pending',evidence:['rumour','confirmed','unsubstantiated'].includes(e.evidence)?e.evidence:'confirmed',context:obj(e.context),choices:catalog[type].choices.map(c=>({...c})),outcome:text(e.outcome,'',600),choiceId:text(e.choiceId),resolvedDay:num(e.resolvedDay,0,0,1e7)};};

export function normalizePsychology(world){
  world.players=Array.isArray(world.players)?world.players:[];world.userClubId??='baku';
  const existing=obj(world.psychology),p={...existing};
  for(const [key,d]of Object.entries({cohesion:65,managerTrust:62,boardTrust:60,mediaPressure:25,fairness:65}))p[key]=num(p[key],d);
  p.events=(Array.isArray(p.events)?p.events:[]).map(normalEvent).filter(e=>e?.id).slice(-120);
  p.history=(Array.isArray(p.history)?p.history:[]).filter(e=>e&&typeof e==='object').slice(0,120).map(e=>({id:text(e.id),day:num(e.day,1,1,1e7),type:text(e.type),message:text(e.message,'',900),effects:Array.isArray(e.effects)?e.effects.map(x=>text(x,'',200)).slice(0,12):[]}));
  p.media=(Array.isArray(p.media)?p.media:[]).filter(e=>e&&typeof e==='object').slice(0,80).map(e=>({id:text(e.id),day:num(e.day,1,1,1e7),channel:['press','social','tv','club'].includes(e.channel)?e.channel:'club',title:text(e.title,'',250),body:text(e.body,'',700),sentiment:['positive','neutral','critical'].includes(e.sentiment)?e.sentiment:'neutral',fictional:true}));
  p.mentorships=(Array.isArray(p.mentorships)?p.mentorships:[]).filter(m=>find(world,m.mentorId)&&find(world,m.menteeId)).slice(0,12).map(m=>({mentorId:m.mentorId,menteeId:m.menteeId,startDay:num(m.startDay,1,1,1e7),lastDay:num(m.lastDay,world.day??1,1,1e7),sessions:num(m.sessions,0,0,10000),compatibility:num(m.compatibility,50),status:m.status==='ended'?'ended':'active'}));
  p.relationships=Object.fromEntries(Object.entries(obj(p.relationships)).slice(-250).map(([k,v])=>[text(k,'',120),num(v,50)]));
  p.policies={coachStyle:styles.includes(p.policies?.coachStyle)?p.policies.coachStyle:'supportive',discipline:['consistent','lenient','strict'].includes(p.policies?.discipline)?p.policies.discipline:'consistent',openDoor:p.policies?.openDoor!==false};
  p.processedContexts=(Array.isArray(p.processedContexts)?p.processedContexts:[]).filter(v=>typeof v==='string').slice(-200);
  p.processedDays=(Array.isArray(p.processedDays)?p.processedDays:[]).filter(Number.isFinite).slice(-200);
  p.talkKeys=(Array.isArray(p.talkKeys)?p.talkKeys:[]).filter(v=>typeof v==='string').slice(-200);
  p.substitutionKeys=(Array.isArray(p.substitutionKeys)?p.substitutionKeys:[]).filter(v=>typeof v==='string').slice(-200);
  p.sequence=num(p.sequence,0,0,1e8);p.initialized=!!p.initialized;p.lastMeetingDay=num(p.lastMeetingDay,-1,-1,1e7);
  for(const player of world.players){
    const seed=hash(player.id),age=Number(player.age)||25;player.psych=obj(player.psych);
    const defaults={ego:35+seed%45,professionalism:45+seed%46,ambition:45+(seed>>>4)%46,loyalty:35+(seed>>>7)%56,leadership:30+(seed>>>10)%61,influence:25+(seed>>>13)%66,experience:clamp((age-16)*4),temperament:30+(seed>>>16)%61,minutesExpected:rating(player)>73?70:age<21?30:50,stress:20,focusBoost:0};
    for(const [key,d]of Object.entries(defaults))player.psych[key]=num(player.psych[key],d,key==='focusBoost'?-15:0,key==='focusBoost'?15:100);
    player.psych.focusUntilRound=num(player.psych.focusUntilRound,0,0,1e7);
    player.psych.disciplineRecord=num(player.psych.disciplineRecord,0,0,1e5);
    player.psych.promises=(Array.isArray(player.psych.promises)?player.psych.promises:[]).slice(-10).filter(x=>x&&typeof x==='object').map(x=>({id:text(x.id),type:'minutes',target:num(x.target,45,1,180),baseline:num(x.baseline,0,0,1e8),dueRound:num(x.dueRound,Number(world.round)||0,0,1e6),status:['open','kept','broken'].includes(x.status)?x.status:'open'}));
    player.psych.roleIntent=text(player.psych.roleIntent,'',60);player.psych.managerRelationship=num(player.psych.managerRelationship,60);
    player.morale=num(player.morale,70);player.confidence=num(player.confidence,65);player.trust=num(player.trust,62);
    player.group=text(player.group,age<=22?'young':age>=30?'experienced':player.psych.ego>75?'stars':'core',40);
  }
  p.groups=[...new Set(['young','veterans','international','stars','core',...own(world).map(x=>x.group)])].map(id=>({id,label:{young:'Gənclər',veterans:'Təcrübəlilər',experienced:'Təcrübəlilər',international:'Beynəlxalq qrup',stars:'Nüfuzlu liderlər',core:'Əsas komanda'}[id]??id,playerIds:own(world).filter(x=>x.group===id).map(x=>x.id),trust:rounded(average(own(world).filter(x=>x.group===id),'trust',60))}));
  world.psychology=p;return p;
}
const average=(players,key,d=60)=>players.length?players.reduce((a,p)=>a+num(p[key],d),0)/players.length:d;
function audit(world,type,message,effects=[]){const p=world.psychology;p.history.unshift({id:`psy-log-${++p.sequence}`,day:world.day??1,type,message,effects});p.history=p.history.slice(0,120);}
function media(world,channel,title,body,sentiment='neutral'){const p=world.psychology;p.media.unshift({id:`media-${++p.sequence}`,day:world.day??1,channel,title,body,sentiment,fictional:true});p.media=p.media.slice(0,80);}
function changePlayer(player,values,effects){if(!player)return;for(const [key,delta]of Object.entries(values)){const target=key in player.psych&&!(key in player)?player.psych:player;const lo=key==='focusBoost'?-15:0,hi=key==='focusBoost'?15:100;const before=num(target[key],key==='focusBoost'?0:50,lo,hi);target[key]=clamp(before+delta,lo,hi);if(delta)effects.push(`${player.name}: ${key} ${delta>0?'+':''}${rounded(delta)}`);}}
function changeTeam(world,values,effects){for(const [key,delta]of Object.entries(values)){world.psychology[key]=clamp(num(world.psychology[key],50)+delta);if(delta)effects.push(`${key} ${delta>0?'+':''}${rounded(delta)}`);}}
function groupEffect(world,group,values,effects){for(const player of own(world).filter(p=>p.group===group||(group==='experienced'&&['veterans','experienced'].includes(p.group))))changePlayer(player,values,[]);if(effects)effects.push(`${group} qrupu: ${Object.entries(values).map(([k,v])=>`${k} ${v>0?'+':''}${v}`).join(', ')}`);}
function benchPlayer(world,player){if(!Array.isArray(world.lineup)||!world.lineup.includes(player.id))return false;const reserve=own(world).find(p=>!world.lineup.includes(p.id)&&p.role===player.role&&!p.suspension&&!p.injuryDays);if(!reserve)return false;world.lineup=world.lineup.map(id=>id===player.id?reserve.id:id);world.bench=[player.id,...(world.bench??[]).filter(id=>id!==reserve.id&&id!==player.id)].slice(0,7);return true;}
function startPlayer(world,player){if(!Array.isArray(world.lineup)||world.lineup.includes(player.id))return false;const outgoing=world.lineup.map(id=>find(world,id)).find(p=>p?.role===player.role);if(!outgoing)return false;world.lineup=world.lineup.map(id=>id===outgoing.id?player.id:id);world.bench=[outgoing.id,...(world.bench??[]).filter(id=>id!==player.id&&id!==outgoing.id)].slice(0,7);return true;}
function promise(world,player,target){player.psych.promises.push({id:`promise-${++world.psychology.sequence}`,type:'minutes',target,baseline:player.statistics?.minutes??0,dueRound:(world.round??0)+2,status:'open'});}
function addEvent(world,type,player,context={},evidence='confirmed',dueDay=world.day??1){
  if(!player||!catalog[type])return null;const p=world.psychology;
  const key=context.key??`${world.season??1}:${type}:${player.id}:${world.day??1}:${world.round??0}`;
  if(p.events.some(e=>e.context?.key===key))return null;
  const event={id:`psy-${world.season??1}-${++p.sequence}`,type,title:catalog[type].title,body:catalog[type].body(player),playerId:player.id,day:world.day??1,dueDay,status:dueDay>(world.day??1)?'scheduled':'pending',evidence,context:{...context,key},choices:catalog[type].choices.map(c=>({...c})),outcome:'',choiceId:'',resolvedDay:0};
  p.events.push(event);p.events=p.events.slice(-120);return event;
}
export function initializePsychology(world){
  const p=normalizePsychology(world);if(p.initialized)return p;p.initialized=true;
  const squad=own(world);if(!squad.length)return p;
  const star=[...squad].sort((a,b)=>(b.psych.ego+rating(b))-(a.psych.ego+rating(a)))[0];
  const younger=[...squad].sort((a,b)=>a.age-b.age)[0];
  const connection=squad.find(x=>x.id!==star.id&&x.id!==younger.id)??squad[0];connection.psych.boardConnection=true;
  addEvent(world,'star_ego',star,{key:'initial-star'});addEvent(world,'late_training',younger,{key:'initial-late'});addEvent(world,'board_relative',connection,{key:'initial-board'});
  media(world,'club','Yeni baş məşqçi: seçimlər meydanda görünəcək','Oyundaxili xəbər: bütün adlar, media orqanları və hadisələr uydurmadır. Ədalətli münasibət, verilən sözlər və real oyun vaxtı komanda etimadını formalaşdırır.');return p;
}

function ready(world){return world.psychology?.initialized&&world.players?.every(p=>p.psych&&Number.isFinite(p.psych.focusBoost))?world.psychology:initializePsychology(world);}
function processPromises(world){for(const player of own(world))for(const promise of player.psych.promises){if(promise.status!=='open'||(world.round??0)<promise.dueRound)continue;const kept=(player.statistics?.minutes??0)-promise.baseline>=promise.target;promise.status=kept?'kept':'broken';const effects=[];changePlayer(player,kept?{trust:8,morale:5,confidence:3}:{trust:-12,morale:-8,stress:7},effects);changeTeam(world,{fairness:kept?2:-4,managerTrust:kept?2:-3},effects);audit(world,'promise',`${player.name}: ${promise.target} dəqiqə vədi ${kept?'tutuldu':'pozuldu'}.`,effects);}}
function processMentors(world){for(const m of world.psychology.mentorships){if(m.status!=='active'||(world.day??1)-m.lastDay<7)continue;const mentor=find(world,m.mentorId),mentee=find(world,m.menteeId);if(!mentor||!mentee||mentor.clubId!==mentee.clubId||mentee.clubId!==world.userClubId){m.status='ended';continue;}m.lastDay=world.day;m.sessions++;const compatible=m.compatibility>=50, effects=[];changePlayer(mentee,compatible?{confidence:3,trust:2,stress:-3}:{confidence:-2,stress:4},effects);changePlayer(mentor,compatible?{morale:2}:{morale:-2},effects);if(compatible){const skill=mentee.role==='DEF'?'defending':mentee.role==='FWD'?'shooting':'passing';mentee.attributes??={};mentee.attributes[skill]=clamp(num(mentee.attributes[skill],50)+.5);}audit(world,'mentoring',`${mentor.name} → ${mentee.name}: ${compatible?'faydalı mentor məşqi':'ünsiyyət ziddiyyəti; uyğunluğu yenidən qiymətləndir'}.`,effects);}}
export function generateManagerEvents(world,context={}){
  initializePsychology(world);const p=world.psychology,squad=own(world),day=world.day??1;
  if(!squad.length)return [];
  for(const e of p.events)if(e.status==='scheduled'&&e.dueDay<=day)e.status='pending';
  const key=context.fixtureId?`match:${context.fixtureId}`:context.id?`context:${context.id}`:`day:${day}`;
  if(p.processedContexts.includes(key))return p.events.filter(e=>e.status==='pending');
  p.processedContexts.push(key);p.processedContexts=p.processedContexts.slice(-200);
  processPromises(world);processMentors(world);
  if(context.kind==='match'||context.fixtureId){
    const cards=Array.isArray(context.cards)?context.cards:[];
    for(const card of cards.filter(c=>String(c.type??c.card).toLowerCase().includes('red'))){const player=find(world,card.playerId);if(player?.clubId===world.userClubId)addEvent(world,'red_card',player,{fixtureId:context.fixtureId,key:`red:${context.fixtureId}:${player.id}`});}
    const benched=squad.filter(player=>{
      if(player.psych.minutesExpected<=55||player.injuryDays>0||player.suspension>0)return false;
      const minutes=context.playerMinutes?.[player.id];
      return Number.isFinite(minutes)?minutes<Math.min(30,player.psych.minutesExpected*.5):!(world.lineup??[]).includes(player.id);
    });
    for(const player of benched){const effects=[];changePlayer(player,{morale:-2,trust:player.psych.ego>70?-3:-1,stress:1},effects);}
    if(benched.length)addEvent(world,'playing_time',benched.sort((a,b)=>b.psych.ego-a.psych.ego)[0],{fixtureId:context.fixtureId,key:`minutes:${context.fixtureId}`});
    const score=context.score??[0,0],win=score[0]>score[1],loss=score[0]<score[1];
    changeTeam(world,{mediaPressure:loss?6:win?-4:1},[]);
    media(world,'tv',win?'“Matç Masası”: nəticə ümid yaradır':loss?'“Matç Masası”: seçimlər sual doğurur':'“Matç Masası”: növbəti tur nə göstərəcək?',`Uydurma veriliş komandanın ${score.join('–')} nəticəsini müzakirə edir. Taktiki tənqid fakt, fikir və şayiə kimi ayrıca qiymətləndirilməlidir.`,win?'positive':loss?'critical':'neutral');
    if(loss)addEvent(world,'tv_criticism',squad.sort((a,b)=>b.psych.influence-a.psych.influence)[0],{fixtureId:context.fixtureId,key:`tv:${context.fixtureId}`});
  }
  if(!p.processedDays.includes(day)){
    p.processedDays.push(day);p.processedDays=p.processedDays.slice(-200);
    if(p.events.filter(e=>e.status==='pending').length<5){
      const pool=['nightlife','clique_conflict','young_anxiety','veteran_role','social_backlash','training_conflict','media_smear','contract_discontent','captain_challenge','fitness_overload','late_training','board_relative'];
      const index=hash(`${world.seed??27}:${world.season??1}:${day}`)%pool.length;
      for(let n=0;n<2;n++){
        const type=pool[(index+n*5)%pool.length];let choices=squad;
        if(type==='young_anxiety')choices=squad.filter(x=>x.age<=23);
        if(type==='veteran_role')choices=squad.filter(x=>x.age>=29);
        if(type==='fitness_overload')choices=[...squad].sort((a,b)=>(a.fitness??100)-(b.fitness??100)).slice(0,3);
        if(type==='captain_challenge')choices=[...squad].sort((a,b)=>b.psych.leadership-a.psych.leadership).slice(0,3);
        const player=choices[hash(`${type}:${day}`)%Math.max(1,choices.length)]??squad[0];
        addEvent(world,type,player,{},['nightlife','media_smear'].includes(type)?'rumour':'confirmed');
      }
    }
  }
  return p.events.filter(e=>e.status==='pending');
}

function fine(world,player,fraction,effects){const amount=Math.max(0,Math.round((Number(player.wage)||100)*fraction));world.budget=Math.max(0,(Number(world.budget)||0)+amount);player.psych.disciplineRecord++;effects.push(`İntizam cəriməsi: €${amount} (klub büdcəsinə)`);}
function mentorCandidate(world,player){return own(world).filter(x=>x.id!==player.id&&x.age>=27&&x.psych.professionalism>=55&&x.psych.leadership>=40).sort((a,b)=>(b.psych.leadership+b.psych.professionalism)-(a.psych.leadership+a.psych.professionalism))[0];}
export function resolveManagerEvent(world,eventId,choiceId){
  ready(world);const state=world.psychology,event=state.events.find(e=>e.id===eventId);
  if(!event||event.status!=='pending'||event.dueDay>(world.day??1))return {ok:false,message:'Hadisə mövcud deyil, hələ açılmayıb və ya artıq həll edilib.',effects:[]};
  const selected=event.choices.find(c=>c.id===choiceId),player=find(world,event.playerId);
  if(!selected||!player||player.clubId!==world.userClubId)return {ok:false,message:'Seçim və ya futbolçu uyğun deyil.',effects:[]};
  if(choiceId==='medical'&&(world.budget??0)<200)return {ok:false,message:'Tibbi qiymətləndirmə üçün €200 lazımdır.',effects:[]};
  const effects=[],ego=player.psych.ego,pro=player.psych.professionalism;
  const cp=v=>changePlayer(player,v,effects),ct=v=>changeTeam(world,v,effects);
  switch(event.type){
    case 'nightlife':
      if(choiceId==='investigate'){cp({trust:2});ct({fairness:3});const confirmed=hash(`${world.seed}:${event.id}:facts`)%3!==0;addEvent(world,confirmed?'nightlife_confirmed':'nightlife_unfounded',player,{key:`investigation:${event.id}`},confirmed?'confirmed':'unsubstantiated',(world.day??1)+1);effects.push('Araşdırma nəticəsi növbəti gün gələcək.');}
      if(choiceId==='private'){cp({trust:4,stress:-3});ct({managerTrust:1});}
      if(choiceId==='public'){cp({trust:-8,morale:-5,stress:6});ct({fairness:-6,mediaPressure:6});}
      if(choiceId==='ignore'){cp({morale:2,professionalism:-2});ct({fairness:-2});}break;
    case 'nightlife_confirmed':
      if(choiceId==='warning'){cp({professionalism:3,trust:1});ct({fairness:3});}
      if(choiceId==='fine'){fine(world,player,.2,effects);cp({professionalism:5,trust:ego>70?-5:-1,morale:-3});ct({fairness:4});}
      if(choiceId==='recovery'){player.fitness=clamp(num(player.fitness,70)+8);cp({trust:5,stress:-4});ct({fairness:-1});}
      if(choiceId==='bench'){benchPlayer(world,player);cp({professionalism:4,morale:-7,trust:-3});ct({fairness:3});effects.push('Əsas heyət uyğun ehtiyat oyunçu ilə dəyişdirildi.');}break;
    case 'nightlife_unfounded':
      if(choiceId==='defend'){cp({trust:8,confidence:4,stress:-6});ct({fairness:5,managerTrust:3,mediaPressure:-4});}
      if(choiceId==='correct'){cp({trust:4,stress:-3});ct({mediaPressure:-6});}
      if(choiceId==='ignore'){cp({trust:-2});ct({mediaPressure:1});}break;
    case 'late_training':
      if(choiceId==='listen'){cp({trust:5,professionalism:1,stress:-3});ct({managerTrust:1});}
      if(choiceId==='warning'){cp({professionalism:4,morale:-1});ct({fairness:4});}
      if(choiceId==='fine'){fine(world,player,.1,effects);cp({professionalism:5,trust:ego>70?-6:-2,morale:-3});ct({fairness:2});}
      if(choiceId==='ignore'){cp({morale:2,professionalism:-4});ct({fairness:-4});}break;
    case 'star_ego':
      if(choiceId==='merit'){cp({morale:ego>70?-4:-1,trust:pro>65?3:-2});ct({fairness:5,cohesion:2});}
      if(choiceId==='promise'){promise(world,player,60);cp({trust:6,morale:5});ct({fairness:-1});}
      if(choiceId==='private'){cp({trust:5,leadership:2,stress:-2});ct({cohesion:2});}
      if(choiceId==='bench'){benchPlayer(world,player);cp({morale:-12,trust:-8,stress:6});groupEffect(world,player.group,{trust:-4},effects);ct({cohesion:-4});}break;
    case 'young_anxiety':
      if(choiceId==='mentor'){const m=mentorCandidate(world,player);if(m){const result=assignMentor(world,m.id,player.id);effects.push(result.message);}else{cp({confidence:3,trust:3,stress:-5});effects.push('Uyğun mentor olmadığından fərdi dəstək planı quruldu.');}}
      if(choiceId==='support'){cp({confidence:7,trust:5,stress:-9});}
      if(choiceId==='challenge'){cp({confidence:pro>75?2:-7,stress:9,trust:-3});}
      if(choiceId==='bench'){benchPlayer(world,player);cp({stress:-5,morale:-3});}break;
    case 'veteran_role':
      if(choiceId==='mentor'){player.psych.roleIntent='mentor';cp({morale:6,trust:5,leadership:2});const young=own(world).find(x=>x.age<=23&&x.id!==player.id);if(young)effects.push(assignMentor(world,player.id,young.id).message);}
      if(choiceId==='rotate'){promise(world,player,45);cp({trust:5,morale:5});}
      if(choiceId==='honest'){cp({trust:pro>65?4:1,morale:-2});ct({fairness:3});}
      if(choiceId==='cut'){cp({morale:-11,trust:-9});groupEffect(world,'experienced',{trust:-5,morale:-3},effects);ct({cohesion:-4});}break;
    case 'clique_conflict':
      if(choiceId==='bridge'){ct({cohesion:8,fairness:3});for(const x of own(world))x.trust=clamp(x.trust+2);state.relationships['young:experienced']=clamp((state.relationships['young:experienced']??50)+10);}
      if(choiceId==='captains'){ct({cohesion:state.managerTrust>50?6:-2,managerTrust:2});cp({leadership:2});}
      if(choiceId==='strict'){ct({fairness:4,cohesion:state.managerTrust>60?2:-4});for(const x of own(world))x.psych.stress=clamp(x.psych.stress+3);}
      if(choiceId==='ignore'){ct({cohesion:-8,managerTrust:-3});}break;
    case 'red_card':
      if(choiceId==='review'){cp({professionalism:4,temperament:-4,trust:2,stress:-2});ct({fairness:2});}
      if(choiceId==='fine'){fine(world,player,.15,effects);cp({professionalism:4,temperament:-3,trust:-3,morale:-3});}
      if(choiceId==='defend'){cp({trust:6,confidence:2});ct({cohesion:3,mediaPressure:3});}
      if(choiceId==='bench'){benchPlayer(world,player);cp({morale:-7,trust:-4,stress:4});ct({fairness:1});}effects.push('Rəsmi matç cəzası dəyişdirilmədi.');break;
    case 'board_relative':
      if(choiceId==='merit'){ct({fairness:8,managerTrust:4,boardTrust:-4});cp({trust:2,stress:-2});}
      if(choiceId==='trial'){promise(world,player,30);cp({trust:4,confidence:3});ct({fairness:4,boardTrust:1});}
      if(choiceId==='pressure'){startPlayer(world,player);ct({boardTrust:8,fairness:-12,cohesion:-7,managerTrust:-6});cp({morale:5,ego:3});for(const x of own(world).filter(x=>x.id!==player.id))x.trust=clamp(x.trust-4);effects.push('Futbolçu eyni mövqedəki oyunçunun yerinə əsas heyətə daxil edildi.');}
      if(choiceId==='refuse'){ct({boardTrust:-10,fairness:6,managerTrust:4,mediaPressure:5});}break;
    case 'media_smear':
      if(choiceId==='verify'){ct({mediaPressure:-1,fairness:3});addEvent(world,'tv_criticism',player,{key:`media-facts:${event.id}`,verified:true},'unsubstantiated',(world.day??1)+1);effects.push('Növbəti gün faktlara əsaslanan açıqlama üçün redaksiya cavabı gələcək.');}
      if(choiceId==='facts'){ct({mediaPressure:-7,managerTrust:3});cp({trust:3,stress:-3});}
      if(choiceId==='attack'){ct({mediaPressure:12,boardTrust:-3});cp({stress:4});}
      if(choiceId==='ignore'){ct({mediaPressure:4});cp({stress:2});}break;
    case 'social_backlash':
      if(choiceId==='support'){cp({confidence:6,trust:6,stress:-8});}
      if(choiceId==='break'){cp({confidence:3,trust:4,stress:-10});player.psych.mediaBreakUntil=(world.day??1)+3;}
      if(choiceId==='attack'){ct({mediaPressure:10});cp({stress:7,morale:ego>75?2:-2});}
      if(choiceId==='ignore'){cp({confidence:player.age<=22?-5:-1,trust:-3,stress:4});}break;
    case 'tv_criticism':
      if(choiceId==='tactical'){ct({mediaPressure:-6,managerTrust:2});cp({confidence:2});}
      if(choiceId==='accountable'){ct({cohesion:4,managerTrust:4,boardTrust:-2});cp({trust:3});}
      if(choiceId==='defend'){ct({cohesion:3});cp({trust:6,confidence:3});}
      if(choiceId==='attack'){ct({mediaPressure:10,boardTrust:-3});cp({stress:3});}break;
    case 'training_conflict':
      if(choiceId==='mediate'){ct({cohesion:7,fairness:4});state.relationships['young:experienced']=clamp((state.relationships['young:experienced']??50)+12);}
      if(choiceId==='youth'){groupEffect(world,'young',{morale:4},effects);groupEffect(world,'experienced',{trust:-7,morale:-3},effects);ct({fairness:-5,cohesion:-4});}
      if(choiceId==='veteran'){groupEffect(world,'experienced',{morale:4},effects);groupEffect(world,'young',{trust:-7,stress:5},effects);ct({fairness:-5,cohesion:-4});}
      if(choiceId==='ignore'){ct({cohesion:-7,managerTrust:-2});}break;
    case 'contract_discontent':
      if(choiceId==='negotiate'){player.psych.roleIntent='contract_review';cp({trust:5,morale:3});effects.push('Müqavilə baxışı niyyəti saxlanıldı; real müqavilə ekranında qərar verilməlidir.');}
      if(choiceId==='explain'){cp({trust:pro>65?4:1,morale:-2});ct({fairness:3});}
      if(choiceId==='promise'){promise(world,player,60);cp({trust:4,morale:4});}
      if(choiceId==='transfer'){player.psych.roleIntent='transfer';cp({trust:3,morale:2});}break;
    case 'captain_challenge':
      if(choiceId==='private'){cp({trust:6,leadership:1});ct({cohesion:3});}
      if(choiceId==='shared'){cp({leadership:3,trust:3,ego:1});ct({cohesion:4});}
      if(choiceId==='replace'){player.psych.roleIntent='removed_captain';cp({morale:-9,trust:-7});groupEffect(world,player.group,{trust:-3},effects);ct({cohesion:-3});}
      if(choiceId==='ignore'){cp({trust:-4});ct({managerTrust:-4});}break;
    case 'fitness_overload':
      if(choiceId==='rest'){player.fitness=clamp(num(player.fitness,70)+12);player.fatigue=clamp(num(player.fatigue,20)-15);cp({trust:4,stress:-5});}
      if(choiceId==='listen'){player.fatigue=clamp(num(player.fatigue,20)-7);cp({trust:5,stress:-5});}
      if(choiceId==='push'){player.fitness=clamp(num(player.fitness,70)-5);player.fatigue=clamp(num(player.fatigue,20)+12);cp({morale:pro>75?1:-4,stress:8});}
      if(choiceId==='medical'){world.budget-=200;player.fitness=clamp(num(player.fitness,70)+8);player.fatigue=clamp(num(player.fatigue,20)-10);cp({trust:5,stress:-4});effects.push('Tibbi qiymətləndirmə: −€200.');}break;
    case 'playing_time':
      if(choiceId==='merit'){cp({trust:pro>65?3:-2,morale:-2});ct({fairness:3});}
      if(choiceId==='promise'){promise(world,player,45);cp({trust:5,morale:5});}
      if(choiceId==='loan'){player.psych.roleIntent='loan';cp({trust:3,morale:2});}
      if(choiceId==='ignore'){cp({trust:ego>70?-8:-4,morale:-6});}break;
  }
  event.status='resolved';event.choiceId=choiceId;event.resolvedDay=world.day??1;event.outcome=`${selected.label}: qərarın nəticəsi komanda yaddaşına yazıldı.`;
  audit(world,event.type,`${event.title} — ${player.name}: ${selected.label}.`,effects);
  media(world,['media_smear','tv_criticism'].includes(event.type)?'tv':['social_backlash','star_ego'].includes(event.type)?'social':'club',event.title,`Oyundaxili xəbər: ${player.name} ilə bağlı məşqçi “${selected.label}” yolunu seçdi. ${effects.slice(0,2).join('; ')}.`,state.mediaPressure>65?'critical':choiceId==='attack'?'critical':'neutral');
  return {ok:true,message:event.outcome,effects};
}

export function assignMentor(world,mentorId,menteeId){
  ready(world);const mentor=find(world,mentorId),mentee=find(world,menteeId),state=world.psychology;
  if(!mentor||!mentee||mentorId===menteeId||mentor.clubId!==world.userClubId||mentee.clubId!==world.userClubId||mentor.age<27||mentee.age>23||mentor.age-mentee.age<5)return {ok:false,message:'Mentor ən azı 27 yaşında, gənc 23 və ya daha az yaşda, hər ikisi eyni klubda olmalıdır.',effects:[]};
  if(state.mentorships.some(m=>m.status==='active'&&m.menteeId===menteeId))return {ok:false,message:'Bu gəncin artıq aktiv mentoru var.',effects:[]};
  if(state.mentorships.filter(m=>m.status==='active'&&m.mentorId===mentorId).length>=2)return {ok:false,message:'Bir mentor eyni vaxtda ən çox iki gənclə işləyə bilər.',effects:[]};
  const compatibility=clamp(mentor.psych.professionalism*.35+mentor.psych.leadership*.35+mentor.trust*.2+(mentor.role===mentee.role?12:3)-Math.max(0,mentor.psych.ego-70)*.3);
  state.mentorships.push({mentorId,menteeId,startDay:world.day??1,lastDay:world.day??1,sessions:0,compatibility,status:'active'});
  const effects=[];changePlayer(mentor,{morale:2},effects);changePlayer(mentee,{trust:2,confidence:2},effects);
  audit(world,'mentoring',`${mentor.name} → ${mentee.name}: mentorluq quruldu. Uyğunluq ${Math.round(compatibility)}/100.`,effects);
  return {ok:true,message:`${mentor.name} artıq ${mentee.name} üçün mentordur. Həftəlik nəticə izlənəcək; uyğunluq ${Math.round(compatibility)}/100.`,effects};
}
export function setCoachStyle(world,style){ready(world);if(!styles.includes(style))return {ok:false,message:'Məşqçi üslubu uyğun deyil.',effects:[]};world.psychology.policies.coachStyle=style;return {ok:true,message:'Soyunub-geyinmə otağı üslubu saxlanıldı.',effects:[]};}
export function holdTeamMeeting(world,approach='supportive'){
  ready(world);const state=world.psychology;if(state.lastMeetingDay>=1&&(world.day??1)-state.lastMeetingDay<3)return {ok:false,message:'Komanda görüşündən sonra ən azı üç gün vaxt ver.',effects:[]};
  const result=giveTeamTalk(world,'meeting',approach,{fixtureId:`meeting-${world.day}`});if(result.ok)state.lastMeetingDay=world.day??1;return result;
}
export function giveTeamTalk(world,phase,style,context={}){
  ready(world);const state=world.psychology;
  if(!['pre_match','half_time','post_match','meeting'].includes(phase)||!styles.includes(style))return {ok:false,message:'Çıxış növü uyğun deyil.',effects:[]};
  const fixture=context.fixtureId??world.activeFixtureId??`${world.season??1}-${world.round??0}`,key=`${fixture}:${phase}`;
  if(state.talkKeys.includes(key))return {ok:false,message:'Bu mərhələdə komanda çıxışı artıq edilib.',effects:[]};
  state.talkKeys.push(key);const effects=[],score=context.score??[0,0],trailing=score[0]<score[1],winning=score[0]>score[1];
  for(const player of own(world)){
    const pro=player.psych.professionalism,trust=player.trust,young=player.age<=22;let values={};
    if(style==='calm')values={stress:-6,confidence:2,focusBoost:2};
    if(style==='supportive')values={stress:-7,confidence:young?6:3,trust:2,focusBoost:2};
    if(style==='inspire')values={morale:trust>40?5:1,confidence:3,focusBoost:player.psych.ambition>60?5:2,stress:1};
    if(style==='tactical')values={stress:-2,focusBoost:5,confidence:1};
    if(style==='demanding')values=pro>65&&trust>50?{focusBoost:6,morale:2,stress:4}:{focusBoost:-2,morale:-4,trust:-3,stress:7};
    if(style==='angry')values=pro>75&&trust>65&&trailing?{focusBoost:5,stress:7,morale:1}:{focusBoost:young?-5:-2,confidence:winning?-7:-5,morale:-6,trust:-4,stress:young?12:8};
    changePlayer(player,values,effects);player.psych.focusBoost=clamp(player.psych.focusBoost,-15,15);player.psych.focusUntilRound=(world.round??0)+1;
  }
  if(style==='angry')changeTeam(world,{cohesion:state.managerTrust<50?-5:-1,managerTrust:-2},effects);
  if(style==='supportive')changeTeam(world,{cohesion:2},effects);
  if(phase==='post_match'&&context.public&&style==='angry')changeTeam(world,{mediaPressure:8},effects);
  audit(world,'team_talk',`${{pre_match:'Oyunöncəsi',half_time:'Fasilədə',post_match:'Oyundan sonra',meeting:'Komanda görüşü'}[phase]} çıxış: ${style}.`,effects.slice(0,12));
  return {ok:true,message:`Çıxış tamamlandı. ${own(world).length} futbolçu xarakteri və münasibətinə uyğun reaksiya verdi.`,effects};
}
export function reactToSubstitution(world,outgoingId,incomingId,minute,reason='tactical',style='private',context={}){
  ready(world);const outgoing=find(world,outgoingId),incoming=find(world,incomingId),state=world.psychology;
  if(!outgoing||!incoming||outgoing.id===incoming.id||outgoing.clubId!==world.userClubId||incoming.clubId!==world.userClubId||!Number.isFinite(minute)||minute<0||minute>130)return {ok:false,message:'Əvəzetmə məlumatı uyğun deyil.',effects:[]};
  const key=`${context.fixtureId??world.activeFixtureId??`${world.season}-${world.round}`}:${outgoingId}:${incomingId}:${Math.floor(minute)}`;
  if(state.substitutionKeys.includes(key))return {ok:false,message:'Bu əvəzetmə reaksiyası artıq qeydə alınıb.',effects:[]};state.substitutionKeys.push(key);
  const effects=[],early=minute<30,late=minute>=80,justified=['injury','fitness','fatigue','medical'].includes(reason),publicTone=style==='public',ego=outgoing.psych.ego;
  let hurt=justified?-1:early?ego>70?-11:-6:late?-1:-3;
  if(publicTone&&!justified)hurt-=3;
  changePlayer(outgoing,{morale:hurt,trust:justified?2:publicTone?-4:early?-3:1,stress:justified?-2:early?6:1},effects);
  if(early&&!justified){groupEffect(world,outgoing.group,{trust:ego>70?-3:-1},effects);changeTeam(world,{cohesion:ego>70?-2:0},effects);}
  changePlayer(incoming,{confidence:late&&incoming.age<=22?-1:3,morale:late&&incoming.age<=22&&incoming.psych.ambition>70?-3:4,stress:incoming.age<=21&&minute<60?4:1},effects);
  if(outgoing.age>=30&&style==='private'&&justified)changePlayer(outgoing,{leadership:1},effects);
  if(early&&!justified)outgoing.psych.substitutionConcern={fixtureId:context.fixtureId??'',minute,reason,day:world.day??1};
  audit(world,'substitution',`${Math.round(minute)}′: ${outgoing.name} → ${incoming.name}. Səbəb: ${reason}; üslub: ${style}.`,effects);
  return {ok:true,message:early&&!justified?'Erkən əvəzetmə futbolçunun nüfuzuna və qrup münasibətinə təsir etdi.':late&&incoming.age<=22?'Gənc futbolçu gec dəqiqələrini məhdud imkan kimi qiymətləndirdi.':'Əvəzetmənin səbəbi və üslubu futbolçuların reaksiyasına təsir etdi.',effects};
}
export function playerPsychologyEffect(player,world){
  const p=player.psych??{},state=world.psychology??{},morale=num(player.morale,65),confidence=num(player.confidence,65),trust=num(player.trust,60),stress=num(p.stress,20);
  const boost=(world.round??0)<=num(p.focusUntilRound,0,0,1e7)?num(p.focusBoost,0,-15,15):0;
  return {
    focus:rounded(clamp(62+(confidence-60)*.22+(num(p.professionalism,60)-60)*.16+(trust-60)*.08-stress*.18+boost,35,95)),
    discipline:rounded(clamp(num(p.professionalism,60)*.65+(100-num(p.temperament,50))*.35-stress*.12,20,95)),
    cooperation:rounded(clamp(60+(num(state.cohesion,65)-60)*.3+(trust-60)*.2-(num(p.ego,50)-50)*.12,30,95)),
    moraleModifier:rounded(clamp((morale-60)*.12+(confidence-60)*.08-stress*.04+boost*.2,-12,10)),
    composure:rounded(clamp(50+num(p.experience,45)*.3+confidence*.2-stress*.25,25,95)),
    stress,confidence,morale,trust,
  };
}
