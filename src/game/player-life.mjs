/** Original player-life rules. Relationships and mental values are game mechanics. */
const clamp=(value,lo=0,hi=100)=>Math.max(lo,Math.min(hi,value));
const number=(value,fallback=0,lo=0,hi=100)=>Number.isFinite(value)?clamp(value,lo,hi):fallback;
const integer=(value,fallback=0,lo=0,hi=1e7)=>Math.floor(number(value,fallback,lo,hi));
const text=(value,fallback='',limit=600)=>typeof value==='string'?value.replace(/[\u0000-\u001f\u007f]/g,'').slice(0,limit):fallback;
const object=value=>value&&typeof value==='object'&&!Array.isArray(value)?value:{};
const hash=value=>{let n=2166136261;for(const c of String(value)){n^=c.charCodeAt(0);n=Math.imul(n,16777619);}return n>>>0;};
const dayOf=player=>integer(player.day,1,1);
const round=value=>Math.round(value*10)/10;
const choice=(id,label,preview)=>({id,label,preview});

export const PLAYER_LIFESTYLE_ITEMS=Object.freeze([
  {id:'home_flat',title:'Öz kiçik mənzilin',category:'home',cost:3500,upkeep:5,description:'Şəxsi məkan və sabit istirahət; gündəlik saxlanma €5.'},
  {id:'home_villa',title:'Geniş ev',category:'home',cost:150000,upkeep:25,description:'Rahatlıq artır, yüksək ödəniş və gündəlik saxlanma öhdəliyi yaranır.'},
  {id:'car_compact',title:'Şəhər avtomobili',category:'car',cost:9000,upkeep:5,description:'Gediş-gəliş rahatlığı; yanacaq və saxlanma gündə €5.'},
  {id:'car_sport',title:'İdman avtomobili',category:'car',cost:70000,upkeep:18,description:'Şəxsi seçim və görünürlük; yüksək saxlanma öhdəliyi.'},
  {id:'pet_cat',title:'Pişik sahiblən',category:'pet',cost:180,upkeep:2,description:'Ev həyatı və məsuliyyət; qulluq gündə €2.'},
  {id:'pet_dog',title:'İt sahiblən',category:'pet',cost:350,upkeep:3,description:'Gəzinti və yoldaşlıq; qulluq gündə €3.'},
]);
export const PLAYER_APPEARANCE_OPTIONS=Object.freeze({hair:['short','shaved','long'],beard:['none','short'],boots:['black','white','red','gold'],skin:[0,1,2,3,4]});
export const PLAYER_LIFE_ACTIVITIES=Object.freeze([
  {id:'family_time',title:'Ailə ilə vaxt keçir',cost:30,energy:4,description:'Ailə münasibəti və rahatlıq artır; bir hazırlıq günü.'},
  {id:'team_bonding',title:'Komanda yoldaşları ilə görüş',cost:25,energy:8,description:'Soyunub-geyinmə otağında münasibət və əməkdaşlıq.'},
  {id:'media_training',title:'Mətbuatla ünsiyyət məşqi',cost:60,energy:8,description:'Təzyiqə cavab verməyi məşq et; peşəkarlıq və mətbuat etimadı.'},
  {id:'mindfulness',title:'Sakitlik və diqqət seansı',cost:20,energy:0,description:'Gərginlik azalır; məşq və matç üçün diqqətini topla.'},
  {id:'study',title:'Oyun epizodlarını öyrən',cost:0,energy:10,description:'Məşqçi tapşırığını və taktiki məsuliyyəti anla.'},
  {id:'gym',title:'Fərdi fiziki hazırlıq',cost:40,energy:20,description:'Fiziki hazırlıq artır; enerji və bərpa tələb olunur.'},
  {id:'mentor_session',title:'Təcrübəli futbolçu ilə məşq',cost:0,energy:10,description:'Uyğun mentorla öyrən; bir mentor məşqi arasında üç gün.'},
]);

