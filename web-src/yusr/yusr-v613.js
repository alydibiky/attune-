/* ==========================================================================
   v6.13 (Attune) — Ali: "I want Yusr to be AI powered: I write to it and it
   understands and logs everything", "recurring in a better place", "daily, or
   from day … to day … of each month". Invoices and demo data are gone (Attune's
   Business books have full invoices with the Egyptian e-invoice export).
   build.sh pastes this file into index.new.html's <script id="yusr-v613">
   placeholder, so the Yusr that ships is still one file.
   ========================================================================== */
Object.assign(I18N.en,{billsTab:"Bills",billsSub:"Recurring bills & income",upcoming:"Next 30 days",daily:"Daily",recRangeOn:"Only on some days of each month",fromDay:"From day",toDay:"To day",
  recRangeHelp:"Example: daily from day 1 to day 10 logs it every day in that part of the month only.",daysRange:"days {a}–{b}",noBills:"No recurring bills yet. Tap ＋ to add rent, internet, a daily allowance…",
  billsOut:"Going out in 30 days",billsIn:"Coming in",writePh:"Write what you spent or got… e.g. lunch 150, taxi 60, got salary 30000",writeGo:"Log it",writing:"Reading…",
  writeDone:"Logged {n}",undo:"Undo",undone:"Removed",writeNone:"No amount found. Write it like: lunch 150, taxi 60, got salary 30000.",writeNoAcct:"Add an account first.",writeOffline:"Open Yusr from Attune's Money tab to log by writing.",
  moneyTitle:"Money",recent:"Recent",talkTitle:"Write or ask",sugg1:"lunch 150, taxi 60",sugg2:"How much did I spend on food this week?",sugg3:"What did I earn this month?",tapToEdit:"tap a line to edit",
  outShort:"spent",otherCats:"Other",zakatSetup:"Set up in Zakat",zakatBelow:"Below niṣāb",zakatBelowS:"nothing due now",vsBefore:"vs before",topCat:"Most on",next7:"7 days",nDue:"{n} due",nothingDue:"Nothing due",
  homeCards:"Home shows",cardRing:"Spending ring",cardGrid:"The 4 cards",cardTalk:"Write or ask",clearTalk:"Clear",writePh:"Write or ask… lunch 150, taxi 60"});
Object.assign(I18N.ar,{billsTab:"الفواتير الثابتة",billsSub:"مصاريف ودخل بيتكرروا",upcoming:"الـ ٣٠ يوم الجايين",daily:"يومي",recRangeOn:"في أيام معيّنة بس من كل شهر",fromDay:"من يوم",toDay:"لحد يوم",
  recRangeHelp:"مثال: يومي من يوم ١ لحد يوم ١٠ يتسجّل كل يوم في الجزء ده من الشهر بس.",daysRange:"أيام {a}–{b}",noBills:"مفيش فواتير متكررة لسه. دوس ＋ وضيف الإيجار أو النت أو مصروف يومي…",
  billsOut:"هيخرج في ٣٠ يوم",billsIn:"هيدخل",writePh:"اكتب صرفت إيه أو جالك إيه… مثلاً: غدا ١٥٠، تاكسي ٦٠، وقبضت المرتب ٣٠٠٠٠",writeGo:"سجّل",writing:"بقرا…",
  writeDone:"اتسجّل {n}",undo:"تراجع",undone:"اتشال",writeNone:"مش لاقي مبلغ. اكتبها كده: غدا ١٥٠، تاكسي ٦٠، قبضت المرتب ٣٠٠٠٠",writeNoAcct:"ضيف حساب الأول.",writeOffline:"افتح يُسر من تبويب الفلوس في Attune عشان تسجّل بالكتابة.",
  moneyTitle:"الفلوس",recent:"آخر العمليات",talkTitle:"اكتب أو اسأل",sugg1:"غدا ١٥٠، تاكسي ٦٠",sugg2:"صرفت كام على الأكل الأسبوع ده؟",sugg3:"دخلي كام الشهر ده؟",tapToEdit:"دوس على سطر تعدّله",
  outShort:"مصروف",otherCats:"أخرى",zakatSetup:"اضبطها من الزكاة",zakatBelow:"أقل من النصاب",zakatBelowS:"مفيش مستحق دلوقتي",vsBefore:"عن اللي قبله",topCat:"الأكتر",next7:"٧ أيام",nDue:"{n} مستحقة",nothingDue:"مفيش مستحق",
  homeCards:"الرئيسية تعرض",cardRing:"دايرة المصاريف",cardGrid:"الـ ٤ كروت",cardTalk:"اكتب أو اسأل",clearTalk:"امسح",writePh:"اكتب أو اسأل… غدا ١٥٠، تاكسي ٦٠"});
