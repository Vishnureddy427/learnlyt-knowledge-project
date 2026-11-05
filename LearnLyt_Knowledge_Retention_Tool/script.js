const $ = (id) => document.getElementById(id);
const STORAGE_KEY = "learnlyt_data_v1";
let data = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{"topics":[],"cards":[]}');
let currentCard = 0, answerVisible = false, quizQuestions = [], quizIndex = 0, quizScore = 0, selectedAnswer = null, quizFinished = false;

function save(){ localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); renderAll(); }
function escapeHTML(value=""){ return String(value).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }
function today(){ return new Date().toISOString().slice(0,10); }
function due(topic){ return !topic.lastReviewed || (Date.now()-new Date(topic.lastReviewed).getTime()) >= 24*60*60*1000; }
function showPage(name){
  document.querySelectorAll(".page").forEach(p=>p.classList.toggle("active",p.id===name));
  document.querySelectorAll(".nav-link").forEach(b=>b.classList.toggle("active",b.dataset.page===name));
  const labels={dashboard:"Dashboard",library:"My Learning",flashcards:"Flashcards",quiz:"Take a Quiz",revision:"Revision"};
  $("page-title").textContent=labels[name]||"Dashboard";
  if(name==="quiz") renderQuizStart();
  renderAll();
}
document.querySelectorAll(".nav-link").forEach(b=>b.addEventListener("click",()=>showPage(b.dataset.page)));
document.querySelectorAll("[data-go]").forEach(b=>b.addEventListener("click",()=>showPage(b.dataset.go)));
$("quick-add").onclick=$("add-topic").onclick=()=>openTopicDialog();
$("add-card").onclick=()=>openCardDialog();

function openTopicDialog(topic=null){
  $("topic-form").reset(); $("topic-id").value=topic?.id||"";
  $("topic-dialog-title").textContent=topic?"Edit topic":"Add a topic";
  $("topic-title").value=topic?.title||""; $("topic-category").value=topic?.category||"Computer Science"; $("topic-notes").value=topic?.notes||"";
  $("topic-dialog").showModal();
}
$("save-topic").addEventListener("click",e=>{
  e.preventDefault(); const title=$("topic-title").value.trim(); if(!title){$("topic-title").focus();return;}
  const id=$("topic-id").value;
  if(id){const t=data.topics.find(x=>x.id===id);Object.assign(t,{title,category:$("topic-category").value,notes:$("topic-notes").value});}
  else data.topics.unshift({id:crypto.randomUUID(),title,category:$("topic-category").value,notes:$("topic-notes").value,completed:false,createdAt:new Date().toISOString(),lastReviewed:null});
  $("topic-dialog").close();save();
});

function openCardDialog(){
  $("card-form").reset(); $("card-topic").innerHTML='<option value="">General</option>'+data.topics.map(t=>`<option value="${t.id}">${escapeHTML(t.title)}</option>`).join("");
  $("card-dialog").showModal();
}
$("save-card").addEventListener("click",e=>{
  e.preventDefault();const question=$("card-question").value.trim(),answer=$("card-answer").value.trim();
  if(!question||!answer){return;}
  data.cards.push({id:crypto.randomUUID(),question,answer,topicId:$("card-topic").value});$("card-dialog").close();currentCard=Math.max(0,data.cards.length-1);save();showPage("flashcards");
});