const catalog={
  coach_feedback:{title:'Məşqçi səninlə danışmaq istəyir',body:'Məşqçi mövqeyindəki məsuliyyəti və hazırkı məşq formana münasibətini izah edir. Cavabın gələcək etimada təsir edəcək.',choices:[choice('listen','Dinlə və konkret tapşırıq istə','Etimad və diqqət artır; dərhal əsas heyət təminatı yoxdur.'),choice('work','Əlavə işlə cavab ver','Enerji sərf olunur, peşəkarlıq və məşqçi etimadı artır.'),choice('challenge','Seçimə hamının yanında etiraz et','Öz mövqeyini bildirirsən, amma etimad və komanda münasibəti zədələnə bilər.')]},
  team_role:{title:'Oyun vaxtın barədə seçim',body:'Daha çox dəqiqə istəyirsən. Forma, enerji və məşqçinin etimadı heyət qərarında rol oynayır.',choices:[choice('ask','Şəxsi görüşdə inkişaf planı istə','Məşqçi ilə münasibət və diqqət artır; seçim zəmanəti verilmir.'),choice('patient','Məşqdə səbirli və ardıcıl ol','Peşəkarlıq artır, amma dərhal məmnunluq zəifdir.'),choice('complain','Mətbuatda oyun vaxtından gileylən','Görünürlük artır; məşqçi və komanda etimadı azalır.')]},
  late_training:{title:'Məşqə gecikmisən',body:'Bir dəfəlik problem ilə təkrar vərdiş fərqlidir. Məşqçi məsuliyyəti necə qəbul etdiyini izləyir.',choices:[choice('apologize','Səbəbi izah et və üzr istə','Peşəkarlıq artır, kiçik etimad itkisi qalır.'),choice('fine','Qaydaya uyğun 10% maaş cəriməsini qəbul et','Şəxsi büdcədən ödəniş; məsuliyyət qəbul edilir.'),choice('excuse','Başqalarını günahlandır','Müvəqqəti rahatlıq, məşqçi və komanda etimadı itkisi.')]},
  nightlife:{title:'Gecə həyatı barədə şayiə',body:'Uydurma sosial kanalda matçdan əvvəl gecə çöldə olduğun iddia edilir. Xəbər hələ təsdiqlənməyib.',choices:[choice('investigate','Tarixi və faktları yoxlat','Növbəti gün araşdırma nəticəsi gələcək; şayiə günah sayılmır.'),choice('private','Məşqçi ilə şəxsi danış','Şəffaflıq etimadı qoruyur; gərginlik azala bilər.'),choice('attack','İctimai emosional cavab ver','Diqqət artır, mətbuat münasibəti və gərginlik pisləşə bilər.')]},
  nightlife_confirmed:{title:'Araşdırma qayda pozuntusunu təsdiqlədi',body:'Matçöncəsi komanda qaydasını pozduğun təsdiqləndi. Bu nəticə oyunun uydurma hadisəsinə aiddir.',choices:[choice('apologize','Məsuliyyəti qəbul et','Etimad azalır, amma peşəkar davranış bərpaya kömək edir.'),choice('recovery','Bərpa planını qəbul et','Enerji və diqqət üçün bərpa; məşqçi narazılığı dərhal silinmir.'),choice('deny','Təsdiqlənmiş faktı yenə inkar et','Məşqçi və komanda etimadı daha ciddi azalır.')]},
  nightlife_unfounded:{title:'Şayiə təsdiqlənmədi',body:'Paylaşımın köhnə olduğu müəyyənləşdi. Faktlarla sakit düzəliş etmək mümkündür.',choices:[choice('facts','Sakit fakt paylaş','Mətbuat etimadı və özünəinam artır, təzyiq azalır.'),choice('move_on','Mövzunu bağlayıb işə qayıt','Gərginlik azalır; diqqət məşqdə qalır.'),choice('gloat','Hamını ictimai şəkildə alçalt','Bəzi izləyicilər artar, peşəkar münasibət zədələnər.')]},
  teammate_rivalry:{title:'Eyni mövqedə rəqabət',body:'Komanda yoldaşın da sənin mövqeyində oynamaq istəyir. Rəqabət əməkdaşlıq və ya şəxsi mübahisəyə çevrilə bilər.',choices:[choice('cooperate','Birlikdə məşq etməyi təklif et','Komanda münasibəti və əməkdaşlıq artır.'),choice('compete','Hörmətlə yarışmağa razılaş','Peşəkarlıq və iddia artır; bir qədər gərginlik qalır.'),choice('mock','Onu hamının yanında kiçilt','Komanda etimadı və məşqçi münasibəti azalır.')]},
  mentor_invitation:{title:'Təcrübəli oyunçunun təklifi',body:'Təcrübəli komanda yoldaşı məşq epizodlarını birlikdə təhlil etməyi təklif edir. Uyğun münasibət vaxtla inkişaf etdirir.',choices:[choice('accept','Mentorla işləməyə razılaş','Uyğun təcrübəli komanda yoldaşı varsa davamlı mentor əlaqəsi yaranır.'),choice('ask','Əvvəl konkret məsləhət istə','Diqqət və etimad artır; daimi mentor əlaqəsi başlamır.'),choice('refuse','Təklifi nəzakətlə rədd et','Müstəqillik saxlanır, potensial öyrənmə imkanı qaçır.')]},
  family_request:{title:'Ailən sənə vaxt ayırmağını istəyir',body:'Məşq, səfər və şəxsi həyat arasında vaxt bölməlisən. Münasibətləri yalnız nəticə ilə ölçmək olmur.',choices:[choice('visit','Vaxt ayır və görüş','€30, ailə münasibəti və rahatlıq; bir qədər enerji sərfi.'),choice('call','Səmimi danış və vaxt planlaşdır','Kiçik münasibət yaxşılaşması; dərhal görüş mümkün deyil.'),choice('ignore','Cavabsız qoy','İşə vaxt qalır, ailə münasibəti və gərginlik pisləşir.')]},
  press_interview:{title:'Matçdan sonrakı müsahibə',body:'Uydurma “Oyun Səsi” kanalı oyununu və gələcək məqsədini soruşur. Sözlərin məşqçiyə, azarkeşlərə və komandaya çatacaq.',choices:[choice('team','Komandanın əməyini vurğula','Komanda və azarkeş etimadı artır.'),choice('honest','Öz performansını dürüst qiymətləndir','Peşəkarlıq və mətbuat münasibəti artır.'),choice('star','Yalnız özünü önə çıxar','Görünürlük artır; komanda münasibəti zəifləyir.')]},
  social_pressure:{title:'Sosial şəbəkədə sərt rəylər',body:'Uydurma sosial şəbəkədə bəzi şərhlər səni narahat edir. Futbol tənqidi ilə şəxsi təhqiri fərqləndirmək vacibdir.',choices:[choice('break','Qısa sosial media fasiləsi ver','Stress azalır; görünürlük artmır.'),choice('support','Yaxınlarınla danış','Ailə etimadı və özünəinam artır.'),choice('argue','Şərhlərlə uzun mübahisəyə gir','Diqqət artır, amma enerji və gərginlik bahasına.')]},
  sponsor_offer:{title:'Kiçik sponsorun təklifi',body:'Uydurma yerli idman mağazası çəkiliş üçün €250 təklif edir. Vaxt, enerji və verilən mesaj barədə qərar verməlisən.',choices:[choice('accept','Şəffaf reklam razılaşmasını qəbul et','€250, −8 enerji; azarkeş görünürlüğü və əlavə təzyiq.'),choice('defer','Məşq cədvəlinə görə təxirə sal','Dərhal gəlir yoxdur, peşəkarlıq və məşqçi etimadı artır.'),choice('reject','Hazırda reklama çıxma','Məşqə diqqət, əlavə öhdəlik və gəlir yoxdur.')]},
  recovery_warning:{title:'Bədənin bərpa istəyir',body:'Yorğunluq və gərginlik artıb. Riskli həddə məşq etmək əvəzinə yük barədə danışa bilərsən.',choices:[choice('rest','Bərpanı prioritet et','Enerji bərpa olunur, diqqət və gərginlik yaxşılaşır.'),choice('talk','Yükü məşqçi ilə müzakirə et','Etimad artır; dərhal enerji tam bərpa olunmur.'),choice('push','Yorğunluğu gizlədib yüklən','Qısa iddia mesajı, enerji itkisi və gərginlik artımı.')]},
  red_card:{title:'Qırmızı kartdan sonra',body:'Meydanı erkən tərk etmisən. Rəsmi cəza qüvvədə qalır; hadisəni necə qəbul etdiyin münasibətlərə təsir edir.',choices:[choice('review','Epizodu sakit təhlil et','Peşəkarlıq və diqqət artır; cəza silinmir.'),choice('apologize','Komandadan üzr istə','Komanda münasibəti yaxşılaşır; özünəinam tədricən bərpa olur.'),choice('blame','Bütün məsuliyyəti hakimə yüklə','Mətbuat səs-küyü artır, peşəkarlıq və münasibət azalır.')]},
  financial_stress:{title:'Saxlanma ödənişi yığılıb',body:'Ev, avtomobil və heyvana qulluq öhdəliklərinin bir hissəsini ödəyə bilməmisən. Büdcəni gəlirə uyğunlaşdırmaq lazımdır.',choices:[choice('plan','Büdcə planını nəzərdən keçir','Gərginlik bir qədər azalır; borc faktiki ödənməyənədək qalır.'),choice('ask','Yaxınından məsləhət istə','Ailə ilə münasibət və özünəinam; avtomatik pul verilmir.'),choice('ignore','Öhdəliyi görməzliyə vur','Stress artır, borc silinmir.')]},
};
export const PLAYER_LIFE_EVENT_TYPES=Object.freeze(Object.keys(catalog));