function tf(k,v){var x=t(k);Object.keys(v||{}).forEach(function(n){x=x.replace('{'+n+'}',v[n]);});return x;}

/* ---- daily bills on some days of the month ---- */
// 25 → 5 wraps over the month's end
function inDayRange(day,a,b){a=+a;b=+b;if(!a||!b)return true;return a<=b?(day>=a&&day<=b):(day>=a||day<=b);}
function recRangeValue(){var f=document.getElementById('rec-freq').value,on=document.getElementById('rec-range-on').checked;
  if(f!=='daily'||!on)return {fromDay:null,toDay:null};
  return {fromDay:+document.getElementById('rec-from').value||1,toDay:+document.getElementById('rec-to').value||31};}
function recFillDays(){['rec-from','rec-to'].forEach(function(id){var el=document.getElementById(id);if(el&&!el.options.length){var h='';for(var i=1;i<=31;i++)h+='<option value="'+i+'">'+i+'</option>';el.innerHTML=h;}});}
function recRangeSet(r){recFillDays();var on=!!(r&&r.fromDay&&r.toDay);document.getElementById('rec-range-on').checked=on;
  document.getElementById('rec-from').value=on?r.fromDay:1;document.getElementById('rec-to').value=on?r.toDay:10;recFreqChanged();}
function recFreqChanged(){var f=document.getElementById('rec-freq').value;document.getElementById('rec-range-field').style.display=f==='daily'?'block':'none';
  document.getElementById('rec-range-days').style.display=(f==='daily'&&document.getElementById('rec-range-on').checked)?'flex':'none';}
function recFreqLabel(r){return t(r.freq)+(r.freq==='daily'&&r.fromDay&&r.toDay?' · '+tf('daysRange',{a:r.fromDay,b:r.toDay}):'');}

/* ---- the Bills tab: what is coming in the next 30 days, then every recurring item ---- */
function billsAhead(days){var out=[],end=startOfDay(new Date());end.setDate(end.getDate()+days);
  (db.recurring||[]).forEach(function(r){if(!r.active)return;var d=startOfDay(new Date(r.nextDate)),g=0;
    if(r.freq==='daily'&&r.fromDay&&r.toDay){var k=0;while(!inDayRange(d.getDate(),r.fromDay,r.toDay)&&k<40){d.setDate(d.getDate()+1);k++;}}
    while(d<=end&&g<400){out.push({r:r,date:toISODate(d)});d=advance(d,r.freq,r);g++;}});
  return out.sort(function(a,b){return a.date<b.date?-1:a.date>b.date?1:0;});}
function recRow(r,right){var a=acctById(r.account),c=CATMAP[r.cat]||CATMAP.other;
  return '<div class="list-row" onclick="openRecurring(\''+r.id+'\')"><div style="font-size:20px">'+c.e+'</div><div class="info"><div class="t1">'+esc((r.note||'').replace(' ↻','')||catName(r.cat))+'</div><div class="t2">'+recFreqLabel(r)+(right?'':' · '+r.nextDate)+' · '+(a?esc(a.name):'—')+'</div></div><div class="num '+(r.type==='income'?'up':'down')+'">'+(r.type==='income'?'+':'-')+fmt(r.amount,a?a.currency:db.currency)+'</div></div>';}
