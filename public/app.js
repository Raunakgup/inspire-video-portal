// app.js (updated fixes for login/profile, add comment feedback, and add-video thumbnail toggle)
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

const addCommentResult = $('#add-comment-result');

let featured = [];
let currentVideo = null;
let carouselIndex = 0;
let carouselTimer = null;

/* Maintain logged code in localStorage */
function getSavedCode(){ return localStorage.getItem('profile_code'); }
function saveCode(code){ localStorage.setItem('profile_code', code); updateAuthUI(); }
function clearCode(){ localStorage.removeItem('profile_code'); updateAuthUI(); }

/* UI helpers */
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
    btnGoProfile.textContent = 'Log In';
  }
}

/* Show profile info when user is logged in */
async function showProfileInfo() {
  const code = getSavedCode();
  if (!code) return openModal(modalLogin);
  try {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code })
    });
    if (!res.ok) {
      // code not found on server
      clearCode();
      alert('Your saved code is not valid on the server. Please add profile or log in again.');
      return;
    }
    const data = await res.json();
    const p = data.profile;
    const msg = `Name: ${p.name}\nEmail: ${p.email || '-'}\nMobile: ${p.mobile || '-'}\nType: ${p.type}\n\nWant to log out? Click OK to log out, Cancel to keep logged in.`;
    if (confirm(msg)) {
      clearCode();
      alert('Logged out. You can now create a new profile.');
    }
  } catch (err) {
    console.error(err);
    alert('Error fetching profile info. Check server or network.');
  }
}

/* Fetch featured and render carousel */
async function loadFeatured(){
  try {
    const res = await fetch('/api/videos/featured');
    featured = await res.json();
  } catch (err) {
    console.error('Failed to load featured', err);
    featured = [];
  }
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
    const items = $$('.carousel .item');
    if (items[carouselIndex]) items[carouselIndex].scrollIntoView({ behavior: 'smooth', inline: 'center' });
  }, 5000);
}

async function loadVideoById(id){
  try {
    const res = await fetch('/api/videos/' + id);
    if (!res.ok) {
      console.warn('video not found', id);
      return;
    }
    const v = await res.json();
    currentVideo = v;
    const videoUrl = '/video/' + v.filename;
    mainVideo.src = videoUrl;
    videoMeta.innerHTML = `<strong>${escapeHtml(v.title)}</strong>
      <div style="color: #666; font-size: 14px;">Uploaded by: ${escapeHtml(v.uploader_name || 'Unknown')}</div>
      <div style="margin-top:6px">${escapeHtml(v.description || '')}</div>`;
    loadComments(id);
  } catch (err) {
    console.error('Failed to load video', err);
  }
}

/* Comments */
async function loadComments(videoId){
  commentsList.innerHTML = '<div style="color:#666">Loading comments…</div>';
  try {
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
  } catch (err) {
    console.error('Failed to load comments', err);
    commentsList.innerHTML = '<div style="color:crimson">Failed to load comments</div>';
  }
}