function safeEvent(raw){
  const e=object(raw);if(!Object.hasOwn(catalog,e.type)||!text(e.id))return null;
  return {...e,id:text(e.id,'',100),type:e.type,title:text(e.title,catalog[e.type].title,160),body:text(e.body,catalog[e.type].body),day:integer(e.day,1,1),dueDay:integer(e.dueDay,integer(e.day,1,1),1),status:['pending','scheduled','resolved'].includes(e.status)?e.status:'pending',evidence:['confirmed','rumour','unsubstantiated'].includes(e.evidence)?e.evidence:'confirmed',context:object(e.context),choices:catalog[e.type].choices.map(c=>({...c})),outcome:text(e.outcome),effects:Array.isArray(e.effects)?e.effects.map(v=>text(v,'',180)).slice(0,20):[]};
}
function addEvent(player,journey,type,context={},evidence='confirmed',dueDay=dayOf(player)){
  const l=journey.life,key=context.key??`${journey.season??1}:${dayOf(player)}:${type}`;
  if(!Object.hasOwn(catalog,type)||l.events.some(e=>e.context?.key===key))return null;
  const event={id:`player-life-${++l.sequence}`,type,title:catalog[type].title,body:catalog[type].body,day:dayOf(player),dueDay,status:dueDay>dayOf(player)?'scheduled':'pending',evidence,context:{...context,key},choices:catalog[type].choices.map(c=>({...c})),outcome:'',effects:[]};
  l.events.push(event);l.events=l.events.slice(-120);return event;
}
function note(player,l,type,message,effects=[]){l.history.unshift({id:`player-note-${++l.sequence}`,day:dayOf(player),type,message,effects:effects.slice(0,16)});l.history=l.history.slice(0,100);}
function media(player,l,channel,title,body,sentiment='neutral'){l.media.unshift({id:`player-media-${++l.sequence}`,day:dayOf(player),channel,title,body,sentiment,fictional:true});l.media=l.media.slice(0,60);}
function change(player,l,values,effects){for(const [key,delta] of Object.entries(values)){const target=['energy','fitness','morale','reputation'].includes(key)?player:l;const before=number(target[key],key==='energy'?85:key==='morale'?70:50);target[key]=clamp(before+delta,key==='focusBoost'?-15:0,key==='focusBoost'?15:100);if(delta)effects.push(`${key}: ${delta>0?'+':''}${round(target[key]-before)}`);}}
function spend(player,amount){if(!Number.isFinite(player.balance)||player.balance<amount)return false;player.balance-=amount;return true;}
function ownPlayers(journey){return (Array.isArray(journey.players)?journey.players:[]).filter(p=>p.clubId===journey.clubId&&p.id!==journey.heroId);}
function mentorCandidates(journey){return ownPlayers(journey).filter(p=>p.age>=27&&number(p.psych?.professionalism,60)>=55);}