function renderBills(){
  var list=billsAhead(30),out=0,inn=0;
  list.forEach(function(x){var a=acctById(x.r.account),v=x.r.amount*((a&&db.rates[a.currency])||1);if(x.r.type==='income')inn+=v;else out+=v;});
  document.getElementById('bills-sum').innerHTML='<div class="row" style="margin-top:0"><div><div class="k">'+t('billsOut')+'</div><div class="v down num">'+fmt(out,db.currency)+'</div></div><div><div class="k">'+t('billsIn')+'</div><div class="v up num">'+fmt(inn,db.currency)+'</div></div></div>';
  var last='',h='';
  list.slice(0,60).forEach(function(x){if(x.date!==last){h+='<div class="bill-day">'+x.date+'</div>';last=x.date;}h+=recRow(x.r,true);});
  document.getElementById('bills-upcoming').innerHTML=h||'<p class="mini-help">'+t('noBills')+'</p>';
  document.getElementById('recurring-list').innerHTML=(db.recurring||[]).map(function(r){return recRow(r,false);}).join('');
}

/* ---- Write or ask: Attune reads the words (code first, its model when loaded); Yusr logs, or shows the answer ----
   The conversation is kept in db.talk (last 30 bubbles) so it survives closing the app. */
function writeAccounts(){return db.accounts.filter(function(a){return !isMetal(a)&&!isLivestock(a);});}
function writeAccount(name){
  var list=writeAccounts();
  if(name){var n=String(name).toLowerCase();var m=list.find(function(a){return String(a.name).toLowerCase()===n;});if(m)return m;}
  if(state.acct&&state.acct!=='all'){var s=list.find(function(a){return a.id===state.acct;});if(s)return s;}
  return list[0]||null;}
function writeHints(){return {today:toISODate(new Date()),cats:allCats().map(function(c){return {id:c.id,name:c.en||c.ar||c.id};}),
  accounts:writeAccounts().map(function(a){return a.name;})};}
function writeAsk(text,cb){
  var id='y'+(++AI_BRIDGE.seq)+'_'+Date.now();AI_BRIDGE.waiting[id]={cb:cb,at:Date.now()};
  try{parent.postMessage({ns:'yusr-bridge',v:1,type:'ai-request',data:{kind:'log-text',text:String(text||'').slice(0,4000),id:id,currency:db.currency,hints:writeHints()}},'*');}
  catch(e){delete AI_BRIDGE.waiting[id];cb({ok:false,why:String(e.message||e)});return;}
  setTimeout(function(){var w=AI_BRIDGE.waiting[id];if(!w)return;delete AI_BRIDGE.waiting[id];w.cb({ok:false,why:db.lang==='ar'?'لم يرد النموذج في الوقت المتاح.':'The model did not answer in time.'});},90000);}
