// app.js
const API = '';

/* Helpers */
const $ = sel => document.querySelector(sel);
const $$ = sel => Array.from(document.querySelectorAll(sel));

/* UI elements */
const btnAddProfile = $('#btn-add-profile');
const btnGoProfile = $('#btn-go-profile');
const btnAddVideo = $('#btn-add-video');
const btnYourVideos = $('#btn-your-videos');

const modalOverlay = $('#modal-overlay');
const modalAddProfile = $('#modal-add-profile');
const modalLogin = $('#modal-login');
const modalAddVideo = $('#modal-add-video');
const modalYourVideos = $('#modal-your-videos');

const formAddProfile = $('#form-add-profile');
const formLogin = $('#form-login');
const formAddVideo = $('#form-add-video');

const carouselEl = $('#carousel');
const videosGrid = $('#videos-grid');
const mainVideo = $('#main-video');
const videoMeta = $('#video-meta');
const commentsList = $('#comments-list');
const commentText = $('#comment-text');
const commentName = $('#comment-name');
const btnAddComment = $('#btn-add-comment');
const yourVideosList = $('#your-videos-list');

let featured = [];
let currentVideo = null;
let carouselIndex = 0;
let carouselTimer = null;

/* Maintain logged code in localStorage */
function getSavedCode(){ return localStorage.getItem('profile_code'); }
function saveCode(code){ localStorage.setItem('profile_code', code); updateAuthUI(); }
function clearCode(){ localStorage.removeItem('profile_code'); updateAuthUI(); }

function openModal(el){ modalOverlay.classList.remove('hidden'); el.classList.remove('hidden'); }
function closeModal(el){ modalOverlay.classList.add('hidden'); el.classList.add('hidden'); }

/* Auth UI */
function updateAuthUI() {
  const code = getSavedCode();
  if (code) {
    btnAddVideo.disabled = false;
    btnYourVideos.disabled = false;
    btnAddProfile.disabled = true;
    btnGoProfile.textContent = 'Logged in';
  } else {
    btnAddVideo.disabled = true;
    btnYourVideos.disabled = true;
    btnAddProfile.disabled = false;
    btnGoProfile.textContent = 'Go to your profile';
  }
}

/* Fetch featured and render carousel */
async function loadFeatured(){
  const res = await fetch('/api/videos/featured');
  featured = await res.json();
  renderCarousel();
  if (featured.length) loadVideoById(featured[0].id);
  startCarousel();
}

function renderCarousel(){
  carouselEl.innerHTML = '';
  featured.forEach((v, idx) => {
    const div = document.createElement('div');
    div.className = 'item';
    div.dataset.id = v.id;
    div.innerHTML = `<img src="${v.thumbnail ? '/thumb/' + v.thumbnail : '/thumb/placeholder.png'}" alt="${escapeHtml(v.title || 'video')}" />
                     <div style="font-size:14px;margin-top:6px">${escapeHtml(v.title || 'Untitled')}</div>`;
    div.onclick = () => loadVideoById(v.id);
    carouselEl.appendChild(div);
  });
}

function startCarousel(){
  if (carouselTimer) clearInterval(carouselTimer);
  carouselTimer = setInterval(() => {
    if (!featured.length) return;
    carouselIndex = (carouselIndex + 1) % featured.length;
    const id = featured[carouselIndex].id;
    loadVideoById(id);
    // scroll carousel a little:
    const items = $$('.carousel .item');
    if (items[carouselIndex]) items[carouselIndex].scrollIntoView({ behavior: 'smooth', inline: 'center' });
  }, 5000); // 5s
}

async function loadVideoById(id){
  const res = await fetch('/api/videos/' + id);
  if (!res.ok) return;
  const v = await res.json();
  currentVideo = v;
  const videoUrl = '/video/' + v.filename;
  mainVideo.src = videoUrl;
  videoMeta.innerHTML = `<strong>${escapeHtml(v.title)}</strong>
    <div style="color: #666; font-size: 14px;">Uploaded by: ${escapeHtml(v.uploader_name || 'Unknown')}</div>
    <div style="margin-top:6px">${escapeHtml(v.description || '')}</div>`;
  loadComments(id);
}

/* Comments */
async function loadComments(videoId){
  commentsList.innerHTML = '<div style="color:#666">Loading comments…</div>';
  const res = await fetch(`/api/videos/${videoId}/comments`);
  const comments = await res.json();
  commentsList.innerHTML = '';
  comments.forEach(c => {
    const d = document.createElement('div');
    d.className = 'comment';
    d.innerHTML = `<div style="font-size:13px; color:#333;"><strong>${escapeHtml(c.profile_name || c.name || 'Anonymous')}</strong>
      <span style="color:#999; font-size:12px; margin-left:8px">${(new Date(c.created_at)).toLocaleString()}</span></div>
      <div style="margin-top:6px">${escapeHtml(c.text)}</div>`;
    commentsList.appendChild(d);
  });
}