function renderDashboard(){
  const total=data.topics.length, completed=data.topics.filter(t=>t.completed).length, pct=total?Math.round(completed/total*100):0;
  $("stat-topics").textContent=total;$("stat-completed").textContent=completed;$("stat-cards").textContent=data.cards.length;$("stat-due").textContent=data.topics.filter(due).length;
  $("progress-bar").style.width=pct+"%";$("progress-percent").textContent=pct+"%";$("progress-text").textContent=`${completed} of ${total} topics completed`;
  $("recent-list").innerHTML=total?data.topics.slice(0,4).map(topicRow).join(""):'<div class="empty">No topics yet. Add your first learning topic to get started.</div>';
}
function topicRow(t){return `<div class="topic-row"><div><strong>${escapeHTML(t.title)}</strong><small>${escapeHTML(t.category)} · ${t.completed?"Completed":"In progress"}</small></div><span class="pill">${t.completed?"Learned":"Learning"}</span></div>`;}
function renderLibrary(){
  const q=$("search-topics").value.toLowerCase(),cat=$("filter-category").value;
  const topics=data.topics.filter(t=>(t.title+" "+t.notes).toLowerCase().includes(q)&&(!cat||t.category===cat));
  $("topic-list").innerHTML=topics.length?topics.map(t=>`<article class="topic-card"><span class="pill">${escapeHTML(t.category)}</span><h3>${escapeHTML(t.title)}</h3><p>${escapeHTML(t.notes||"No notes added yet.")}</p><div class="card-actions"><button class="small-btn" data-edit="${t.id}">Edit</button><button class="small-btn" data-complete="${t.id}">${t.completed?"Mark learning":"Mark learned"}</button><button class="small-btn" data-review="${t.id}">Review now</button><button class="small-btn danger" data-delete="${t.id}">Delete</button></div></article>`).join(""):'<div class="empty">No matching topics found. Add a new topic to your library.</div>';
  $("topic-list").querySelectorAll("[data-edit]").forEach(b=>b.onclick=()=>openTopicDialog(data.topics.find(t=>t.id===b.dataset.edit)));
  $("topic-list").querySelectorAll("[data-complete]").forEach(b=>b.onclick=()=>{const t=data.topics.find(t=>t.id===b.dataset.complete);t.completed=!t.completed;save();});
  $("topic-list").querySelectorAll("[data-review]").forEach(b=>b.onclick=()=>{const t=data.topics.find(t=>t.id===b.dataset.review);t.lastReviewed=new Date().toISOString();save();alert("Revision recorded. Great work!");});
  $("topic-list").querySelectorAll("[data-delete]").forEach(b=>b.onclick=()=>{if(confirm("Delete this topic?")){data.topics=data.topics.filter(t=>t.id!==b.dataset.delete);data.cards=data.cards.filter(c=>c.topicId!==b.dataset.delete);save();}});
}
$("search-topics").addEventListener("input",renderLibrary);$("filter-category").addEventListener("change",renderLibrary);