function talkPush(b){db.talk=(db.talk||[]).concat([b]).slice(-30);}
function askGrow(el){el.style.height='auto';el.style.height=Math.min(110,el.scrollHeight)+'px';}
function writeStatus(html){var r=document.getElementById('write-result');if(r)r.innerHTML=html||'';}
function writeLog(){
  var box=document.getElementById('write-text'),btn=document.getElementById('write-go');
  var text=(box.value||'').trim();if(!text)return;
  if(!writeAccount()){writeStatus('<div class="wr-warn">'+t('writeNoAcct')+'</div>');return;}
  if(!aiAvailable()){writeStatus('<div class="wr-warn">'+t('writeOffline')+'</div>');return;}
  btn.disabled=true;writeStatus('<div class="mini-help" style="margin:0 4px">'+t('writing')+'</div>');
  talkPush({me:1,text:text,at:Date.now()});box.value='';askGrow(box);save();renderTalk(true);
  writeAsk(text,function(r){
    btn.disabled=false;writeStatus('');
    if(r&&r.ok&&r.answer){talkPush({text:String(r.answer).slice(0,1200),at:Date.now()});save();renderTalk(true);return;}
    if(!r||!r.ok||!r.items||!r.items.length){talkPush({text:(r&&r.why)||t('writeNone'),warn:1,at:Date.now()});save();renderTalk(true);return;}
    var ids=[],lines=[],today=toISODate(new Date());
    r.items.forEach(function(x){
      var a=writeAccount(x.account);if(!a||!(+x.amount>0))return;var cat=CATMAP[x.cat]?x.cat:'other';
      var tx={id:uid(),created:Date.now(),type:x.type==='income'?'income':'expense',amount:+x.amount,cat:cat,account:a.id,
        date:/^\d{4}-\d{2}-\d{2}$/.test(x.date||'')?x.date:today,note:String(x.note||'').slice(0,80),project:null,ai:true};
      db.txns.push(tx);ids.push(tx.id);lines.push(tx.id);
      try{parent.postMessage({ns:'yusr-bridge',v:1,type:'txn-added',data:{id:tx.id,type:tx.type,amount:tx.amount,currency:a.currency||db.currency,account:a.id,party:'',note:tx.note,ts:Date.parse(tx.date)||Date.now(),ref:''}},'*');}catch(e){}});
    if(!ids.length){talkPush({text:t('writeNone'),warn:1,at:Date.now()});save();renderTalk(true);return;}
    talkPush({logged:ids,warnings:(r.warnings||[]).slice(0,4),at:Date.now()});
    save();refresh();renderTalk(true);
  });
}
// a logged bubble shows the transactions as they are NOW (edited or deleted ones update themselves)
function loggedHtml(b,i){
  var rows='',n=0,today=toISODate(new Date());
  (b.logged||[]).forEach(function(id){var tx=db.txns.find(function(x){return x.id===id;});if(!tx)return;n++;var a=acctById(tx.account)||{},c=CATMAP[tx.cat]||CATMAP.other;
    rows+='<div class="l" onclick="openTx(\''+tx.id+'\')"><span>'+c.e+' '+esc(tx.note||catName(tx.cat))+' <span class="d" style="color:var(--muted);font-size:11.5px">· '+esc(a.name||'')+(tx.date!==today?' · '+tx.date:'')+'</span></span><b class="num '+(tx.type==='income'?'up':'down')+'">'+(tx.type==='income'?'+':'-')+fmt(tx.amount,a.currency||db.currency)+'</b></div>';});
  if(!n)return '<div class="bub bot" style="opacity:.6">'+t('undone')+'</div>';
  return '<div class="bub bot" data-testid="write-done">'+rows+((b.warnings||[]).map(function(w){return '<div class="wr-warn">'+esc(w)+'</div>';}).join(''))
    +'<div class="acts">✓ '+tf('writeDone',{n:n})+' · <button onclick="writeUndo('+i+')" data-testid="write-undo">'+t('undo')+'</button> · <span>'+t('tapToEdit')+'</span></div></div>';}
function mdLite(s){return esc(s).replace(/\*\*([^*]+)\*\*/g,'<b>$1</b>').replace(/_([^_]+)_/g,'<i>$1</i>');}
function renderTalk(scroll){
  var el=document.getElementById('home-talk');if(!el)return;
  if((db.ui.cards||{}).talk===0){el.innerHTML='';return;}
  var list=(db.talk||[]).slice(-8),h='';
  if(!list.length){
    h='<div class="talk-head"><h2>'+t('talkTitle')+'</h2></div><div class="sugg">'
      +[t('sugg1'),t('sugg2'),t('sugg3')].map(function(x){return '<button onclick="askFill(this.textContent)">'+esc(x)+'</button>';}).join('')+'</div>';
  }else{
    var off=(db.talk||[]).length-list.length;
    h='<div class="talk-head"><h2>'+t('talkTitle')+'</h2><button class="link" onclick="talkClear()">'+t('clearTalk')+'</button></div>';
    list.forEach(function(b,k){var i=off+k;
      if(b.me)h+='<div class="bub me">'+esc(b.text)+'</div>';
      else if(b.logged)h+=loggedHtml(b,i);
      else h+='<div class="bub bot"'+(b.warn?' style="color:#f0b35a"':'')+' data-testid="talk-answer">'+mdLite(b.text)+'</div>';});
  }
  el.innerHTML=h;
  if(scroll){var last=el.lastElementChild;if(last&&last.scrollIntoView)try{last.scrollIntoView({block:'nearest'});}catch(e){}}
}
function askFill(x){var b=document.getElementById('write-text');b.value=x.replace(/^[«"]|[»"]$/g,'');b.focus();askGrow(b);}
function talkClear(){db.talk=[];save();renderTalk();}
function writeUndo(i){var b=(db.talk||[])[i];if(!b||!b.logged)return;var k=new Set(b.logged);db.txns=db.txns.filter(function(x){return !k.has(x.id);});
  save();toast(t('undone'));refresh();}