/** Normalize in place so callers do not retain stale references after nested decisions. */
export function ensurePlayerLife(player,journey){
  const l=journey.life=object(journey.life),day=dayOf(player);
  for(const [key,fallback]of Object.entries({confidence:65,stress:20,coachTrust:62,teammateTrust:60,fansTrust:40,pressTrust:45,familyTrust:70,professionalism:60,ambition:65}))l[key]=number(l[key],fallback);
  l.focusBoost=number(l.focusBoost,0,-15,15);l.focusUntilDay=integer(l.focusUntilDay,day,0);l.sequence=integer(l.sequence);l.lastProcessedDay=integer(l.lastProcessedDay,day,1,day);l.upkeepDebt=number(l.upkeepDebt,0,0,1e7);
  l.events=(Array.isArray(l.events)?l.events:[]).map(safeEvent).filter(Boolean).slice(-120);
  l.history=(Array.isArray(l.history)?l.history:[]).filter(x=>x&&typeof x==='object').slice(0,100);
  l.media=(Array.isArray(l.media)?l.media:[]).filter(x=>x&&typeof x==='object').slice(0,60).map(x=>({...x,fictional:true}));
  l.processedDays=(Array.isArray(l.processedDays)?l.processedDays:[]).filter(Number.isFinite).slice(-400);
  l.processedMatches=(Array.isArray(l.processedMatches)?l.processedMatches:[]).filter(x=>typeof x==='string').slice(-300);
  l.activityDays=Object.fromEntries(Object.entries(object(l.activityDays)).filter(([key])=>PLAYER_LIFE_ACTIVITIES.some(a=>a.id===key)).map(([key,value])=>[key,integer(value,0,0,day)]));
  l.possessions=[...new Set((Array.isArray(l.possessions)?l.possessions:[]).filter(id=>PLAYER_LIFESTYLE_ITEMS.some(item=>item.id===id)))];
  l.equipped=object(l.equipped);for(const category of ['home','car','pet'])if(!l.possessions.some(id=>id===l.equipped[category]&&PLAYER_LIFESTYLE_ITEMS.find(p=>p.id===id)?.category===category))l.equipped[category]=null;
  l.appearance=object(l.appearance);for(const [field,options]of Object.entries(PLAYER_APPEARANCE_OPTIONS))if(!options.includes(l.appearance[field]))l.appearance[field]=options[0];l.appearance.jerseyNumber=integer(l.appearance.jerseyNumber,10,2,99);
  l.unlockedBoots=[...new Set(['black',...(Array.isArray(l.unlockedBoots)?l.unlockedBoots:[]).filter(v=>PLAYER_APPEARANCE_OPTIONS.boots.includes(v))])];if(!l.unlockedBoots.includes(l.appearance.boots))l.appearance.boots='black';
  l.relationships=Object.fromEntries(Object.entries(object(l.relationships)).slice(0,50).filter(([key])=>typeof key==='string'&&key.length<=100).map(([key,value])=>[key,number(value,60)]));
  if(l.mentor){const m=object(l.mentor),person=mentorCandidates(journey).find(p=>p.id===m.playerId);l.mentor=person?{...m,playerId:person.id,name:person.name,status:m.status==='ended'?'ended':'active',lastDay:integer(m.lastDay,day,1,day),lastSessionDay:integer(m.lastSessionDay,0,0,day),sessions:integer(m.sessions),compatibility:number(m.compatibility,65)}:null;}
  if(!l.initialized){l.initialized=true;addEvent(player,journey,'coach_feedback',{key:'initial-coach'});addEvent(player,journey,'mentor_invitation',{key:'initial-mentor'});addEvent(player,journey,'family_request',{key:'initial-family'});media(player,l,'club','Yeni yol başlayır','Bu karyeranın klubları, şəxsləri və media hekayələri oyunun uydurma dünyasına aiddir.');}
  return l;
}
function assignMentor(player,journey,id){
  const l=journey.life,candidates=mentorCandidates(journey),person=id?candidates.find(p=>p.id===id):candidates.sort((a,b)=>number(b.psych?.leadership,60)-number(a.psych?.leadership,60))[0];
  if(!person)return {ok:false,message:'Hazırkı klubunda uyğun 27+ yaşlı mentor yoxdur.',effects:[]};
  if(l.mentor?.status==='active'&&l.mentor.playerId===person.id)return {ok:false,message:'Bu mentorla artıq işləyirsən.',effects:[]};
  const professionalism=number(person.psych?.professionalism,60),leadership=number(person.psych?.leadership,60),compatibility=clamp(professionalism*.6+leadership*.25+l.teammateTrust*.15-Math.abs(l.ambition-number(person.psych?.ambition,60))*.2);
  l.mentor={playerId:person.id,name:person.name,status:'active',lastDay:dayOf(player),lastSessionDay:0,sessions:0,compatibility:round(compatibility)};l.relationships[person.id]=60;return {ok:true,message:`${person.name} mentorun oldu.`,effects:[]};
}
function processDays(player,journey){
  const l=journey.life,day=dayOf(player),elapsed=day-l.lastProcessedDay;if(elapsed<=0)return;
  const due=PLAYER_LIFESTYLE_ITEMS.filter(item=>l.possessions.includes(item.id)).reduce((sum,item)=>sum+item.upkeep,0)*elapsed;
  if(due){const paid=Math.min(number(player.balance,0,0,1e9),due);player.balance-=paid;l.upkeepDebt+=due-paid;note(player,l,'upkeep',`${elapsed} gün üçün şəxsi saxlanma: €${due}; ödənildi €${paid}.`);if(due>paid){l.stress=clamp(l.stress+6);addEvent(player,journey,'financial_stress',{key:`debt:${day}`});}}
  const comfort=!!l.equipped.home+!!l.equipped.pet;if(comfort){l.stress=clamp(l.stress-Math.min(8,elapsed*comfort));player.morale=clamp(number(player.morale,70)+Math.min(4,elapsed*comfort*.5));}
  if(day>l.focusUntilDay)l.focusBoost=0;
  const mentor=l.mentor;if(mentor?.status==='active'&&day-mentor.lastDay>=7){const sessions=Math.min(4,Math.floor((day-mentor.lastDay)/7)),effects=[];mentor.lastDay+=sessions*7;mentor.sessions+=sessions;
    if(mentor.compatibility>=55){change(player,l,{confidence:2*sessions,stress:-2*sessions,teammateTrust:sessions},effects);const key=journey.position==='DEF'?'defending':journey.position==='FWD'?'shooting':'passing';player.skills??={};player.skills[key]=clamp(number(player.skills[key],60)+.2*sessions);l.relationships[mentor.playerId]=clamp(number(l.relationships[mentor.playerId],60)+2*sessions);}
    else change(player,l,{stress:2*sessions,confidence:-sessions},effects);
    note(player,l,'mentoring',`${mentor.name}: ${sessions} mentor həftəsi ${mentor.compatibility>=55?'faydalı keçdi':'ünsiyyət çətinliyi yaratdı'}.`,effects);
  }
  l.lastProcessedDay=day;
}