/* Add comment */
btnAddComment.onclick = async () => {
  const text = commentText.value.trim();
  if (!text) return alert('Please type a comment');
  const code = getSavedCode();
  const name = commentName.value.trim();
  const res = await fetch(`/api/videos/${currentVideo.id}/comments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, name, code })
  });
  if (res.ok) {
    commentText.value = '';
    commentName.value = '';
    loadComments(currentVideo.id);
  } else {
    const err = await res.json();
    alert(err.error || 'Could not add comment');
  }
};

/* More videos grid */
async function loadMoreVideos(){
  const res = await fetch('/api/videos');
  const list = await res.json();
  videosGrid.innerHTML = '';
  list.forEach(v => {
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `<img src="${v.thumbnail ? '/thumb/' + v.thumbnail : '/thumb/placeholder.png'}" style="width:100%;height:140px;object-fit:cover;border-radius:6px" />
      <h4 style="margin:8px 0 4px">${escapeHtml(v.title)}</h4>
      <div style="color:#666;font-size:13px">${escapeHtml(v.uploader_name || 'Unknown')}</div>
      <div style="margin-top:8px"><button class="btn" data-id="${v.id}">Watch</button></div>`;
    videosGrid.appendChild(card);
    card.querySelector('button').onclick = () => loadVideoById(v.id);
  });
}

/* Add profile form */
formAddProfile.onsubmit = async (e) => {
  e.preventDefault();
  const data = new FormData(formAddProfile);
  const body = Object.fromEntries(data.entries());
  const res = await fetch('/api/profiles', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const json = await res.json();
  if (json.success) {
    $('#add-profile-result').textContent = `Profile created! Your code: ${json.code}. Save it to login later.`;
    saveCode(json.code);
    closeModal(modalAddProfile);
  } else {
    $('#add-profile-result').textContent = json.error || 'Error creating profile';
  }
};

/* Login form */
formLogin.onsubmit = async (e) => {
  e.preventDefault();
  const code = formLogin.code.value.trim();
  if (!code) return;
  const res = await fetch('/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code })
  });
  if (res.ok) {
    const json = await res.json();
    saveCode(code);
    $('#login-result').textContent = `Welcome, ${json.profile.name}`;
    closeModal(modalLogin);
  } else {
    const j = await res.json();
    $('#login-result').textContent = j.error || 'Login failed';
  }
};

/* Add video form (multipart) */
formAddVideo.onsubmit = async (e) => {
  e.preventDefault();
  const code = getSavedCode();
  if (!code) { alert('You must be logged in (Go to your profile) to upload'); return; }
  const form = new FormData(formAddVideo);
  form.append('code', code);
  const res = await fetch('/api/videos', { method: 'POST', body: form });
  const json = await res.json();
  if (json.success) {
    $('#add-video-result').textContent = 'Uploaded! Refreshing lists...';
    closeModal(modalAddVideo);
    await loadFeatured();
    await loadMoreVideos();
  } else {
    $('#add-video-result').textContent = json.error || 'Upload failed';
  }
};

/* Your videos */
async function openYourVideos(){
  const code = getSavedCode();
  if (!code) return alert('Please login first');
  const res = await fetch('/api/myvideos?code=' + encodeURIComponent(code));
  const list = await res.json();
  yourVideosList.innerHTML = '';
  if (list.length === 0) yourVideosList.textContent = 'No videos yet';
  list.forEach(v => {
    const div = document.createElement('div');
    div.className = 'card';
    div.innerHTML = `<h4>${escapeHtml(v.title)}</h4>
      <div style="color:#666;font-size:13px">${(new Date(v.created_at)).toLocaleString()}</div>
      <div style="margin-top:8px"><button class="btn" data-id="${v.id}">Watch</button></div>`;
    div.querySelector('button').onclick = () => { loadVideoById(v.id); closeModal(modalYourVideos); }
    yourVideosList.appendChild(div);
  });
  openModal(modalYourVideos);
}

/* Utility */
function escapeHtml(s=''){ return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;"}[c])); }

/* UI wiring */
btnAddProfile.onclick = () => openModal(modalAddProfile);
$('#close-add-profile').onclick = () => closeModal(modalAddProfile);

btnGoProfile.onclick = () => openModal(modalLogin);
$('#close-login').onclick = () => closeModal(modalLogin);

btnAddVideo.onclick = () => openModal(modalAddVideo);
$('#close-add-video').onclick = () => closeModal(modalAddVideo);

btnYourVideos.onclick = () => openYourVideos();
$('#close-your-videos').onclick = () => closeModal(modalYourVideos);

modalOverlay.onclick = () => {
  closeModal(modalAddProfile);
  closeModal(modalLogin);
  closeModal(modalAddVideo);
  closeModal(modalYourVideos);
};

/* Initialize */
updateAuthUI();
loadFeatured();
loadMoreVideos();