/* ---- Home cards (B): the ring of where the money went, and four tappable cards ---- */
var RING_COLORS=['#F06A6A','#E7B24C','#5B9BD5','#4FBF8B','#B57BE0','#8B95A7'];
function homeCards(){
  var cards=db.ui.cards||{},cur=viewCur(),list=txnsFor(state.acct,state.period);
  // ring: this period's spending by category
  var ring=document.getElementById('home-ring');
  if(ring){
    var by={},tot=0;list.forEach(function(x){if(x.type==='expense'){var v=inView(x);by[x.cat]=(by[x.cat]||0)+v;tot+=v;}});
    var parts=Object.keys(by).sort(function(a,b){return by[b]-by[a];}),acc=0,g=[];
    if(parts.length>5){var rest=parts.slice(5).reduce(function(s,k){return s+by[k];},0);parts=parts.slice(0,5);by.__rest=rest;parts.push('__rest');}
    parts.forEach(function(k,i){var f=by[k]/tot*100;g.push(RING_COLORS[i]+' '+acc+'% '+(acc+f)+'%');acc+=f;});
    ring.style.display=cards.ring===0?'none':'block';
    ring.style.background=tot>0?'conic-gradient('+g.join(',')+')':'conic-gradient(var(--line) 0 100%)';
    ring.innerHTML='<i><span>'+(tot>0?fmtShort(tot):'—')+'<small>'+t('outShort')+'</small></span></i>';
    ring.title=parts.map(function(k){return (k==='__rest'?t('otherCats'):catName(k))+' '+Math.round(by[k]/tot*100)+'%';}).join(' · ');
  }
  var grid=document.getElementById('home-grid');if(!grid)return;
  var brow=document.querySelector('#balance-card .row');if(brow)brow.style.display=cards.grid===0?'':'none';   // the cards show in/out
  if(cards.grid===0){grid.innerHTML='';return;}
  var inS=0,outS=0;list.forEach(function(x){if(x.type==='income')inS+=inView(x);else if(x.type==='expense')outS+=inView(x);});
  // spent vs the same span before
  var prevOut=0;try{var ps=periodStart(state.period),span=Date.now()-ps.getTime(),p0=new Date(ps.getTime()-span);
    db.txns.forEach(function(x){var d=new Date(x.date);if(x.type==='expense'&&d>=p0&&d<ps&&(state.acct==='all'||x.account===state.acct))prevOut+=inView(x);});}catch(e){}
  var vs=prevOut>0&&state.period!=='all'?Math.round((outS-prevOut)/prevOut*100):null;
  var week=billsAhead(7),billsN=week.length,firstBill=week[0];
  var z=null;try{z=zakatStatus();}catch(e){}
  var zv=!z||z.noPrice?['—',t('zakatSetup')]:z.isDue?[fmt(z.amount,db.currency),t('zakatDueNow')]:z.belowNisab?[t('zakatBelow'),t('zakatBelowS')]:[t('onTrack'),z.daysLeft!=null?tf('inDays',{n:z.daysLeft}):''];
  var top=null;try{var by2={};list.forEach(function(x){if(x.type==='expense')by2[x.cat]=(by2[x.cat]||0)+inView(x);});var k=Object.keys(by2).sort(function(a,b){return by2[b]-by2[a];})[0];if(k)top=catName(k)+' '+Math.round(by2[k]/(outS||1)*100)+'%';}catch(e){}
  var card=function(k,v,s,cls,on,tid){return '<div class="hcard" onclick="'+on+'" data-testid="'+tid+'"><div class="k">'+k+'</div><div class="v '+(cls||'')+' num">'+v+'</div><div class="s">'+(s||'&nbsp;')+'</div></div>';};
  grid.innerHTML=
    card(t('spent')+' · '+t(state.period),fmt(outS,cur),vs==null?(top||''):(vs<=0?'↓ ':'↑ ')+Math.abs(vs)+'% '+t('vsBefore'),'down',"go('trends')",'card-spent')
   +card(t('earned')+' · '+t(state.period),fmt(inS,cur),top&&vs!=null?t('topCat')+': '+top:'','up',"go('trends')",'card-earned')
   +card(t('billsTab')+' · '+t('next7'),billsN?tf('nDue',{n:billsN}):t('nothingDue'),firstBill?esc((firstBill.r.note||'').replace(' ↻','')||catName(firstBill.r.cat))+' · '+firstBill.date.slice(5):'','',"go('bills')",'card-bills')
   +card(t('zakat'),zv[0],zv[1],'gold',"go('zakat')",'card-zakat');
}
function fmtShort(v){var a=Math.abs(v);return a>=1e6?(v/1e6).toFixed(1).replace(/\.0$/,'')+'M':a>=1e4?Math.round(v/1e3)+'k':a>=1e3?(v/1e3).toFixed(1).replace(/\.0$/,'')+'k':String(Math.round(v));}
(function(){var _rh=renderHome;renderHome=function(){var r=_rh.apply(this,arguments);try{homeCards();}catch(e){}try{renderTalk();}catch(e){}return r;};})();
// the bar shows on Home only (and the old + button hides there: the bar has its own +)
(function(){var _go=go;go=function(scr,isBack){var r=_go.apply(this,arguments);try{document.body.classList.toggle('on-home',scr==='home');}catch(e){}return r;};})();