/** Calendar and wages are owned by the session bridge; this only charges new elapsed upkeep. */
export function generatePlayerEvents(player,journey,context={}){
  const l=ensurePlayerLife(player,journey);processDays(player,journey);const day=dayOf(player);
  for(const e of l.events)if(e.status==='scheduled'&&e.dueDay<=day)e.status='pending';
  if(context.kind==='match'&&context.fixtureId&&!l.processedMatches.includes(context.fixtureId)){
    l.processedMatches.push(context.fixtureId);l.processedMatches=l.processedMatches.slice(-300);const effects=[],minutes=number(context.minutes,0,0,150),rating=number(context.rating,6,0,10),goals=integer(context.goals),assists=integer(context.assists);
    if(minutes>0){change(player,l,{confidence:(rating-6)*2,fansTrust:Math.max(-3,(rating-6)*1.5)+goals*2+assists,pressTrust:rating>=7?2:rating<5?-2:0,stress:rating<5?3:-1},effects);media(player,l,'press',rating>=7?'Gənc futbolçunun oyunu diqqət çəkdi':'Matçdan sonra dəyərləndirmə',`Uydurma “Oyun Səsi”: ${round(minutes)} dəqiqə, ${goals} qol, ${assists} assist; reytinq ${round(rating)}.`,rating>=7?'positive':rating<5?'critical':'neutral');if(rating>=7||goals>0)addEvent(player,journey,'press_interview',{key:`interview:${context.fixtureId}`});}
    else{change(player,l,{confidence:-2,stress:2},effects);addEvent(player,journey,'team_role',{key:`role:${context.fixtureId}`});}
    if(context.red||context.sentOff)addEvent(player,journey,'red_card',{key:`red:${context.fixtureId}`});
    if(rating<5&&minutes>0)addEvent(player,journey,'social_pressure',{key:`social:${context.fixtureId}`});
    note(player,l,'match',minutes>0?`Şəxsi matç dəyərləndirməsi: ${round(rating)}/10.`:'Bu tur oyun vaxtı almadın.',effects);
  }
  if(!l.processedDays.includes(day)){
    l.processedDays.push(day);l.processedDays=l.processedDays.slice(-400);
    const pending=l.events.filter(e=>e.status==='pending'||e.status==='scheduled').length;
    if(pending<5){const pool=['teammate_rivalry','social_pressure','late_training','nightlife','family_request','sponsor_offer','coach_feedback','recovery_warning','press_interview','mentor_invitation'];const key=pool[hash(`${journey.seed??27}:${day}`)%pool.length];addEvent(player,journey,number(player.energy,85)<30?'recovery_warning':key,{},key==='nightlife'?'rumour':'confirmed');}
  }
  return l.events.filter(e=>e.status==='pending');
}