/* Add comment */
btnAddComment.onclick = async () => {
  if (!currentVideo || !currentVideo.id) { alert('Please select a video first'); return; }
  const text = commentText.value.trim();
  if (!text) return alert('Please type a comment');
  const code = getSavedCode();
  const name = commentName.value.trim();

  // disable button while sending
  btnAddComment.disabled = true;
  addCommentResult.style.display = 'none';
  addCommentResult.textContent = '';

  try {
    const res = await fetch(`/api/videos/${currentVideo.id}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, name, code })
    });
    if (res.ok) {
      // show temporary confirmation
      addCommentResult.style.display = 'block';
      addCommentResult.style.color = 'green';
      addCommentResult.textContent = 'Comment added!';
      setTimeout(() => { addCommentResult.style.display = 'none'; }, 2200);

      // clear inputs and reload comments
      commentText.value = '';
      commentName.value = '';
      await loadComments(currentVideo.id);
    } else {
      const err = await res.json();
      alert(err.error || 'Could not add comment');
    }
  } catch (err) {
    console.error(err);
    alert('Network error adding comment');
  } finally {
    btnAddComment.disabled = false;
  }
};

/* More videos grid */
async function loadMoreVideos(){
  try {
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
  } catch (err) {
    console.error('Failed to load more videos', err);
    videosGrid.innerHTML = '<div style="color:crimson">Failed to load videos</div>';
  }
}

/* Add profile form */
formAddProfile.onsubmit = async (e) => {
  e.preventDefault();
  $('#add-profile-result').textContent = 'Creating profile...';
  const data = new FormData(formAddProfile);
  const body = Object.fromEntries(data.entries());
  try {
    const res = await fetch('/api/profiles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const json = await res.json();
    if (json && json.success && json.code) {
      // show code prominently and save
      $('#add-profile-result').textContent = `Profile created! Your code: ${json.code}. Save it to login later.`;
      saveCode(json.code);
      // close after a short delay so user can see the code
      setTimeout(() => closeModal(modalAddProfile), 900);
    } else {
      $('#add-profile-result').textContent = json.error || 'Error creating profile';
    }
  } catch (err) {
    console.error('Failed to create profile', err);
    $('#add-profile-result').textContent = 'Network/server error creating profile';
  }
};

/* Login form */
formLogin.onsubmit = async (e) => {
  e.preventDefault();
  const code = formLogin.code.value.trim();
  if (!code) return;
  $('#login-result').textContent = 'Logging in...';
  try {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code })
    });
    if (res.ok) {
      const json = await res.json();
      saveCode(code);
      $('#login-result').textContent = `Welcome, ${json.profile.name}`;
      setTimeout(() => closeModal(modalLogin), 800);
    } else {
      const j = await res.json();
      $('#login-result').textContent = j.error || 'Login failed';
    }
  } catch (err) {
    console.error(err);
    $('#login-result').textContent = 'Network error during login';
  }
};

/* Add video form (multipart) */
formAddVideo.onsubmit = async (e) => {
  e.preventDefault();
  const code = getSavedCode();
  if (!code) { alert('You must be logged in (Log In) to upload'); return; }
  $('#add-video-result').textContent = 'Uploading...';
  const form = new FormData(formAddVideo);
  form.append('code', code);
  try {
    const res = await fetch('/api/videos', { method: 'POST', body: form });
    const json = await res.json();
    if (json.success) {
      $('#add-video-result').textContent = 'Uploaded! Refreshing lists...';
      setTimeout(() => closeModal(modalAddVideo), 700);
      await loadFeatured();
      await loadMoreVideos();
    } else {
      $('#add-video-result').textContent = json.error || 'Upload failed';
    }
  } catch (err) {
    console.error(err);
    $('#add-video-result').textContent = 'Network or server error during upload';
  }
};

/* Your videos */
async function openYourVideos(){
  const code = getSavedCode();
  if (!code) return alert('Please login first');
  try {
    const res = await fetch('/api/myvideos?code=' + encodeURIComponent(code));
    const list = await res.json();
    yourVideosList.innerHTML = '';
    if (!Array.isArray(list) || list.length === 0) yourVideosList.textContent = 'No videos yet';
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
  } catch (err) {
    console.error('Failed to load your videos', err);
    alert('Failed to load your videos');
  }
}

/* Utility */
function escapeHtml(s=''){ return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;"}[c])); }

/* UI wiring */
btnAddProfile.onclick = () => openModal(modalAddProfile);
$('#close-add-profile').onclick = () => closeModal(modalAddProfile);

btnGoProfile.onclick = () => {
  const code = getSavedCode();
  if (code) {
    // show profile info and allow logout
    showProfileInfo();
  } else {
    openModal(modalLogin);
  }
};
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

/* Thumbnail toggle in upload modal */
const toggleThumb = $('#toggle-thumbnail');
const thumbWrapper = $('#thumbnail-wrapper');
if (toggleThumb && thumbWrapper) {
  toggleThumb.onchange = () => {
    thumbWrapper.style.display = toggleThumb.checked ? 'block' : 'none';
  };
}

/* Initialize */
updateAuthUI();
loadFeatured();
loadMoreVideos();