/* ---- 5 tabs (Home · Trends · Bills · Zakat · More); Accounts, Goals & debts and Notes open from More ---- */
(function(){
  if(!db.ui.v613){db.ui.v613=1;db.ui.tabs=Object.assign({},db.ui.tabs||{},{accounts:0,goals:0,notes:0,bills:1,trends:1,zakat:1});
    db.ui.tabOrder=['trends','bills','zakat','accounts','goals','notes'];db.ui.cards=db.ui.cards||{};save();}
  if(!db.ui.cards)db.ui.cards={};
  try{applyUI();}catch(e){}
  var set=document.getElementById('scr-settings');
  if(set&&!document.getElementById('more-tiles')){
    var d=document.createElement('div');d.id='more-tiles';d.className='hgrid';d.style.margin='4px 0 10px';
    var hd=set.querySelector('header');hd.parentNode.insertBefore(d,hd.nextSibling);
  }
  var rs=renderSettings;renderSettings=function(){var r=rs.apply(this,arguments);try{moreTiles();}catch(e){}return r;};
})();
function moreTiles(){
  var el=document.getElementById('more-tiles');if(!el)return;var c=db.ui.cards||{};
  var tile=function(scr,e,k,s){return '<div class="hcard" onclick="go(\''+scr+'\')"><div class="v" style="font-size:20px">'+e+'</div><div class="k" style="margin-top:4px">'+t(k)+'</div><div class="s">'+s+'</div></div>';};
  var nAcc=db.accounts.length,nGoals=(db.goals||[]).length+(db.debts||[]).filter(function(x){return !x.settled;}).length,nNotes=(db.notes||[]).length;
  el.innerHTML=tile('accounts','🏦','accounts',nAcc)+tile('goals','🎯','goals',nGoals)+tile('notes','📝','notes',nNotes)
    +'<div class="hcard" style="cursor:default"><div class="k">'+t('homeCards')+'</div>'
    +[['ring','cardRing'],['grid','cardGrid'],['talk','cardTalk']].map(function(x){return '<label class="chkrow" style="border:none;padding:3px 0;font-size:12.5px"><input type="checkbox" '+(c[x[0]]===0?'':'checked')+' onchange="toggleCard(\''+x[0]+'\')"><span>'+t(x[1])+'</span></label>';}).join('')+'</div>';
}
function toggleCard(k){db.ui.cards=db.ui.cards||{};db.ui.cards[k]=db.ui.cards[k]===0?1:0;save();moreTiles();}
try{document.body.classList.toggle('on-home',state.screen==='home');}catch(e){}
try{applyI18n();}catch(e){}