export function resolvePlayerEvent(player,journey,eventId,choiceId){
  const l=ensurePlayerLife(player,journey),e=l.events.find(e=>e.id===eventId);
  if(!e||e.status!=='pending'||!e.choices.some(c=>c.id===choiceId))return {ok:false,message:'Bu qərar tapılmadı, vaxtı çatmayıb və ya artıq verilib.',effects:[]};
  const effects=[],cp=values=>change(player,l,values,effects),cost=e.type==='late_training'&&choiceId==='fine'?Math.round(number(player.salary,700,0,1e6)*.1):e.type==='family_request'&&choiceId==='visit'?30:0;
  if(cost&&!spend(player,cost))return {ok:false,message:`Bu seçim üçün €${cost} lazımdır.`,effects:[]};if(cost)effects.push(`Şəxsi büdcə: −€${cost}`);
  if(['coach_feedback','team_role'].includes(e.type)){
    if(['listen','ask'].includes(choiceId))cp({coachTrust:5,focusBoost:2,stress:-2});
    if(choiceId==='work'){if(number(player.energy,85)<8)return {ok:false,message:'Əlavə işdən əvvəl bərpa ol.',effects:[]};cp({energy:-8,coachTrust:7,professionalism:2,stress:1});}
    if(choiceId==='patient')cp({professionalism:3,coachTrust:2,morale:-1});
    if(['challenge','complain'].includes(choiceId)){cp({coachTrust:-8,teammateTrust:-3,stress:5,fansTrust:choiceId==='complain'?2:0});media(player,l,'social','Oyun vaxtı barədə mübahisə','Uydurma sosial kanallar futbolçunun narazılığını müzakirə edir.','critical');}
  }
  if(e.type==='late_training'){if(choiceId==='apologize')cp({coachTrust:-2,professionalism:3,stress:-1});if(choiceId==='fine')cp({coachTrust:1,professionalism:4,morale:-2});if(choiceId==='excuse')cp({coachTrust:-7,teammateTrust:-4,professionalism:-2});}
  if(e.type==='nightlife'){
    if(choiceId==='investigate'){const confirmed=hash(`${journey.seed??27}:${e.id}`)%2===0;addEvent(player,journey,confirmed?'nightlife_confirmed':'nightlife_unfounded',{key:`investigation:${e.id}`,sourceEventId:e.id},confirmed?'confirmed':'unsubstantiated',dayOf(player)+1);cp({stress:-1});}
    if(choiceId==='private')cp({coachTrust:3,stress:-2});if(choiceId==='attack'){cp({pressTrust:-6,stress:6,fansTrust:2});media(player,l,'social','Şayiəyə emosional cavab','Uydurma şayiə barədə mübahisə böyüyür.','critical');}
  }
  if(e.type==='nightlife_confirmed'){if(choiceId==='apologize')cp({coachTrust:-4,professionalism:4,teammateTrust:1});if(choiceId==='recovery')cp({coachTrust:-3,energy:16,stress:-4});if(choiceId==='deny')cp({coachTrust:-12,teammateTrust:-6,professionalism:-4,stress:6});}
  if(e.type==='nightlife_unfounded'){if(choiceId==='facts')cp({pressTrust:5,confidence:4,stress:-5});if(choiceId==='move_on')cp({focusBoost:3,stress:-4});if(choiceId==='gloat')cp({fansTrust:2,pressTrust:-5,professionalism:-2});}
  if(e.type==='teammate_rivalry'){if(choiceId==='cooperate')cp({teammateTrust:7,coachTrust:2,stress:-2});if(choiceId==='compete')cp({professionalism:3,ambition:2,stress:2});if(choiceId==='mock')cp({teammateTrust:-10,coachTrust:-5,stress:4});}
  if(e.type==='mentor_invitation'){if(choiceId==='accept'){const result=assignMentor(player,journey);if(!result.ok)return result;effects.push(result.message);cp({confidence:2,teammateTrust:2});}if(choiceId==='ask')cp({focusBoost:2,teammateTrust:2});if(choiceId==='refuse')cp({ambition:1,teammateTrust:-1});}
  if(e.type==='family_request'){if(choiceId==='visit')cp({energy:-4,familyTrust:8,stress:-6,morale:4});if(choiceId==='call')cp({familyTrust:3,stress:-2});if(choiceId==='ignore')cp({familyTrust:-7,stress:4});}
  if(e.type==='press_interview'){if(choiceId==='team')cp({teammateTrust:5,fansTrust:3,pressTrust:2});if(choiceId==='honest')cp({pressTrust:5,professionalism:2,stress:-1});if(choiceId==='star')cp({fansTrust:4,reputation:1,teammateTrust:-6,coachTrust:-2});media(player,l,'press','Futbolçunun müsahibəsi',`Uydurma “Oyun Səsi” müsahibədəki ${choiceId==='team'?'komanda vurğusunu':choiceId==='honest'?'dürüst qiymətləndirməni':'fərdi iddianı'} müzakirə edir.`);}
  if(e.type==='social_pressure'){if(choiceId==='break')cp({stress:-8,focusBoost:2});if(choiceId==='support')cp({familyTrust:3,confidence:4,stress:-4});if(choiceId==='argue')cp({energy:-6,stress:8,pressTrust:-3,fansTrust:1});}
  if(e.type==='sponsor_offer'){if(choiceId==='accept'){if(number(player.energy,85)<8)return {ok:false,message:'Çəkiliş üçün ən azı 8 enerji lazımdır.',effects:[]};player.balance=number(player.balance,0,0,1e9)+250;cp({energy:-8,fansTrust:3,stress:3,reputation:1});effects.push('Şəffaf sponsor çəkilişi: +€250');l.sponsorDeals=integer(l.sponsorDeals)+1;}if(choiceId==='defer')cp({professionalism:2,coachTrust:2});if(choiceId==='reject')cp({focusBoost:2,stress:-1});}
  if(e.type==='recovery_warning'){if(choiceId==='rest')cp({energy:20,stress:-5,focusBoost:1});if(choiceId==='talk')cp({coachTrust:3,stress:-2});if(choiceId==='push')cp({energy:-15,stress:7,confidence:-2});}
  if(e.type==='red_card'){if(choiceId==='review')cp({professionalism:4,focusBoost:2,stress:-2});if(choiceId==='apologize')cp({teammateTrust:5,confidence:1,coachTrust:1});if(choiceId==='blame')cp({pressTrust:-4,coachTrust:-3,professionalism:-3,stress:4});}
  if(e.type==='financial_stress'){if(choiceId==='plan')cp({stress:-3,professionalism:1});if(choiceId==='ask')cp({familyTrust:2,confidence:1});if(choiceId==='ignore')cp({stress:5});}
  l.focusUntilDay=dayOf(player)+3;e.status='resolved';e.choiceId=choiceId;e.resolvedDay=dayOf(player);e.outcome=e.choices.find(c=>c.id===choiceId).label;e.effects=effects;note(player,l,e.type,e.outcome,effects);
  return {ok:true,message:`Qərarın yadda qaldı: ${e.outcome}.`,effects,consumesDay:0,context:{kind:'decision',eventId:e.id}};
}

