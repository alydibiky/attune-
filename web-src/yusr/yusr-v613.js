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
  writeDone:"Logged {n}",undo:"Undo",undone:"Removed",writeNone:"No amount found. Write it like: lunch 150, taxi 60, got salary 30000.",writeNoAcct:"Add an account first.",writeOffline:"Open Yusr from Attune's Money tab to log by writing."});
Object.assign(I18N.ar,{billsTab:"الفواتير الثابتة",billsSub:"مصاريف ودخل بيتكرروا",upcoming:"الـ ٣٠ يوم الجايين",daily:"يومي",recRangeOn:"في أيام معيّنة بس من كل شهر",fromDay:"من يوم",toDay:"لحد يوم",
  recRangeHelp:"مثال: يومي من يوم ١ لحد يوم ١٠ يتسجّل كل يوم في الجزء ده من الشهر بس.",daysRange:"أيام {a}–{b}",noBills:"مفيش فواتير متكررة لسه. دوس ＋ وضيف الإيجار أو النت أو مصروف يومي…",
  billsOut:"هيخرج في ٣٠ يوم",billsIn:"هيدخل",writePh:"اكتب صرفت إيه أو جالك إيه… مثلاً: غدا ١٥٠، تاكسي ٦٠، وقبضت المرتب ٣٠٠٠٠",writeGo:"سجّل",writing:"بقرا…",
  writeDone:"اتسجّل {n}",undo:"تراجع",undone:"اتشال",writeNone:"مش لاقي مبلغ. اكتبها كده: غدا ١٥٠، تاكسي ٦٠، قبضت المرتب ٣٠٠٠٠",writeNoAcct:"ضيف حساب الأول.",writeOffline:"افتح يُسر من تبويب الفلوس في Attune عشان تسجّل بالكتابة."});
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

/* ---- Write it: Attune reads the words (code first, its model when loaded), Yusr logs ---- */
var WRITE_LAST=null;
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
function writeLog(){
  var box=document.getElementById('write-text'),btn=document.getElementById('write-go'),res=document.getElementById('write-result');
  var text=(box.value||'').trim();if(!text)return;
  if(!writeAccount()){res.innerHTML='<div class="wr-warn">'+t('writeNoAcct')+'</div>';return;}
  if(!aiAvailable()){res.innerHTML='<div class="wr-warn">'+t('writeOffline')+'</div>';return;}
  btn.disabled=true;btn.textContent=t('writing');
  writeAsk(text,function(r){
    btn.disabled=false;btn.textContent=t('writeGo');
    if(!r||!r.ok||!r.items||!r.items.length){res.innerHTML='<div class="wr-warn">'+esc((r&&r.why)||t('writeNone'))+'</div>';return;}
    var ids=[],rows='',today=toISODate(new Date());
    r.items.forEach(function(x){
      var a=writeAccount(x.account);if(!a||!(+x.amount>0))return;var cat=CATMAP[x.cat]?x.cat:'other';
      var tx={id:uid(),created:Date.now(),type:x.type==='income'?'income':'expense',amount:+x.amount,cat:cat,account:a.id,
        date:/^\d{4}-\d{2}-\d{2}$/.test(x.date||'')?x.date:today,note:String(x.note||'').slice(0,80),project:null,ai:true};
      db.txns.push(tx);ids.push(tx.id);
      try{parent.postMessage({ns:'yusr-bridge',v:1,type:'txn-added',data:{id:tx.id,type:tx.type,amount:tx.amount,currency:a.currency||db.currency,account:a.id,party:'',note:tx.note,ts:Date.parse(tx.date)||Date.now(),ref:''}},'*');}catch(e){}
      var c=CATMAP[cat]||CATMAP.other;
      rows+='<div class="wr-row"><span class="e">'+c.e+'</span><span class="n">'+esc(tx.note||catName(cat))+' <span class="d">· '+catName(cat)+' · '+esc(a.name)+(tx.date!==today?' · '+tx.date:'')+'</span></span><span class="num '+(tx.type==='income'?'up':'down')+'">'+(tx.type==='income'?'+':'-')+fmt(tx.amount,a.currency)+'</span></div>';});
    if(!ids.length){res.innerHTML='<div class="wr-warn">'+t('writeNone')+'</div>';return;}
    save();WRITE_LAST=ids;box.value='';
    refresh();
    document.getElementById('write-result').innerHTML='<div class="wr-done" data-testid="write-done"><div style="font-weight:700;font-size:13px;margin-bottom:2px">✓ '+tf('writeDone',{n:ids.length})+'</div>'+rows
      +((r.warnings||[]).map(function(w){return '<div class="wr-warn">'+esc(w)+'</div>';}).join(''))
      +'<div class="wr-acts"><button onclick="writeUndo()" data-testid="write-undo">'+t('undo')+'</button></div></div>';
  });
}
function writeUndo(){if(!WRITE_LAST)return;var k=new Set(WRITE_LAST);db.txns=db.txns.filter(function(x){return !k.has(x.id);});WRITE_LAST=null;save();
  document.getElementById('write-result').innerHTML='';toast(t('undone'));refresh();}
try{applyI18n();}catch(e){}