function renderFlashcards(){
  const area=$("flashcard-area");
  if(!data.cards.length){area.innerHTML='<div class="empty">You have no flashcards yet. Create your first question and answer card.</div>';return;}
  currentCard=(currentCard+data.cards.length)%data.cards.length;const c=data.cards[currentCard],topic=data.topics.find(t=>t.id===c.topicId);
  area.innerHTML=`<div class="flash-wrap"><div class="flash-meta">CARD ${currentCard+1} OF ${data.cards.length}${topic?" · "+escapeHTML(topic.title):""}</div><div class="flash-card"><p class="eyebrow">${answerVisible?"ANSWER":"QUESTION"}</p><h2 class="${answerVisible?"answer":""}">${escapeHTML(answerVisible?c.answer:c.question)}</h2></div><div class="flash-controls"><button class="secondary-btn" id="prev-card">← Previous</button><button class="primary-btn" id="flip-card">${answerVisible?"Show question":"Reveal answer"}</button><button class="secondary-btn" id="next-card">Next →</button></div><div class="flash-meta">Try to answer from memory before revealing the answer.</div><div class="flash-controls"><button class="small-btn danger" id="delete-card">Delete this card</button></div></div>`;
  $("prev-card").onclick=()=>{currentCard=(currentCard-1+data.cards.length)%data.cards.length;answerVisible=false;renderFlashcards();};
  $("next-card").onclick=()=>{currentCard=(currentCard+1)%data.cards.length;answerVisible=false;renderFlashcards();};
  $("flip-card").onclick=()=>{answerVisible=!answerVisible;renderFlashcards();};
  $("delete-card").onclick=()=>{if(confirm("Delete this flashcard?")){data.cards.splice(currentCard,1);answerVisible=false;save();}};
}
function renderRevision(){
  const list=data.topics.filter(due);
  $("revision-list").innerHTML=list.length?list.map(t=>`<div class="topic-row"><div><strong>${escapeHTML(t.title)}</strong><small>${escapeHTML(t.category)} · ${t.lastReviewed?"Last reviewed: "+new Date(t.lastReviewed).toLocaleDateString():"Not reviewed yet"}</small></div><button class="small-btn" data-revise="${t.id}">Mark reviewed</button></div>`).join(""):'<div class="empty">All caught up! No topics are currently due for revision.</div>';
  $("revision-list").querySelectorAll("[data-revise]").forEach(b=>b.onclick=()=>{const t=data.topics.find(x=>x.id===b.dataset.revise);t.lastReviewed=new Date().toISOString();save();});
}
function renderQuizStart(){
  const area=$("quiz-area");
  if(!quizQuestions.length||quizFinished){area.innerHTML=`<div class="eyebrow">PRACTICE MODE</div><h3>Test what you remember</h3><p class="muted">The quiz uses your saved flashcards. Add at least 2 flashcards to generate a quiz.</p>${data.cards.length>=2?'<button class="primary-btn" id="start-quiz">Start quiz</button>':'<button class="secondary-btn" data-go="flashcards">Create flashcards first</button>'}<p class="muted" id="last-score">${quizFinished?"Your last score: "+quizScore+" / "+quizQuestions.length:""}</p>`;
    const start=$("start-quiz");if(start)start.onclick=startQuiz;return;}
  renderQuizQuestion();
}
function startQuiz(){quizQuestions=[...data.cards].sort(()=>Math.random()-.5);quizIndex=0;quizScore=0;selectedAnswer=null;quizFinished=false;renderQuizQuestion();}
function renderQuizQuestion(){
  const area=$("quiz-area"),q=quizQuestions[quizIndex];if(!q)return;
  const others=data.cards.filter(c=>c.id!==q.id).map(c=>c.answer);
  const options=[q.answer,...others.sort(()=>Math.random()-.5).slice(0,3)].sort(()=>Math.random()-.5);
  q._options=options;
  area.innerHTML=`<div class="panel-heading"><div class="eyebrow">QUESTION ${quizIndex+1} OF ${quizQuestions.length}</div><span class="subtle">Score: ${quizScore}</span></div><div class="progress-track"><div style="width:${(quizIndex/quizQuestions.length)*100}%"></div></div><p class="quiz-question">${escapeHTML(q.question)}</p><div class="answers">${options.map((o,i)=>`<div class="answer-option" data-option="${i}">${escapeHTML(o)}</div>`).join("")}</div><p class="feedback" id="quiz-feedback"></p><button class="primary-btn" id="quiz-next" disabled>${quizIndex===quizQuestions.length-1?"Finish quiz":"Next question →"}</button>`;
  area.querySelectorAll("[data-option]").forEach(el=>el.onclick=()=>{if(selectedAnswer!==null)return;selectedAnswer=Number(el.dataset.option);const correct=options[selectedAnswer]===q.answer;if(correct)quizScore++;area.querySelectorAll("[data-option]").forEach((op,i)=>{op.classList.add(options[i]===q.answer?"correct":i===selectedAnswer?"wrong":"");});$("quiz-feedback").textContent=correct?"Correct! Well done.":"Not quite. The correct answer is: "+q.answer;$("quiz-next").disabled=false;});
  $("quiz-next").onclick=()=>{if(selectedAnswer===null)return;quizIndex++;selectedAnswer=null;if(quizIndex>=quizQuestions.length){quizFinished=true;area.innerHTML=`<div class="eyebrow">QUIZ COMPLETE</div><h2 style="font:800 25px Manrope">You scored ${quizScore} / ${quizQuestions.length}</h2><p class="muted">${Math.round(quizScore/quizQuestions.length*100)}% correct. Keep practising to improve your retention.</p><button class="primary-btn" id="retry-quiz">Try again</button>`;$("retry-quiz").onclick=startQuiz;}else renderQuizQuestion();};
}
function renderAll(){renderDashboard();renderLibrary();renderFlashcards();renderRevision();}
showPage("dashboard");