/** Accepted activities ask the root session to advance one day; purchases do not. */
export function playerLifeAction(player,journey,action,payload={}){
  const l=ensurePlayerLife(player,journey),effects=[];if(journey.pendingFixtureId)return {ok:false,message:'Davam edən matçı əvvəlcə tamamla.',effects};
  if(action==='purchase'){
    const item=PLAYER_LIFESTYLE_ITEMS.find(item=>item.id===payload.itemId);if(!item)return {ok:false,message:'Bu məhsul tapılmadı.',effects};if(l.possessions.includes(item.id))return {ok:false,message:'Bu əşya artıq sənindir.',effects};if(!spend(player,item.cost))return {ok:false,message:`Alış üçün €${item.cost} lazımdır.`,effects};
    l.possessions.push(item.id);l.equipped[item.category]=item.id;note(player,l,'purchase',`${item.title}: €${item.cost}. Gündəlik saxlanma €${item.upkeep}.`);return {ok:true,message:`${item.title} alındı. Gündəlik saxlanma €${item.upkeep}.`,effects:[`Şəxsi büdcə −€${item.cost}`],consumesDay:0,context:{kind:'purchase'}};
  }
  if(action==='equip'){const item=PLAYER_LIFESTYLE_ITEMS.find(item=>item.id===payload.itemId);if(!item||!l.possessions.includes(item.id))return {ok:false,message:'Əvvəlcə bu əşyaya sahib olmalısan.',effects};if(l.equipped[item.category]===item.id)return {ok:false,message:'Bu seçim artıq aktivdir.',effects};l.equipped[item.category]=item.id;return {ok:true,message:`${item.title} aktiv seçimdir.`,effects,consumesDay:0};}
  if(action==='settle_upkeep'){if(l.upkeepDebt<=0)return {ok:false,message:'Saxlanma borcun yoxdur.',effects};const amount=Math.min(number(player.balance,0,0,1e9),l.upkeepDebt);if(amount<=0)return {ok:false,message:'Ödəniş üçün vəsait yoxdur.',effects};player.balance-=amount;l.upkeepDebt-=amount;change(player,l,{stress:-Math.min(3,amount/100)},effects);note(player,l,'payment',`Saxlanma borcu: €${amount} ödənildi.`,effects);return {ok:true,message:`€${amount} ödənildi. Qalan borc €${l.upkeepDebt}.`,effects,consumesDay:0};}
  if(action==='appearance'){
    const field=payload.field,value=field==='skin'||field==='jerseyNumber'?Number(payload.value):payload.value;
    if(field!=='jerseyNumber'&&!Object.hasOwn(PLAYER_APPEARANCE_OPTIONS,field))return {ok:false,message:'Görünüş seçimi uyğun deyil.',effects};
    if(field==='jerseyNumber'?!(Number.isInteger(value)&&value>=2&&value<=99):!PLAYER_APPEARANCE_OPTIONS[field].includes(value))return {ok:false,message:'Görünüş seçimi uyğun deyil.',effects};
    if(l.appearance[field]===value)return {ok:false,message:'Bu görünüş artıq aktivdir.',effects};const cost=field==='hair'?40:field==='beard'?20:field==='boots'&&!l.unlockedBoots.includes(value)?value==='gold'?350:120:0;if(!spend(player,cost))return {ok:false,message:`Bu görünüş üçün €${cost} lazımdır.`,effects};l.appearance[field]=value;if(field==='boots'&&!l.unlockedBoots.includes(value))l.unlockedBoots.push(value);note(player,l,'appearance',`Görünüş yeniləndi: ${field}; xərc €${cost}.`);return {ok:true,message:'Görünüş saxlanıldı və növbəti matça tətbiq ediləcək.',effects:cost?[`Şəxsi büdcə −€${cost}`]:[],consumesDay:0,context:{kind:'appearance'}};
  }
  const activity=PLAYER_LIFE_ACTIVITIES.find(item=>item.id===action);if(!activity)return {ok:false,message:'Şəxsi həyat qərarı tapılmadı.',effects};
  if(l.activityDays[action]===dayOf(player))return {ok:false,message:'Bu fəaliyyəti bu gün artıq etmisən.',effects};
  if(number(player.energy,85)<activity.energy)return {ok:false,message:'Bu fəaliyyət üçün enerji azdır. Əvvəl bərpa ol.',effects};if(number(player.balance,0,0,1e9)<activity.cost)return {ok:false,message:`Bu fəaliyyət €${activity.cost} tələb edir.`,effects};
  if(action==='mentor_session'){
    if(!l.mentor||l.mentor.status!=='active'||payload.mentorId&&payload.mentorId!==l.mentor.playerId){const result=assignMentor(player,journey,payload.mentorId);if(!result.ok)return result;effects.push(result.message);}
    if(l.mentor.lastSessionDay&&dayOf(player)-l.mentor.lastSessionDay<3)return {ok:false,message:'Mentor məşqləri arasında üç gün vaxt ver.',effects:[]};
  }
  spend(player,activity.cost);change(player,l,{energy:-activity.energy},effects);l.activityDays[action]=dayOf(player);
  if(action==='family_time')change(player,l,{familyTrust:7,stress:-6,morale:3},effects);
  if(action==='team_bonding')change(player,l,{teammateTrust:6,stress:-2,morale:2},effects);
  if(action==='media_training')change(player,l,{pressTrust:4,professionalism:2,stress:-2},effects);
  if(action==='mindfulness')change(player,l,{stress:-8,focusBoost:3,confidence:1},effects);
  if(action==='study')change(player,l,{coachTrust:3,professionalism:2,focusBoost:3},effects);
  if(action==='gym')change(player,l,{fitness:3,professionalism:1,stress:1},effects);
  if(action==='mentor_session'){l.mentor.lastSessionDay=dayOf(player);change(player,l,l.mentor.compatibility>=55?{confidence:3,coachTrust:1,stress:-2}:{confidence:-1,stress:3},effects);}
  l.focusUntilDay=dayOf(player)+3;note(player,l,action,activity.title,effects);
  return {ok:true,message:`${activity.title} tamamlandı.`,effects,consumesDay:1,context:{kind:'activity',action}};
}
export function playerLifeEffect(player,journey){
  const l=ensurePlayerLife(player,journey),boost=dayOf(player)<=l.focusUntilDay?l.focusBoost:0,age=number(journey.age,18,16,45),experience=number(journey.experience,(age-16)*4,0,100),morale=number(player.morale,70);
  return {morale,confidence:l.confidence,trust:l.coachTrust,experience,stress:l.stress,
    focus:round(clamp(60+(l.confidence-60)*.22+(l.professionalism-60)*.16-l.stress*.18+boost,25,95)),
    discipline:round(clamp(l.professionalism*.75+(100-l.stress)*.25,20,95)),
    cooperation:round(clamp(40+l.teammateTrust*.4+l.coachTrust*.2-l.stress*.08,25,95)),
    composure:round(clamp(45+experience*.3+l.confidence*.2-l.stress*.25,20,95)),
    moraleModifier:round(clamp((morale-60)*.12+(l.confidence-60)*.08-l.stress*.04+boost*.2,-12,10))};
}
