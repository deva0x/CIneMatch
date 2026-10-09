/**
 * CineMatch — Friends' Movie Recommendations & Ratings
 * Client Application Logic with Name-Tracked Friend Reactions
 */

(function () {
  'use strict';

  // ==========================================================================
  // Application State
  // ==========================================================================
  const state = {
    userName: '',
    recommendations: [],
    activeFilterFriend: 'all',
    activeSort: 'newest',
    searchQuery: '',
    sentimentFilter: 'all', // 'all', 'loved', 'hated', 'begged'
    viewMode: 'cards',      // 'cards', 'compact'
    selectedMovieForRec: null,
    searchDebounce: null,
    isServerConnected: false,
    expandedComments: new Set(),
    isMutating: false,
    lastMutationTime: 0
  };

  const API_BASE = 'https://v3-cinemeta.strem.io';

  // Blank slate - no default dummy recommendations
  const DEFAULT_SEED_RECOMMENDATIONS = [];

  // ==========================================================================
  // Unique User Color Palette System
  // ==========================================================================
  const USER_COLOR_PALETTE = [
    { dark: '#38bdf8', light: '#0284c7', bgDark: 'rgba(56, 189, 248, 0.18)', bgLight: 'rgba(2, 132, 199, 0.12)' },   // Sky Blue
    { dark: '#ec4899', light: '#db2777', bgDark: 'rgba(236, 72, 153, 0.18)', bgLight: 'rgba(219, 39, 119, 0.12)' },  // Pink
    { dark: '#a855f7', light: '#9333ea', bgDark: 'rgba(168, 85, 247, 0.18)', bgLight: 'rgba(147, 51, 234, 0.12)' },  // Purple
    { dark: '#34d399', light: '#059669', bgDark: 'rgba(52, 211, 153, 0.18)', bgLight: 'rgba(5, 150, 105, 0.12)' },   // Emerald
    { dark: '#fb923c', light: '#ea580c', bgDark: 'rgba(251, 146, 60, 0.18)', bgLight: 'rgba(234, 88, 12, 0.12)' },   // Orange
    { dark: '#f43f5e', light: '#e11d48', bgDark: 'rgba(244, 63, 94, 0.18)', bgLight: 'rgba(225, 29, 72, 0.12)' },    // Rose
    { dark: '#22d3ee', light: '#0891b2', bgDark: 'rgba(34, 211, 238, 0.18)', bgLight: 'rgba(8, 145, 178, 0.12)' },   // Cyan
    { dark: '#facc15', light: '#b45309', bgDark: 'rgba(250, 204, 21, 0.18)', bgLight: 'rgba(180, 83, 9, 0.12)' },    // Amber
    { dark: '#818cf8', light: '#4f46e5', bgDark: 'rgba(129, 140, 248, 0.18)', bgLight: 'rgba(79, 70, 229, 0.12)' },  // Indigo
    { dark: '#f472b6', light: '#c026d3', bgDark: 'rgba(244, 114, 182, 0.18)', bgLight: 'rgba(192, 38, 211, 0.12)' }, // Fuchsia
    { dark: '#2dd4bf', light: '#0d9488', bgDark: 'rgba(45, 212, 191, 0.18)', bgLight: 'rgba(13, 148, 136, 0.12)' },  // Teal
    { dark: '#a3e635', light: '#4d7c0f', bgDark: 'rgba(163, 230, 53, 0.18)', bgLight: 'rgba(77, 124, 15, 0.12)' }    // Lime
  ];

  function getUserColor(name) {
    if (!name) return USER_COLOR_PALETTE[0];
    let hash = 0;
    const clean = name.trim().toLowerCase();
    for (let i = 0; i < clean.length; i++) {
      hash = (hash * 31 + clean.charCodeAt(i)) & 0xffffffff;
    }
    const index = Math.abs(hash) % USER_COLOR_PALETTE.length;
    return USER_COLOR_PALETTE[index];
  }

  function getUserColorStyle(name) {
    const c = getUserColor(name);
    return `--u-color-dark:${c.dark};--u-color-light:${c.light};--u-bg-dark:${c.bgDark};--u-bg-light:${c.bgLight};`;
  }

  // ==========================================================================
  // Movy.sx Stream Integration & TMDB ID Resolution
  // Direct play route format: https://www.movy.sx/movie/<tmdbId>?play=true
  // ==========================================================================
  const KNOWN_TMDB_MAP = {
    "10 cloverfield lane": 333371,
    "6 underground": 509967,
    "arrival": 329865,
    "bethlehem kudumba unit": 1508168,
    "blade runner 2049": 335984,
    "coco": 354912,
    "cowboy bebop: the movie - knockin' on heaven's door": 11299,
    "dune: part one": 438631,
    "dune: part two": 693134,
    "everything everywhere all at once": 545611,
    "fight club": 550,
    "get out": 419430,
    "inception": 27205,
    "interstellar": 157336,
    "jurassic park": 329,
    "knives out": 546554,
    "la la land": 313369,
    "mad max: fury road": 76341,
    "not another teen movie": 11397,
    "oppenheimer": 872585,
    "parasite": 496243,
    "pulp fiction": 680,
    "qala": 934419,
    "ready player one": 333339,
    "real steel": 39254,
    "requiem for a dream": 641,
    "se7en": 807,
    "spider-man: across the spider-verse": 569094,
    "spirited away": 129,
    "the dark knight": 155,
    "the godfather": 238,
    "the grand budapest hotel": 120467,
    "the lord of the rings: the fellowship of the ring": 120,
    "the matrix": 603,
    "the namesake": 16727,
    "the prestige": 1124,
    "the shawshank redemption": 278,
    "the silence of the lambs": 274,
    "titanic": 597,
    "toy story": 862,
    "tron: legacy": 20526,
    "tt0068646": 238,
    "tt0102926": 274,
    "tt0107290": 329,
    "tt0110912": 680,
    "tt0111161": 278,
    "tt0114369": 807,
    "tt0114709": 862,
    "tt0120338": 597,
    "tt0120737": 120,
    "tt0133093": 603,
    "tt0137523": 550,
    "tt0180093": 641,
    "tt0245429": 129,
    "tt0275277": 11299,
    "tt0277371": 11397,
    "tt0338526": 7131,
    "tt0433035": 39254,
    "tt0433416": 16727,
    "tt0468569": 155,
    "tt0482571": 1124,
    "tt0816692": 157336,
    "tt1104001": 20526,
    "tt1160419": 438631,
    "tt1179933": 333371,
    "tt1375666": 27205,
    "tt1392190": 76341,
    "tt14428598": 934419,
    "tt15239678": 693134,
    "tt15398776": 872585,
    "tt1677720": 333339,
    "tt1856101": 335984,
    "tt2278388": 120467,
    "tt2384920": 354912,
    "tt2543164": 329865,
    "tt2582802": 244786,
    "tt37535100": 1508168,
    "tt3783958": 313369,
    "tt5052448": 419430,
    "tt6710474": 545611,
    "tt6751668": 496243,
    "tt8106534": 509967,
    "tt8946378": 546554,
    "tt9362722": 569094,
    "van helsing": 7131,
    "whiplash": 244786,
  };

  const tmdbCache = new Map();

  function getTmdbIdSync(movieId, title) {
    if (movieId && KNOWN_TMDB_MAP[movieId]) return KNOWN_TMDB_MAP[movieId];
    const clean = (title || '').trim().toLowerCase();
    if (clean && KNOWN_TMDB_MAP[clean]) return KNOWN_TMDB_MAP[clean];
    if (movieId && tmdbCache.has(movieId)) return tmdbCache.get(movieId);
    if (clean && tmdbCache.has(clean)) return tmdbCache.get(clean);
    return null;
  }

  async function resolveTmdbId(movieId, title, year) {
    const syncId = getTmdbIdSync(movieId, title);
    if (syncId) return syncId;

    const cleanTitle = (title || '').trim().toLowerCase();

    // 1. Try lookup by IMDb ID if available
    if (movieId && movieId.startsWith('tt')) {
      try {
        const resp = await fetch(`https://db.wecollege.net/3/find/${encodeURIComponent(movieId)}?external_source=imdb_id`);
        if (resp.ok) {
          const data = await resp.json();
          if (data.movie_results && data.movie_results.length > 0) {
            const resolvedId = data.movie_results[0].id;
            tmdbCache.set(movieId, resolvedId);
            if (cleanTitle) tmdbCache.set(cleanTitle, resolvedId);
            return resolvedId;
          }
        }
      } catch (e) {}
    }

    // 2. Try search by Title (+ year if available)
    if (title) {
      try {
        let searchUrl = `https://db.wecollege.net/3/search/movie?query=${encodeURIComponent(title.trim())}`;
        if (year) searchUrl += `&year=${encodeURIComponent(year)}`;
        const resp = await fetch(searchUrl);
        if (resp.ok) {
          const data = await resp.json();
          if (data.results && data.results.length > 0) {
            const resolvedId = data.results[0].id;
            if (movieId) tmdbCache.set(movieId, resolvedId);
            if (cleanTitle) tmdbCache.set(cleanTitle, resolvedId);
            return resolvedId;
          }
        }
      } catch (e) {}

      // 2b. Retry title search without year restriction
      if (year) {
        try {
          const respNoYear = await fetch(`https://db.wecollege.net/3/search/movie?query=${encodeURIComponent(title.trim())}`);
          if (respNoYear.ok) {
            const dataNoYear = await respNoYear.json();
            if (dataNoYear.results && dataNoYear.results.length > 0) {
              const resolvedId = dataNoYear.results[0].id;
              if (movieId) tmdbCache.set(movieId, resolvedId);
              if (cleanTitle) tmdbCache.set(cleanTitle, resolvedId);
              return resolvedId;
            }
          }
        } catch (e) {}
      }

      // 2c. Retry with cleaned title (remove subtitles/punctuation after colons or dashes)
      const cleaned = title.replace(/[:\-–].*$/, '').trim();
      if (cleaned && cleaned.toLowerCase() !== cleanTitle) {
        try {
          const respClean = await fetch(`https://db.wecollege.net/3/search/movie?query=${encodeURIComponent(cleaned)}`);
          if (respClean.ok) {
            const dataClean = await respClean.json();
            if (dataClean.results && dataClean.results.length > 0) {
              const resolvedId = dataClean.results[0].id;
              if (movieId) tmdbCache.set(movieId, resolvedId);
              if (cleanTitle) tmdbCache.set(cleanTitle, resolvedId);
              return resolvedId;
            }
          }
        } catch (e) {}
      }
    }

    return null;
  }

  function getWatchMovieUrl(item) {
    if (!item) return 'https://www.movy.sx';
    if (item.tmdbId) {
      return `https://www.movy.sx/movie/${item.tmdbId}?play=true`;
    }
    const syncId = getTmdbIdSync(item.movieId, item.title);
    if (syncId) {
      item.tmdbId = syncId;
      return `https://www.movy.sx/movie/${syncId}?play=true`;
    }
    return 'https://www.movy.sx';
  }

  async function handleWatchMovieClick(e, item, anchorElem) {
    if (anchorElem && anchorElem.href && anchorElem.href.includes('/movie/')) {
      // Native navigation will smoothly open the movie in new tab
      return;
    }

    e.preventDefault();

    // Open target tab immediately to prevent popup blocker on mobile & desktop
    const newTab = window.open('about:blank', '_blank');
    if (newTab) {
      try {
        newTab.document.write(`
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <title>Loading ${escapeHtml(item.title || 'Movie')} on Movy.sx...</title>
            <style>
              body { background: #07090e; color: #f8fafc; font-family: system-ui, -apple-system, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
              .box { text-align: center; max-width: 380px; padding: 24px; }
              .spinner { width: 38px; height: 38px; border: 3px solid rgba(255,255,255,0.1); border-top-color: #10b981; border-radius: 50%; animation: spin 0.8s linear infinite; margin: 0 auto 16px; }
              @keyframes spin { to { transform: rotate(360deg); } }
            </style>
          </head>
          <body>
            <div class="box">
              <div class="spinner"></div>
              <h2 style="font-size:1.15rem;margin:0 0 8px;">Connecting to Movy.sx...</h2>
              <p style="color:#94a3b8;font-size:0.9rem;margin:0;">Opening "${escapeHtml(item.title || 'Movie')}"</p>
            </div>
          </body>
          </html>
        `);
      } catch (err) {}
    }

    try {
      const tmdbId = await resolveTmdbId(item.movieId, item.title, item.year);
      if (tmdbId) {
        item.tmdbId = tmdbId;
        const watchUrl = `https://www.movy.sx/movie/${tmdbId}?play=true`;
        if (anchorElem) anchorElem.href = watchUrl;
        if (newTab) {
          newTab.location.href = watchUrl;
        } else {
          window.open(watchUrl, '_blank', 'noopener,noreferrer');
        }
      } else {
        const fallbackUrl = 'https://www.movy.sx/browse/movie';
        if (newTab) newTab.location.href = fallbackUrl;
      }
    } catch (err) {
      if (newTab) newTab.location.href = 'https://www.movy.sx';
    }
  }

  function resolveFeedTmdbIds(items) {
    if (!Array.isArray(items)) return;
    items.forEach(item => {
      if (!item.tmdbId) {
        resolveTmdbId(item.movieId, item.title, item.year).then(tmdbId => {
          if (tmdbId) {
            item.tmdbId = tmdbId;
            const watchUrl = `https://www.movy.sx/movie/${tmdbId}?play=true`;
            const anchors = document.querySelectorAll(`[data-rec-id="${item.id}"].btn-stream-now, [data-rec-id="${item.id}"].btn-watch-movie, [data-rec-id="${item.id}"].btn-compact-watch`);
            anchors.forEach(a => {
              a.href = watchUrl;
            });
          }
        }).catch(() => {});
      }
    });
  }


  // ==========================================================================
  // DOM Elements
  // ==========================================================================
  const elements = {
    ambientBackdrop: document.getElementById('ambientBackdrop'),
    brandHomeBtn: document.getElementById('brandHomeBtn'),
    userProfileBtn: document.getElementById('userProfileBtn'),
    userAvatarCircle: document.getElementById('userAvatarCircle'),
    headerUserName: document.getElementById('headerUserName'),
    themeToggleBtn: document.getElementById('themeToggleBtn'),

    // Feed Controls & Expandable Panels
    heroAddRecommendBtn: document.getElementById('heroAddRecommendBtn'),
    searchToggleBtn: document.getElementById('searchToggleBtn'),
    searchExpandPanel: document.getElementById('searchExpandPanel'),
    searchClearBtn: document.getElementById('searchClearBtn'),
    feedFilterInput: document.getElementById('feedFilterInput'),

    filterToggleBtn: document.getElementById('filterToggleBtn'),
    filterExpandPanel: document.getElementById('filterExpandPanel'),
    filterActiveBadge: document.getElementById('filterActiveBadge'),
    friendSelectFilter: document.getElementById('friendSelectFilter'),
    sortSelectFilter: document.getElementById('sortSelectFilter'),
    sentimentFilterBar: document.getElementById('sentimentFilterBar'),

    totalRecsCount: document.getElementById('totalRecsCount'),
    friendsFeedGrid: document.getElementById('friendsFeedGrid'),
    feedEmptyState: document.getElementById('feedEmptyState'),
    emptyStateRecommendBtn: document.getElementById('emptyStateRecommendBtn'),
    feedHeadingLabel: document.getElementById('feedHeadingLabel'),
    viewCardsBtn: document.getElementById('viewCardsBtn'),
    viewCompactBtn: document.getElementById('viewCompactBtn'),
    feedSyncBtn: document.getElementById('feedSyncBtn'),
    syncStatusDot: document.getElementById('syncStatusDot'),
    syncStatusText: document.getElementById('syncStatusText'),

    // Modal 1: Onboarding Name
    namePromptModal: document.getElementById('namePromptModal'),
    namePromptForm: document.getElementById('namePromptForm'),
    userNameInput: document.getElementById('userNameInput'),

    // Modal 2: Add Recommendation
    addRecommendationModal: document.getElementById('addRecommendationModal'),
    closeAddRecBtn: document.getElementById('closeAddRecBtn'),
    recModalHeaderTitle: document.getElementById('recModalHeaderTitle'),
    recSearchView: document.getElementById('recSearchView'),
    recDetailsView: document.getElementById('recDetailsView'),
    recMovieSearchInput: document.getElementById('recMovieSearchInput'),
    recSearchClearBtn: document.getElementById('recSearchClearBtn'),
    recResultsHeaderLabel: document.getElementById('recResultsHeaderLabel'),
    recResultsCount: document.getElementById('recResultsCount'),
    recAutocompleteDropdown: document.getElementById('recAutocompleteDropdown'),
    recSelectedMoviePreview: document.getElementById('recSelectedMoviePreview'),
    recChangeMovieBtn: document.getElementById('recChangeMovieBtn'),
    recPreviewPoster: document.getElementById('recPreviewPoster'),
    recPreviewTitle: document.getElementById('recPreviewTitle'),
    recPreviewYear: document.getElementById('recPreviewYear'),
    recPreviewImdb: document.getElementById('recPreviewImdb'),
    recPreviewDirector: document.getElementById('recPreviewDirector'),
    recPreviewWatchBtn: document.getElementById('recPreviewWatchBtn'),
    recPreviewSynopsis: document.getElementById('recPreviewSynopsis'),
    recFormDetails: document.getElementById('recFormDetails'),
    recPersonalNoteInput: document.getElementById('recPersonalNoteInput'),
    submitRecommendationBtn: document.getElementById('submitRecommendationBtn'),

    // Modal 3: Similar Movies (Secondary)
    similarMoviesModal: document.getElementById('similarMoviesModal'),
    closeSimilarBtn: document.getElementById('closeSimilarBtn'),
    similarModalTitle: document.getElementById('similarModalTitle'),
    similarModalSubtitle: document.getElementById('similarModalSubtitle'),
    similarMoviesGrid: document.getElementById('similarMoviesGrid'),

    // Modal 4: Trailer Player
    trailerModal: document.getElementById('trailerModal'),
    closeTrailerBtn: document.getElementById('closeTrailerBtn'),
    trailerModalTitle: document.getElementById('trailerModalTitle'),
    trailerIframe: document.getElementById('trailerIframe'),
    trailerWatchMovieBtn: document.getElementById('trailerWatchMovieBtn'),

    // Modal 5: Share
    shareModal: document.getElementById('shareModal'),
    closeShareBtn: document.getElementById('closeShareBtn'),
    shareLinkInput: document.getElementById('shareLinkInput'),
    copyShareLinkBtn: document.getElementById('copyShareLinkBtn'),
    shareQrCodeImg: document.getElementById('shareQrCodeImg'),
    nativeShareBtn: document.getElementById('nativeShareBtn'),

    toastContainer: document.getElementById('toastContainer')
  };

  // ==========================================================================
  // Dark / Light Theme Management
  // ==========================================================================
  const THEME_STORAGE_KEY = 'geddis_rec_theme';

  function initTheme() {
    const savedTheme = localStorage.getItem(THEME_STORAGE_KEY) || 'dark';
    applyTheme(savedTheme);
  }

  function applyTheme(theme) {
    if (theme === 'light') {
      document.documentElement.setAttribute('data-theme', 'light');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  }

  function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
    const nextTheme = currentTheme === 'light' ? 'dark' : 'light';
    applyTheme(nextTheme);
    showToast(nextTheme === 'light' ? '☀️ Switched to Light Mode' : '🌙 Switched to Dark Mode');
  }

  // ==========================================================================
  // Initialization
  // ==========================================================================
  async function init() {
    initTheme();
    loadUserFromStorage();
    setupEventListeners();
    await loadRecommendations();
    startAutoSync();

    // Check if first-time user
    if (!state.userName) {
      openNamePromptModal();
    } else {
      updateUserUI();
    }
  }

  // ==========================================================================
  // User Onboarding & Name Management
  // ==========================================================================
  function loadUserFromStorage() {
    state.userName = localStorage.getItem('cinematch_user_name') || '';
  }

  function saveUserToStorage(name) {
    state.userName = name.trim();
    localStorage.setItem('cinematch_user_name', state.userName);
    updateUserUI();
  }

  function updateUserUI() {
    const name = state.userName || 'Set Name';
    elements.headerUserName.textContent = name;
    elements.userAvatarCircle.textContent = name.charAt(0).toUpperCase() || '?';
    if (state.userName) {
      elements.userAvatarCircle.style.cssText = getUserColorStyle(state.userName);
      elements.userAvatarCircle.className = 'avatar-circle user-colored-avatar';
      elements.headerUserName.style.cssText = getUserColorStyle(state.userName);
      elements.headerUserName.className = 'user-name-text user-colored-name';
    } else {
      elements.userAvatarCircle.className = 'avatar-circle';
      elements.headerUserName.className = 'user-name-text';
      elements.userAvatarCircle.style.cssText = '';
      elements.headerUserName.style.cssText = '';
    }
  }

  function openNamePromptModal() {
    elements.namePromptModal.classList.remove('hidden');
    elements.userNameInput.value = state.userName || '';
    setTimeout(() => elements.userNameInput.focus(), 100);
  }

  function closeNamePromptModal() {
    elements.namePromptModal.classList.add('hidden');
  }

  function handleNamePromptSubmit(e) {
    e.preventDefault();
    const val = elements.userNameInput.value.trim();
    if (!val) return;
    saveUserToStorage(val);
    closeNamePromptModal();
    showToast(`Welcome to Geddi's Rec, ${state.userName}! 🍿`);
    updateFriendFilterDropdown();
    renderFeed();
  }

  function promptChangeName() {
    const newName = prompt('Enter your name (your friends will see this):', state.userName || '');
    if (newName && newName.trim()) {
      saveUserToStorage(newName);
      showToast(`Name updated to "${state.userName}"`);
      renderFeed();
      updateFriendFilterDropdown();
    }
  }

  // ==========================================================================
  // Data Loading & Syncing (Blank Slate)
  // ==========================================================================
  const DB_VERSION = 'v2_blank_slate';

  function updateSyncStatusUI(isConnected, isSyncing = false) {
    if (!elements.feedSyncBtn || !elements.syncStatusDot || !elements.syncStatusText) return;

    if (isSyncing) {
      elements.feedSyncBtn.className = 'btn-sync-pill syncing';
      elements.syncStatusText.textContent = 'Syncing...';
      return;
    }

    if (isConnected) {
      elements.feedSyncBtn.className = 'btn-sync-pill';
      elements.syncStatusDot.className = 'sync-dot live';
      elements.syncStatusText.textContent = 'Live Sync';
      elements.feedSyncBtn.title = 'Connected to Cloud • All friends recommendations synced. Tap to refresh.';
    } else {
      elements.feedSyncBtn.className = 'btn-sync-pill offline';
      elements.syncStatusDot.className = 'sync-dot';
      elements.syncStatusText.textContent = 'Offline';
      elements.feedSyncBtn.title = 'Offline mode (using cached data) • Tap to retry connection.';
    }
  }

  function mergeServerRecsWithOptimistic(serverRecs) {
    if (!Array.isArray(serverRecs)) return [];
    const myNameLower = (state.userName || '').trim().toLowerCase();
    if (!myNameLower) return serverRecs;

    // If a mutation occurred within the last 15 seconds, protect the user's local optimistic reaction and comments
    const isRecentMutation = (Date.now() - state.lastMutationTime) < 15000;
    if (!isRecentMutation) return serverRecs;

    return serverRecs.map(serverItem => {
      const localItem = state.recommendations.find(r => r.id === serverItem.id);
      if (!localItem) return serverItem;

      // 1. Preserve optimistic reaction
      const rxnKeys = ['beg', 'hyped', 'loved', 'liked', 'disliked', 'hated'];
      let localUserRxn = null;
      for (const k of rxnKeys) {
        if (localItem.reactions && Array.isArray(localItem.reactions[k])) {
          if (localItem.reactions[k].some(u => u.toLowerCase() === myNameLower)) {
            localUserRxn = k;
            break;
          }
        }
      }

      if (localUserRxn) {
        // Strip user from all other server reaction buckets
        for (const k of rxnKeys) {
          serverItem.reactions[k] = (serverItem.reactions[k] || []).filter(u => u.toLowerCase() !== myNameLower);
        }
        // Ensure user is in localUserRxn
        if (!serverItem.reactions[localUserRxn].some(u => u.toLowerCase() === myNameLower)) {
          serverItem.reactions[localUserRxn].push(state.userName);
        }
      }

      // 2. Preserve optimistic comments
      if (Array.isArray(localItem.comments)) {
        if (!Array.isArray(serverItem.comments)) serverItem.comments = [];
        const serverCommentIds = new Set(serverItem.comments.map(c => c.id));
        const serverCommentTexts = new Set(serverItem.comments.map(c => c.text));

        for (const lc of localItem.comments) {
          if (lc.author && lc.author.toLowerCase() === myNameLower) {
            if (!serverCommentIds.has(lc.id) && !serverCommentTexts.has(lc.text)) {
              serverItem.comments.push(lc);
            }
          }
        }
      }

      return serverItem;
    });
  }

  async function loadRecommendations(isSilent = false) {
    // If a local user action is in-flight or occurred recently, skip background sync to protect optimistic state
    if (isSilent && (state.isMutating || (Date.now() - state.lastMutationTime < 6000))) {
      return;
    }

    if (!isSilent) {
      updateSyncStatusUI(state.isServerConnected, true);
    }

    let serverSuccess = false;

    // 1. Fetch from server API (Netlify Functions or server.py)
    try {
      const resp = await fetch(`/api/recommendations?_t=${Date.now()}`, {
        headers: { 'Cache-Control': 'no-cache, no-store' }
      });
      if (resp.ok) {
        const data = await resp.json();
        if (Array.isArray(data)) {
          serverSuccess = true;
          state.isServerConnected = true;

          const normalized = mergeServerRecsWithOptimistic(normalizeRecs(data));
          const currentJson = JSON.stringify(state.recommendations);
          const newJson = JSON.stringify(normalized);

          if (currentJson !== newJson) {
            state.recommendations = normalized;
            saveRecommendationsToStorage();
            renderFeed();
            updateFriendFilterDropdown();
          }

          updateSyncStatusUI(true, false);
          return;
        }
      }
    } catch (e) {
      // Server API unreachable
    }

    if (!serverSuccess) {
      state.isServerConnected = false;
      updateSyncStatusUI(false, false);

      // Fallback to localStorage cache
      try {
        const stored = localStorage.getItem('cinematch_friend_recs');
        if (stored) {
          state.recommendations = mergeServerRecsWithOptimistic(normalizeRecs(JSON.parse(stored)));
        } else {
          state.recommendations = [];
        }
      } catch (e) {
        state.recommendations = [];
      }

      renderFeed();
      updateFriendFilterDropdown();
    }
  }

  function startAutoSync() {
    // 1. Poll every 10 seconds when window/tab is visible and no mutation is in-flight
    setInterval(() => {
      if (!document.hidden && !state.isMutating && (Date.now() - state.lastMutationTime > 6000)) {
        loadRecommendations(true);
      }
    }, 10000);

    // 2. Tab visibility change (when switching back to browser tab from another app, with 5s cooldown)
    let lastVisibilitySync = 0;
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && !state.isMutating && (Date.now() - state.lastMutationTime > 6000)) {
        if (Date.now() - lastVisibilitySync > 5000) {
          lastVisibilitySync = Date.now();
          loadRecommendations(true);
        }
      }
    });
  }

  function normalizeRecs(recs) {
    if (!Array.isArray(recs)) return [];
    return recs.map(item => {
      const rxns = item.reactions || {};
      return {
        ...item,
        reactions: {
          beg: Array.isArray(rxns.beg) ? rxns.beg : [],
          hyped: Array.isArray(rxns.hyped) ? rxns.hyped : [],
          loved: Array.isArray(rxns.loved) ? rxns.loved : [],
          liked: Array.isArray(rxns.liked) ? rxns.liked : [],
          disliked: Array.isArray(rxns.disliked) ? rxns.disliked : [],
          hated: Array.isArray(rxns.hated) ? rxns.hated : []
        },
        comments: Array.isArray(item.comments) ? item.comments : []
      };
    });
  }

  function saveRecommendationsToStorage() {
    try {
      localStorage.setItem('cinematch_friend_recs', JSON.stringify(state.recommendations));
    } catch (e) {
      console.warn('Could not save recommendations to localStorage:', e);
    }
  }

  // ==========================================================================
  // Feed Rendering & Reactions
  // ==========================================================================
  function renderFeed() {
    let list = [...state.recommendations];

    // Helper functions for sentiment counts
    // "I beg you to watch this counts towards loved this"
    const getLovedScore = (item) => {
      const rxns = item.reactions || {};
      const begCount = Array.isArray(rxns.beg) ? rxns.beg.length : 0;
      const lovedCount = Array.isArray(rxns.loved) ? rxns.loved.length : 0;
      return begCount + lovedCount;
    };

    const getHatedScore = (item) => {
      const rxns = item.reactions || {};
      return Array.isArray(rxns.hated) ? rxns.hated.length : 0;
    };

    const getBegScore = (item) => {
      const rxns = item.reactions || {};
      return Array.isArray(rxns.beg) ? rxns.beg.length : 0;
    };

    // Filter by Friend
    if (state.activeFilterFriend !== 'all') {
      list = list.filter(m => m.recommendedBy.toLowerCase() === state.activeFilterFriend.toLowerCase());
    }

    // Filter by Search Query
    if (state.searchQuery) {
      const q = state.searchQuery.toLowerCase();
      list = list.filter(m =>
        m.title.toLowerCase().includes(q) ||
        m.recommendedBy.toLowerCase().includes(q) ||
        (m.note && m.note.toLowerCase().includes(q)) ||
        (m.synopsis && m.synopsis.toLowerCase().includes(q))
      );
    }

    // Filter & Sort by Sentiment Tab if chosen
    if (state.sentimentFilter === 'loved') {
      list = list.filter(item => getLovedScore(item) > 0);
      list.sort((a, b) => getLovedScore(b) - getLovedScore(a));
    } else if (state.sentimentFilter === 'hated') {
      list = list.filter(item => getHatedScore(item) > 0);
      list.sort((a, b) => getHatedScore(b) - getHatedScore(a));
    } else if (state.sentimentFilter === 'begged') {
      list = list.filter(item => getBegScore(item) > 0);
      list.sort((a, b) => getBegScore(b) - getBegScore(a));
    } else {
      // Sort Filter Dropdown
      if (state.activeSort === 'newest') {
        // Default array order is newest first
      } else if (state.activeSort === 'most-loved') {
        list.sort((a, b) => getLovedScore(b) - getLovedScore(a));
      } else if (state.activeSort === 'most-hated') {
        list.sort((a, b) => getHatedScore(b) - getHatedScore(a));
      } else if (state.activeSort === 'most-begged') {
        list.sort((a, b) => getBegScore(b) - getBegScore(a));
      } else if (state.activeSort === 'highest-imdb') {
        list.sort((a, b) => (parseFloat(b.imdbRating) || 0) - (parseFloat(a.imdbRating) || 0));
      }
    }

    // Update section heading label
    if (elements.feedHeadingLabel) {
      if (state.sentimentFilter === 'loved') {
        elements.feedHeadingLabel.textContent = '❤️ Most Loved Movies';
      } else if (state.sentimentFilter === 'hated') {
        elements.feedHeadingLabel.textContent = '🤮 Most Hated Movies';
      } else if (state.sentimentFilter === 'begged') {
        elements.feedHeadingLabel.textContent = '🔥 Begged to Watch';
      } else if (state.activeFilterFriend !== 'all') {
        elements.feedHeadingLabel.textContent = `${state.activeFilterFriend}'s Recommendations`;
      } else {
        elements.feedHeadingLabel.textContent = 'All Recommendations';
      }
    }

    elements.totalRecsCount.textContent = list.length;

    if (list.length === 0) {
      elements.friendsFeedGrid.innerHTML = '';
      elements.feedEmptyState.classList.remove('hidden');
      elements.ambientBackdrop.style.backgroundImage = 'none';

      const emptyTitle = elements.feedEmptyState.querySelector('h3');
      const emptyDesc = elements.feedEmptyState.querySelector('p');
      if (state.recommendations.length === 0) {
        if (emptyTitle) emptyTitle.textContent = 'Welcome! No recommendations yet';
        if (emptyDesc) emptyDesc.textContent = 'Be the first to recommend a movie to your circle! Tap the button below to get started.';
      } else {
        if (emptyTitle) emptyTitle.textContent = 'No recommendations found';
        if (emptyDesc) emptyDesc.textContent = 'Try clearing your search filter, or select another sentiment tab.';
      }
      return;
    }

    elements.feedEmptyState.classList.add('hidden');

    // Set ambient background to the topmost movie poster
    if (list[0] && list[0].poster) {
      elements.ambientBackdrop.style.backgroundImage = `url('${list[0].poster}')`;
    } else {
      elements.ambientBackdrop.style.backgroundImage = 'none';
    }

    // Render either compact list or full cards view
    if (state.viewMode === 'compact') {
      elements.friendsFeedGrid.className = 'compact-feed-list';
      elements.friendsFeedGrid.innerHTML = list.map(item => renderCompactRowHtml(item)).join('');
      attachCompactListeners();
    } else {
      elements.friendsFeedGrid.className = 'friends-feed-grid';
      elements.friendsFeedGrid.innerHTML = list.map(item => renderRecCardHtml(item)).join('');
      attachCardListeners();
    }

    // In background, pre-resolve any missing TMDB IDs for visible movies
    resolveFeedTmdbIds(list);
  }

  function renderCompactRowHtml(item) {
    const rxns = item.reactions || { beg: [], hyped: [], loved: [], liked: [], disliked: [], hated: [] };
    const myNameLower = (state.userName || '').toLowerCase();
    const isCurrentUser = state.userName && item.recommendedBy.trim().toLowerCase() === myNameLower;
    const lovedCount = (rxns.beg?.length || 0) + (rxns.loved?.length || 0);
    const hypedCount = rxns.hyped?.length || 0;
    const hatedCount = rxns.hated?.length || 0;
    const commentsCount = Array.isArray(item.comments) ? item.comments.length : 0;
    const userStyle = getUserColorStyle(item.recommendedBy);

    return `
      <div class="compact-feed-item" data-id="${item.id}">
        <div class="compact-info-col">
          <h3 class="compact-movie-title">${escapeHtml(item.title)}</h3>
          <div class="compact-meta-row">
            <span class="compact-by-prefix">Recommended by</span>
            <span class="compact-recommender-name user-colored-name" style="${userStyle}">${escapeHtml(item.recommendedBy)}${isCurrentUser ? ' (You)' : ''}</span>
            ${hypedCount > 0 ? `<span class="compact-badge-hyped">🔥 ${hypedCount} hyped</span>` : ''}
            ${lovedCount > 0 ? `<span class="compact-badge-loved">❤️ ${lovedCount} loved</span>` : ''}
            ${hatedCount > 0 ? `<span class="compact-badge-hated">🤮 ${hatedCount} hated</span>` : ''}
            ${commentsCount > 0 ? `<span class="compact-badge-comments">💬 ${commentsCount}</span>` : ''}
          </div>
        </div>
        <div class="compact-actions-col">
          <a href="${getWatchMovieUrl(item)}" target="_blank" rel="noopener noreferrer" class="btn-compact-watch" data-rec-id="${item.id}" data-movie-id="${item.movieId || ''}" data-title="${escapeHtml(item.title)}" title="Stream ${escapeHtml(item.title)} on Movy.sx">
            <svg viewBox="0 0 24 24" fill="currentColor" style="width:11px;height:11px;">
              <polygon points="5 3 19 12 5 21 5 3"></polygon>
            </svg>
            <span>Stream NOW!</span>
          </a>
          ${isCurrentUser ? `
            <button class="btn-delete-rec" data-rec-id="${item.id}" data-title="${escapeHtml(item.title)}" title="Remove your recommendation">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              </svg>
              <span>Remove</span>
            </button>
          ` : ''}
        </div>
      </div>
    `;
  }

  function renderRecCardHtml(item) {
    const rxns = item.reactions || { beg: [], hyped: [], loved: [], liked: [], disliked: [], hated: [] };
    const begList = Array.isArray(rxns.beg) ? rxns.beg : [];
    const hypedList = Array.isArray(rxns.hyped) ? rxns.hyped : [];
    const lovedList = Array.isArray(rxns.loved) ? rxns.loved : [];
    const likedList = Array.isArray(rxns.liked) ? rxns.liked : [];
    const dislikedList = Array.isArray(rxns.disliked) ? rxns.disliked : [];
    const hatedList = Array.isArray(rxns.hated) ? rxns.hated : [];
    const comments = Array.isArray(item.comments) ? item.comments : [];
    const isCommentsOpen = state.expandedComments.has(item.id);

    const myNameLower = (state.userName || '').toLowerCase();
    const hasBeg = myNameLower && begList.some(u => u.toLowerCase() === myNameLower);
    const hasHyped = myNameLower && hypedList.some(u => u.toLowerCase() === myNameLower);
    const hasLoved = myNameLower && lovedList.some(u => u.toLowerCase() === myNameLower);
    const hasLiked = myNameLower && likedList.some(u => u.toLowerCase() === myNameLower);
    const hasDisliked = myNameLower && dislikedList.some(u => u.toLowerCase() === myNameLower);
    const hasHated = myNameLower && hatedList.some(u => u.toLowerCase() === myNameLower);

    const isCurrentUser = state.userName && item.recommendedBy.trim().toLowerCase() === myNameLower;
    const initials = item.recommendedBy.charAt(0).toUpperCase();
    const recommenderColorStyle = getUserColorStyle(item.recommendedBy);

    const totalVotes = begList.length + hypedList.length + lovedList.length + likedList.length + dislikedList.length + hatedList.length;

    return `
      <article class="friend-rec-card ${begList.length > 0 ? 'has-beg-reaction' : ''}" data-id="${item.id}" data-movie-id="${item.movieId}">
        <!-- Recommender Header Banner -->
        <div class="rec-card-header">
          <div class="recommender-profile">
            <div class="recommender-avatar user-colored-avatar" style="${recommenderColorStyle}">${initials}</div>
            <div class="recommender-meta">
              <span class="recommended-by-text">Recommended by</span>
              <span class="recommender-name user-colored-name" style="${recommenderColorStyle}">${escapeHtml(item.recommendedBy)}${isCurrentUser ? ' (You)' : ''}</span>
              <span class="rec-timestamp">• ${escapeHtml(item.timestamp || 'Recent')}</span>
            </div>
          </div>
          <div class="rec-card-header-actions">
            ${isCurrentUser ? `
              <button class="btn-delete-rec" data-rec-id="${item.id}" data-title="${escapeHtml(item.title)}" title="Remove your recommendation">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="3 6 5 6 21 6"></polyline>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                </svg>
                <span>Remove</span>
              </button>
            ` : ''}
            <button class="rec-share-quick-btn share-single-btn" data-id="${item.id}" title="Share this recommendation">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;">
                <circle cx="18" cy="5" r="3"></circle>
                <circle cx="6" cy="12" r="3"></circle>
                <circle cx="18" cy="19" r="3"></circle>
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
                <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
              </svg>
            </button>
          </div>
        </div>

        <!-- Special Begging Shoutout Banner if anyone begged -->
        ${begList.length > 0 ? `
          <div class="beg-shoutout-banner">
            <span class="beg-fire-icon">🔥</span>
            <span class="beg-banner-text"><strong class="user-colored-name" style="${getUserColorStyle(begList[0])}">${escapeHtml(begList[0])}</strong>${begList.length > 1 ? ` & ${begList.length - 1} other${begList.length > 2 ? 's' : ''}` : ''}: "I BEG YOU TO WATCH THIS!"</span>
          </div>
        ` : ''}

        <!-- Friend Personal Note / Review -->
        ${item.note ? `
          <div class="friend-note-bubble">
            <span class="quote-icon">💬</span>
            <p class="friend-note-text">"${escapeHtml(item.note)}"</p>
          </div>
        ` : ''}

        <!-- Card Body (Poster + Metadata + Synopsis) -->
        <div class="rec-card-body">
          <div class="rec-poster-wrapper">
            <img class="rec-poster" src="${item.poster || 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22140%22 height=%22210%22><rect width=%22100%%22 height=%22100%%22 fill=%22%23161e2e%22/></svg>'}" alt="${escapeHtml(item.title)}" loading="lazy">
            <div class="rec-poster-imdb-badge">
              <span class="star">★</span>
              <span>${item.imdbRating || '7.8'}</span>
            </div>
          </div>

          <div class="rec-movie-details">
            <div>
              <div class="rec-movie-title-row">
                <h3 class="rec-movie-title">${escapeHtml(item.title)}</h3>
                <span class="rec-movie-year">${item.year || ''}</span>
              </div>

              <div class="rec-movie-chips">
                <span class="imdb-chip-small">★ ${item.imdbRating || '7.8'} IMDb</span>
                ${item.director ? `<span class="meta-tag">Dir. ${escapeHtml(item.director)}</span>` : ''}
                ${(item.genres || []).slice(0, 2).map(g => `<span class="meta-tag genre-tag">${escapeHtml(g)}</span>`).join('')}
              </div>

              <p class="rec-movie-synopsis">${escapeHtml(item.synopsis || 'Plot summary not available.')}</p>
              ${(item.synopsis && item.synopsis.length > 130) ? `<button class="synopsis-toggle-btn">Read more</button>` : ''}
            </div>
          </div>
        </div>

        <!-- Central Prominent "Stream it NOW!" Button -->
        <div class="rec-stream-cta-wrap">
          <a href="${getWatchMovieUrl(item)}" target="_blank" rel="noopener noreferrer" class="btn-stream-now" data-rec-id="${item.id}" data-movie-id="${item.movieId || ''}" data-title="${escapeHtml(item.title)}" title="Stream ${escapeHtml(item.title)} on Movy.sx">
            <svg viewBox="0 0 24 24" fill="currentColor" class="stream-play-icon">
              <polygon points="5 3 19 12 5 21 5 3"></polygon>
            </svg>
            <span>Stream it NOW!</span>
          </a>
        </div>

        <!-- Card Footer: Reaction Buttons + Comment & Secondary Actions -->
        <div class="rec-card-footer">
          <!-- Reaction Buttons Deck -->
          <div class="reaction-buttons-deck">
            <!-- Button: "I beg you to watch this" -->
            <button class="btn-reaction btn-beg ${hasBeg ? 'active beg' : ''}" data-rec-id="${item.id}" data-reaction="beg" title="I beg you to watch this!">
              <span class="rxn-icon">🙏</span>
              <span class="rxn-label-beg">I beg you to watch this</span>
              <span class="rxn-count">(${begList.length})</span>
            </button>

            <!-- Button: "Hyped to watch" -->
            <button class="btn-reaction btn-hyped ${hasHyped ? 'active hyped' : ''}" data-rec-id="${item.id}" data-reaction="hyped" title="Vote: Hyped to watch!">
              <span class="rxn-icon">🔥</span>
              <span>Hyped to watch</span>
              <span class="rxn-count">(${hypedList.length})</span>
            </button>

            <button class="btn-reaction ${hasLoved ? 'active loved' : ''}" data-rec-id="${item.id}" data-reaction="loved" title="Vote: Loved it">
              <span class="rxn-icon">❤️</span>
              <span>Loved it</span>
              <span class="rxn-count">(${lovedList.length})</span>
            </button>

            <button class="btn-reaction ${hasLiked ? 'active liked' : ''}" data-rec-id="${item.id}" data-reaction="liked" title="Vote: Liked">
              <span class="rxn-icon">👍</span>
              <span>Liked</span>
              <span class="rxn-count">(${likedList.length})</span>
            </button>

            <button class="btn-reaction ${hasDisliked ? 'active disliked' : ''}" data-rec-id="${item.id}" data-reaction="disliked" title="Vote: Didn't like">
              <span class="rxn-icon">👎</span>
              <span>Didn't like</span>
              <span class="rxn-count">(${dislikedList.length})</span>
            </button>

            <button class="btn-reaction ${hasHated ? 'active hated' : ''}" data-rec-id="${item.id}" data-reaction="hated" title="Vote: Hate it">
              <span class="rxn-icon">🤮</span>
              <span>Hate it</span>
              <span class="rxn-count">(${hatedList.length})</span>
            </button>
          </div>

          <!-- Secondary Actions: Comments, Similar Movies, Trailer -->
          <div class="rec-secondary-actions">
            <!-- Comment Section Toggle Button (Always displays total count of comments) -->
            <button class="btn-comment-toggle ${isCommentsOpen ? 'active' : ''}" data-rec-id="${item.id}" aria-expanded="${isCommentsOpen ? 'true' : 'false'}" title="View and post comments">
              <span class="comment-icon">💬</span>
              <span class="comment-toggle-label">Comments</span>
              <span class="comment-count-pill">${comments.length}</span>
            </button>

            <!-- Small Secondary Button for Recommendations -->
            <button class="btn-similar-movies open-similar-btn" data-id="${item.id}" title="See smart recommendations based on this movie">
              <span>✨ Similar</span>
            </button>

            <button class="btn-trailer-small play-trailer-btn" data-id="${item.id}" title="Watch Trailer">
              <svg viewBox="0 0 24 24" fill="currentColor" style="width:12px;height:12px;">
                <polygon points="5 3 19 12 5 21 5 3"></polygon>
              </svg>
              <span>Trailer</span>
            </button>
          </div>
        </div>

        <!-- WHO REACTED BREAKDOWN TRAY (Visible Friend Names!) -->
        <div class="reactions-breakdown-tray">
          ${begList.length > 0 ? `
            <div class="voter-group beg">
              <span class="voter-group-label">🙏 Begging you to watch:</span>
              <div class="voter-chips-wrap">
                ${begList.map(name => renderVoterChip(name, myNameLower)).join('')}
              </div>
            </div>
          ` : ''}

          ${hypedList.length > 0 ? `
            <div class="voter-group hyped">
              <span class="voter-group-label">🔥 Hyped to watch:</span>
              <div class="voter-chips-wrap">
                ${hypedList.map(name => renderVoterChip(name, myNameLower)).join('')}
              </div>
            </div>
          ` : ''}

          ${lovedList.length > 0 ? `
            <div class="voter-group loved">
              <span class="voter-group-label">❤️ Loved it:</span>
              <div class="voter-chips-wrap">
                ${lovedList.map(name => renderVoterChip(name, myNameLower)).join('')}
              </div>
            </div>
          ` : ''}

          ${likedList.length > 0 ? `
            <div class="voter-group liked">
              <span class="voter-group-label">👍 Liked:</span>
              <div class="voter-chips-wrap">
                ${likedList.map(name => renderVoterChip(name, myNameLower)).join('')}
              </div>
            </div>
          ` : ''}

          ${dislikedList.length > 0 ? `
            <div class="voter-group disliked">
              <span class="voter-group-label">👎 Didn't like:</span>
              <div class="voter-chips-wrap">
                ${dislikedList.map(name => renderVoterChip(name, myNameLower)).join('')}
              </div>
            </div>
          ` : ''}

          ${hatedList.length > 0 ? `
            <div class="voter-group hated">
              <span class="voter-group-label">🤮 Hate it:</span>
              <div class="voter-chips-wrap">
                ${hatedList.map(name => renderVoterChip(name, myNameLower)).join('')}
              </div>
            </div>
          ` : ''}

          ${totalVotes === 0 ? `
            <div class="no-reactions-hint">
              <span>💬 No friend reactions yet — tap a button above to rate it!</span>
            </div>
          ` : ''}
        </div>

        <!-- EXPANDABLE COMMENT SECTION (Only shows up when clicking comment symbol) -->
        <div id="commentsSection-${item.id}" class="movie-comments-section ${isCommentsOpen ? '' : 'hidden'}">
          <div class="comments-section-header">
            <span class="comments-title">💬 Comments (${comments.length})</span>
            <span class="comments-hint">Friends' movie talk & replies</span>
          </div>

          <div class="comments-feed-list">
            ${comments.length === 0 ? `
              <div class="no-comments-empty">
                <span class="empty-bubble-icon">💭</span>
                <p>No comments yet on this movie. Be the first to share your thoughts!</p>
              </div>
            ` : comments.map(c => {
              const isCommentAuthor = state.userName && c.author.trim().toLowerCase() === myNameLower;
              const cStyle = getUserColorStyle(c.author);
              return `
                <div class="comment-bubble-item" data-comment-id="${escapeHtml(c.id || '')}">
                  <div class="comment-author-row">
                    <span class="comment-author-avatar user-colored-avatar" style="${cStyle}">${escapeHtml(c.author.charAt(0).toUpperCase())}</span>
                    <span class="comment-author-name user-colored-name" style="${cStyle}">${escapeHtml(c.author)}${isCommentAuthor ? ' (You)' : ''}</span>
                    <span class="comment-timestamp">• ${escapeHtml(c.timestamp || 'Just now')}</span>
                  </div>
                  <div class="comment-message-bubble">
                    <p class="comment-text-body">${escapeHtml(c.text)}</p>
                  </div>
                </div>
              `;
            }).join('')}
          </div>

          <!-- Post Comment Form -->
          <form class="comment-input-form" data-rec-id="${item.id}">
            <div class="comment-input-row">
              <input 
                type="text" 
                class="comment-input-field" 
                placeholder="Write a comment as ${escapeHtml(state.userName || 'You')}..." 
                maxlength="500" 
                required
              >
              <button type="submit" class="btn-post-comment" title="Send comment">
                <span>Post</span>
                <svg class="send-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                  <line x1="22" y1="2" x2="11" y2="13"></line>
                  <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                </svg>
              </button>
            </div>
          </form>
        </div>
      </article>
    `;
  }

  function renderVoterChip(name, myNameLower) {
    const isYou = myNameLower && name.toLowerCase() === myNameLower;
    const userStyle = getUserColorStyle(name);
    return `
      <span class="voter-chip user-colored-voter ${isYou ? 'is-you' : ''}" style="${userStyle}">
        ${escapeHtml(name)}${isYou ? ' (You)' : ''}
      </span>
    `;
  }

  function attachCardListeners() {
    // Synopsis expand / collapse
    elements.friendsFeedGrid.querySelectorAll('.synopsis-toggle-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const text = btn.previousElementSibling;
        const isExp = text.classList.toggle('expanded');
        btn.textContent = isExp ? 'Read less' : 'Read more';
      });
    });

    // Reaction Buttons
    elements.friendsFeedGrid.querySelectorAll('.btn-reaction').forEach(btn => {
      btn.addEventListener('click', () => {
        const recId = btn.dataset.recId;
        const rxn = btn.dataset.reaction;
        handleReactionVote(recId, rxn);
      });
    });

    // Comment Toggle Button
    elements.friendsFeedGrid.querySelectorAll('.btn-comment-toggle').forEach(btn => {
      btn.addEventListener('click', () => {
        const recId = btn.dataset.recId;
        const section = document.getElementById(`commentsSection-${recId}`);
        if (!section) return;
        const willOpen = section.classList.contains('hidden');
        if (willOpen) {
          state.expandedComments.add(recId);
          section.classList.remove('hidden');
          btn.classList.add('active');
          btn.setAttribute('aria-expanded', 'true');
          const input = section.querySelector('.comment-input-field');
          if (input) setTimeout(() => input.focus(), 100);
        } else {
          state.expandedComments.delete(recId);
          section.classList.add('hidden');
          btn.classList.remove('active');
          btn.setAttribute('aria-expanded', 'false');
        }
      });
    });

    // Comment Input Form Submission
    elements.friendsFeedGrid.querySelectorAll('.comment-input-form').forEach(form => {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!state.userName) {
          openNamePromptModal();
          return;
        }
        const recId = form.dataset.recId;
        const input = form.querySelector('.comment-input-field');
        const text = input ? input.value.trim() : '';
        if (!text) return;

        const item = state.recommendations.find(r => r.id === recId);
        if (!item) return;

        if (!Array.isArray(item.comments)) item.comments = [];

        // Set mutation lock
        state.isMutating = true;
        state.lastMutationTime = Date.now();

        const newCommentObj = {
          id: `c-${Date.now()}`,
          author: state.userName.trim(),
          text: text,
          timestamp: 'Just now'
        };

        item.comments.push(newCommentObj);
        saveRecommendationsToStorage();
        state.expandedComments.add(recId);
        renderFeed();
        showToast('Comment posted! 💬');

        // Sync to server
        try {
          const resp = await fetch('/api/comments', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: recId, comment: newCommentObj })
          });
          if (resp.ok) {
            const resData = await resp.json();
            if (resData && Array.isArray(resData.comments)) {
              const currentItem = state.recommendations.find(r => r.id === recId);
              if (currentItem) {
                currentItem.comments = resData.comments;
                saveRecommendationsToStorage();
              }
            }
            state.isServerConnected = true;
            updateSyncStatusUI(true);
          }
        } catch (err) {
          console.warn('Could not sync comment with server:', err);
        } finally {
          state.isMutating = false;
          state.lastMutationTime = Date.now();
        }
      });
    });

    // Small Secondary Button: Similar Movies
    elements.friendsFeedGrid.querySelectorAll('.open-similar-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const recId = btn.dataset.id;
        const item = state.recommendations.find(r => r.id === recId);
        if (item) openSimilarMoviesModal(item);
      });
    });

    // Stream it NOW! Button
    elements.friendsFeedGrid.querySelectorAll('.btn-stream-now, .btn-watch-movie').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const recId = btn.dataset.recId;
        const item = state.recommendations.find(r => r.id === recId);
        if (item) handleWatchMovieClick(e, item, btn);
      });
    });

    // Trailer Button
    elements.friendsFeedGrid.querySelectorAll('.play-trailer-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const recId = btn.dataset.id;
        const item = state.recommendations.find(r => r.id === recId);
        if (item) openTrailerModal(item);
      });
    });

    // Share Single Card Button
    elements.friendsFeedGrid.querySelectorAll('.share-single-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const recId = btn.dataset.id;
        const item = state.recommendations.find(r => r.id === recId);
        if (item) openShareModalForMovie(item);
      });
    });

    // Delete Recommendation Button (Author Only)
    elements.friendsFeedGrid.querySelectorAll('.btn-delete-rec').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const recId = btn.dataset.recId;
        deleteRecommendation(recId);
      });
    });
  }

  function attachCompactListeners() {
    // Watch Movie Button in Compact View
    elements.friendsFeedGrid.querySelectorAll('.btn-compact-watch').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const recId = btn.dataset.recId;
        const item = state.recommendations.find(r => r.id === recId);
        if (item) handleWatchMovieClick(e, item, btn);
      });
    });

    // Delete Recommendation Button in Compact View (Author Only)
    elements.friendsFeedGrid.querySelectorAll('.btn-delete-rec').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const recId = btn.dataset.recId;
        deleteRecommendation(recId);
      });
    });
  }

  // ==========================================================================
  // Delete Recommendation (Author Only)
  // ==========================================================================
  async function deleteRecommendation(recId) {
    if (!state.userName) {
      openNamePromptModal();
      return;
    }

    const item = state.recommendations.find(r => r.id === recId);
    if (!item) return;

    const myName = state.userName.trim();
    if (item.recommendedBy.trim().toLowerCase() !== myName.toLowerCase()) {
      showToast("You can only remove movies that you recommended.");
      return;
    }

    const confirmed = window.confirm(`Are you sure you want to remove your recommendation for "${item.title}"?`);
    if (!confirmed) return;

    // Set mutation lock
    state.isMutating = true;
    state.lastMutationTime = Date.now();

    // Remove locally
    state.recommendations = state.recommendations.filter(r => r.id !== recId);
    saveRecommendationsToStorage();
    renderFeed();
    updateFriendFilterDropdown();
    showToast(`Removed "${item.title}" from recommendations.`);

    // Sync to server (Netlify Functions or server.py)
    try {
      const resp = await fetch('/api/recommendations/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: recId, userName: myName })
      });
      if (resp.ok) {
        state.isServerConnected = true;
        updateSyncStatusUI(true);
      }
    } catch (e) {
      console.warn('Could not sync deletion with server:', e);
    } finally {
      state.isMutating = false;
      state.lastMutationTime = Date.now();
    }
  }

  // ==========================================================================
  // Reaction Vote Handling with Name Tracking
  // ==========================================================================
  async function handleReactionVote(recId, reactionType) {
    if (!state.userName) {
      openNamePromptModal();
      return;
    }

    const item = state.recommendations.find(r => r.id === recId);
    if (!item) return;

    if (!item.reactions) {
      item.reactions = { beg: [], hyped: [], loved: [], liked: [], disliked: [], hated: [] };
    }

    // Ensure all lists
    ['beg', 'hyped', 'loved', 'liked', 'disliked', 'hated'].forEach(k => {
      if (!Array.isArray(item.reactions[k])) item.reactions[k] = [];
    });

    const myName = state.userName.trim();
    const myNameLower = myName.toLowerCase();
    const alreadyInThis = item.reactions[reactionType].some(u => u.toLowerCase() === myNameLower);

    // Set mutation lock
    state.isMutating = true;
    state.lastMutationTime = Date.now();

    // Remove user from all reaction lists first
    ['beg', 'hyped', 'loved', 'liked', 'disliked', 'hated'].forEach(k => {
      item.reactions[k] = item.reactions[k].filter(u => u.toLowerCase() !== myNameLower);
    });

    // If wasn't already in this one, add them
    if (!alreadyInThis) {
      item.reactions[reactionType].push(myName);
      showToast(`You marked "${item.title}" as ${formatVerdict(reactionType)}!`);
    } else {
      showToast(`Removed your reaction for "${item.title}"`);
    }

    saveRecommendationsToStorage();
    renderFeed();

    // Sync to server (Netlify Functions or server.py)
    try {
      const resp = await fetch('/api/reactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: recId, reaction: reactionType, userName: myName })
      });
      if (resp.ok) {
        const resData = await resp.json();
        if (resData && resData.reactions) {
          const currentItem = state.recommendations.find(r => r.id === recId);
          if (currentItem) {
            currentItem.reactions = resData.reactions;
            saveRecommendationsToStorage();
          }
        }
        state.isServerConnected = true;
        updateSyncStatusUI(true);
      }
    } catch (e) {
      console.warn('Could not sync reaction with server:', e);
    } finally {
      state.isMutating = false;
      state.lastMutationTime = Date.now();
    }
  }

  function formatVerdict(v) {
    if (v === 'beg') return '"I beg you to watch this!" 🙏';
    if (v === 'hyped') return 'Hyped to watch 🔥';
    if (v === 'loved') return 'Loved it ❤️';
    if (v === 'liked') return 'Liked 👍';
    if (v === 'disliked') return "Didn't like 👎";
    if (v === 'hated') return 'Hate it 🤮';
    return v;
  }

  function updateFriendFilterDropdown() {
    const friends = new Set();
    state.recommendations.forEach(r => {
      if (r.recommendedBy) friends.add(r.recommendedBy);
      // Also collect friends who reacted!
      const rxns = r.reactions || {};
      ['beg', 'hyped', 'loved', 'liked', 'disliked', 'hated'].forEach(k => {
        if (Array.isArray(rxns[k])) {
          rxns[k].forEach(u => friends.add(u));
        }
      });
      // Also collect friends who commented!
      if (Array.isArray(r.comments)) {
        r.comments.forEach(c => {
          if (c.author) friends.add(c.author);
        });
      }
    });

    const currentVal = elements.friendSelectFilter.value;
    elements.friendSelectFilter.innerHTML = '<option value="all">Everyone</option>';

    friends.forEach(f => {
      const opt = document.createElement('option');
      opt.value = f.toLowerCase();
      opt.textContent = f;
      elements.friendSelectFilter.appendChild(opt);
    });

    elements.friendSelectFilter.value = currentVal;
  }

  // ==========================================================================
  // Add Movie Recommendation Flow
  // ==========================================================================
  function openAddRecModal() {
    if (!state.userName) {
      openNamePromptModal();
      return;
    }
    state.selectedMovieForRec = null;
    elements.recMovieSearchInput.value = '';
    elements.recPersonalNoteInput.value = '';
    if (elements.recSearchClearBtn) elements.recSearchClearBtn.classList.add('hidden');

    // Switch to search view initially
    if (elements.recSearchView) elements.recSearchView.classList.remove('hidden');
    if (elements.recDetailsView) elements.recDetailsView.classList.add('hidden');
    if (elements.recModalHeaderTitle) elements.recModalHeaderTitle.textContent = "Recommend a Movie";

    // Show curated popular suggestions immediately so selection area is rich & populated
    renderCuratedSuggestions();

    elements.addRecommendationModal.classList.remove('hidden');
    setTimeout(() => elements.recMovieSearchInput.focus(), 150);
  }

  function closeAddRecModal() {
    elements.addRecommendationModal.classList.add('hidden');
    if (elements.recSearchView) elements.recSearchView.classList.remove('hidden');
    if (elements.recDetailsView) elements.recDetailsView.classList.add('hidden');
  }

  function backToMovieSearch() {
    if (elements.recDetailsView) elements.recDetailsView.classList.add('hidden');
    if (elements.recSearchView) elements.recSearchView.classList.remove('hidden');
    if (elements.recModalHeaderTitle) elements.recModalHeaderTitle.textContent = "Recommend a Movie";
    setTimeout(() => elements.recMovieSearchInput.focus(), 100);
  }

  function renderCuratedSuggestions() {
    if (elements.recResultsHeaderLabel) {
      elements.recResultsHeaderLabel.innerHTML = '✨ Popular & Suggested Movies';
    }
    if (elements.recResultsCount) {
      elements.recResultsCount.textContent = 'Tap any to select';
    }
    renderRecAutocomplete(CURATED_MOVIES, true);
  }

  async function handleRecMovieSearch(query) {
    clearTimeout(state.searchDebounce);
    const q = query ? query.trim() : '';

    if (elements.recSearchClearBtn) {
      elements.recSearchClearBtn.classList.toggle('hidden', !q);
    }

    if (!q || q.length < 2) {
      renderCuratedSuggestions();
      return;
    }

    if (elements.recResultsHeaderLabel) {
      elements.recResultsHeaderLabel.textContent = `Searching for "${q}"...`;
    }
    if (elements.recResultsCount) {
      elements.recResultsCount.textContent = 'Loading...';
    }

    state.searchDebounce = setTimeout(async () => {
      const lowerQ = q.toLowerCase();

      // 1. Curated match
      const curated = CURATED_MOVIES.filter(m => 
        m.title.toLowerCase().includes(lowerQ) ||
        (m.director && m.director.toLowerCase().includes(lowerQ)) ||
        (m.genres && m.genres.some(g => g.toLowerCase().includes(lowerQ)))
      );

      // 2. Cinemeta search
      let apiItems = [];
      try {
        const resp = await fetch(`${API_BASE}/catalog/movie/top/search=${encodeURIComponent(q)}.json`);
        if (resp.ok) {
          const data = await resp.json();
          if (data.metas) {
            apiItems = data.metas.map(m => ({
              id: m.id,
              title: m.name,
              year: m.releaseInfo || m.year || '',
              imdbRating: m.imdbRating || '',
              genres: m.genres || [],
              director: Array.isArray(m.director) ? m.director.join(', ') : (m.director || ''),
              poster: formatPosterUrl(m.poster, m.id)
            }));
          }
        }
      } catch (e) {
        console.warn('Cinemeta search failed:', e);
      }

      const combined = [...curated];
      apiItems.forEach(item => {
        if (!combined.some(c => c.id === item.id)) combined.push(item);
      });

      if (elements.recResultsHeaderLabel) {
        elements.recResultsHeaderLabel.textContent = `Results for "${q}"`;
      }
      if (elements.recResultsCount) {
        elements.recResultsCount.textContent = `${combined.length} found`;
      }

      renderRecAutocomplete(combined.slice(0, 25), false);
    }, 200);
  }

  function renderRecAutocomplete(items, isSuggestions = false) {
    if (!items || items.length === 0) {
      elements.recAutocompleteDropdown.innerHTML = `
        <div class="rec-empty-results">
          <div class="rec-empty-icon">🎬</div>
          <h4>No movies found</h4>
          <p>Try searching with another keyword or pick from popular recommendations.</p>
          <button type="button" class="btn-primary-compact" id="recShowSuggestionsBtn" style="margin-top: 12px;">
            Show Popular Movies
          </button>
        </div>
      `;
      const btn = document.getElementById('recShowSuggestionsBtn');
      if (btn) {
        btn.addEventListener('click', () => {
          elements.recMovieSearchInput.value = '';
          if (elements.recSearchClearBtn) elements.recSearchClearBtn.classList.add('hidden');
          renderCuratedSuggestions();
        });
      }
      return;
    }

    const defaultPoster = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='150' viewBox='0 0 100 150'%3E%3Crect width='100' height='150' fill='%231e293b'/%3E%3Ctext x='50%25' y='50%25' text-anchor='middle' fill='%2364748b' font-size='12' dy='.3em'%3ENo Poster%3C/text%3E%3C/svg%3E";

    elements.recAutocompleteDropdown.innerHTML = items.map(m => {
      const posterSrc = m.poster || defaultPoster;
      const yearText = m.year ? `<span class="rec-item-year">${m.year}</span>` : '';
      const ratingText = m.imdbRating ? `<span class="rec-item-imdb">★ ${m.imdbRating}</span>` : '';
      const genreText = (m.genres && m.genres.length > 0) ? `<span class="rec-item-genre">${m.genres.slice(0, 2).join(' · ')}</span>` : '';
      const directorText = m.director ? `<span class="rec-item-director">Dir. ${m.director}</span>` : '';

      return `
        <div class="rec-movie-item" data-id="${m.id}" role="button" tabindex="0">
          <img class="rec-item-thumb" src="${posterSrc}" alt="${escapeHtml(m.title)}" loading="lazy" onerror="this.onerror=null;this.src='${defaultPoster}';">
          <div class="rec-item-info">
            <div class="rec-item-title">${escapeHtml(m.title)}</div>
            <div class="rec-item-meta">
              ${yearText}
              ${ratingText}
              ${genreText}
              ${directorText}
            </div>
          </div>
          <div class="rec-item-select-btn">
            <span>Select</span>
            <span class="select-arrow">➔</span>
          </div>
        </div>
      `;
    }).join('');

    elements.recAutocompleteDropdown.querySelectorAll('.rec-movie-item').forEach(el => {
      const selectHandler = () => {
        const id = el.dataset.id;
        selectMovieForRecommendation(id);
      };
      el.addEventListener('click', selectHandler);
      el.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          selectHandler();
        }
      });
    });
  }

  async function selectMovieForRecommendation(movieId) {
    let movie = CURATED_MOVIES.find(m => m.id === movieId);

    try {
      const resp = await fetch(`${API_BASE}/meta/movie/${movieId}.json`);
      if (resp.ok) {
        const data = await resp.json();
        if (data.meta) {
          const meta = data.meta;
          movie = {
            id: meta.id || movieId,
            title: meta.name || (movie ? movie.title : 'Movie'),
            year: meta.releaseInfo || meta.year || (movie ? movie.year : '2024'),
            imdbRating: meta.imdbRating || (movie ? movie.imdbRating : '7.8'),
            poster: formatPosterUrl(meta.poster, movieId) || (movie ? movie.poster : ''),
            director: Array.isArray(meta.director) ? meta.director.join(', ') : (meta.director || (movie ? movie.director : '')),
            genres: meta.genres || (movie ? movie.genres : []),
            synopsis: meta.description || (movie ? movie.synopsis : ''),
            trailerId: (meta.trailers && meta.trailers.length > 0 && meta.trailers[0].source) 
              ? meta.trailers[0].source 
              : (movie ? movie.trailerId : 'cdx31ak4KbQ')
          };
        }
      }
    } catch (e) {}

    if (!movie) {
      showToast('Could not load movie details.');
      return;
    }

    state.selectedMovieForRec = movie;

    elements.recPreviewPoster.src = movie.poster;
    elements.recPreviewTitle.textContent = movie.title;
    elements.recPreviewYear.textContent = movie.year || '';
    elements.recPreviewImdb.textContent = `★ ${movie.imdbRating || '7.8'} IMDb`;
    elements.recPreviewDirector.textContent = movie.director ? `Dir. ${movie.director}` : '';
    elements.recPreviewSynopsis.textContent = movie.synopsis || 'Plot synopsis ready.';

    if (elements.recPreviewWatchBtn) {
      elements.recPreviewWatchBtn.href = getWatchMovieUrl(movie);
      elements.recPreviewWatchBtn.title = `Watch ${movie.title} on Movy.sx`;
      elements.recPreviewWatchBtn.onclick = (e) => handleWatchMovieClick(e, movie, elements.recPreviewWatchBtn);
    }

    if (!movie.tmdbId) {
      resolveTmdbId(movie.id, movie.title, movie.year).then(tid => {
        if (tid) {
          movie.tmdbId = tid;
          if (elements.recPreviewWatchBtn) {
            elements.recPreviewWatchBtn.href = `https://www.movy.sx/movie/${tid}?play=true`;
          }
        }
      });
    }

    // Transition to Details Form View
    if (elements.recSearchView) elements.recSearchView.classList.add('hidden');
    if (elements.recDetailsView) elements.recDetailsView.classList.remove('hidden');
    if (elements.recModalHeaderTitle) elements.recModalHeaderTitle.textContent = `Recommend "${movie.title}"`;

    setTimeout(() => {
      if (elements.recPersonalNoteInput) elements.recPersonalNoteInput.focus();
    }, 100);
  }

  async function submitRecommendation() {
    if (!state.selectedMovieForRec) {
      showToast('Please search and select a movie first.');
      return;
    }

    const movie = state.selectedMovieForRec;

    // Ensure TMDB ID is resolved so the Watch Movie button is immediately linked for everyone
    let resolvedTmdbId = movie.tmdbId || getTmdbIdSync(movie.id, movie.title);
    if (!resolvedTmdbId) {
      try {
        resolvedTmdbId = await resolveTmdbId(movie.id, movie.title, movie.year);
      } catch (e) {}
    }
    if (resolvedTmdbId) {
      movie.tmdbId = resolvedTmdbId;
    }

    const note = elements.recPersonalNoteInput.value.trim();
    const verdict = document.querySelector('input[name="initialVerdict"]:checked')?.value || 'beg';
    const recId = `rec-${Date.now()}`;
    const myName = state.userName || 'Friend';

    const newRec = {
      id: recId,
      movieId: movie.id,
      tmdbId: resolvedTmdbId || null,
      title: movie.title,
      year: movie.year,
      imdbRating: movie.imdbRating,
      poster: movie.poster,
      genres: movie.genres,
      director: movie.director,
      synopsis: movie.synopsis,
      trailerId: movie.trailerId,
      recommendedBy: myName,
      note: note,
      timestamp: 'Just now',
      reactions: {
        beg: verdict === 'beg' ? [myName] : [],
        hyped: verdict === 'hyped' ? [myName] : [],
        loved: verdict === 'loved' ? [myName] : [],
        liked: verdict === 'liked' ? [myName] : [],
        disliked: [],
        hated: []
      },
      comments: []
    };

    // Set mutation lock
    state.isMutating = true;
    state.lastMutationTime = Date.now();

    // Prepend to recommendations
    state.recommendations.unshift(newRec);
    saveRecommendationsToStorage();

    // Send to server (Netlify Functions or server.py)
    try {
      const resp = await fetch('/api/recommendations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...newRec, initialVerdict: verdict })
      });
      if (resp.ok) {
        state.isServerConnected = true;
        updateSyncStatusUI(true);
      }
    } catch (e) {
      console.warn('Could not sync recommendation with server:', e);
    } finally {
      state.isMutating = false;
      state.lastMutationTime = Date.now();
    }

    closeAddRecModal();
    renderFeed();
    updateFriendFilterDropdown();

    showToast(`Recommended "${movie.title}"! 🍿`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // ==========================================================================
  // Secondary Feature: Similar Movies Modal
  // ==========================================================================
  async function openSimilarMoviesModal(movie) {
    elements.similarModalTitle.textContent = `Similar to "${movie.title}"`;
    elements.similarModalSubtitle.textContent = `Recommended based on ${movie.director ? `${movie.director}'s filmography, ` : ''}${(movie.genres || []).join(' & ')} themes, and high ratings.`;
    elements.similarMoviesGrid.innerHTML = `
      <div style="grid-column: 1 / -1; padding: 2rem; text-align: center; color: var(--text-dim);">
        Finding similar acclaimed movies...
      </div>
    `;

    elements.similarMoviesModal.classList.remove('hidden');

    const candidates = [];
    const movieGenres = movie.genres || [];

    CURATED_MOVIES.forEach(c => {
      if (c.id !== movie.movieId && c.title.toLowerCase() !== movie.title.toLowerCase()) {
        let score = 50;
        const sameDirector = c.director && movie.director && c.director.toLowerCase() === movie.director.toLowerCase();
        if (sameDirector) score += 40;

        const shared = (c.genres || []).filter(g => movieGenres.includes(g));
        score += shared.length * 15;

        const r = parseFloat(c.imdbRating) || 7.0;
        score += Math.round(r * 4);

        const matchPct = Math.min(99, Math.max(78, Math.round((score / 140) * 100)));

        candidates.push({
          ...c,
          matchPct,
          sharedCount: shared.length
        });
      }
    });

    candidates.sort((a, b) => b.matchPct - a.matchPct);
    const topPicks = candidates.slice(0, 8);

    elements.similarMoviesGrid.innerHTML = topPicks.map(m => `
      <div class="similar-card" data-id="${m.id}">
        <div class="similar-poster-wrap">
          <img class="similar-poster" src="${m.poster}" alt="${escapeHtml(m.title)}" loading="lazy">
          <span class="similar-match-pill">${m.matchPct}% Match</span>
        </div>
        <div class="similar-content">
          <h4 class="similar-title">${escapeHtml(m.title)}</h4>
          <div class="similar-meta">
            <span>${m.year}</span>
            <span style="color:var(--accent-imdb);font-weight:700;">★ ${m.imdbRating}</span>
          </div>
        </div>
      </div>
    `).join('');

    elements.similarMoviesGrid.querySelectorAll('.similar-card').forEach(card => {
      card.addEventListener('click', () => {
        const id = card.dataset.id;
        const pick = CURATED_MOVIES.find(x => x.id === id);
        if (pick) {
          elements.closeSimilarBtn.click();
          openAddRecModal();
          selectMovieForRecommendation(pick.id);
        }
      });
    });
  }

  // ==========================================================================
  // Trailer Modal
  // ==========================================================================
  function openTrailerModal(item) {
    const trailerId = item.trailerId || 'cdx31ak4KbQ';
    elements.trailerModalTitle.textContent = `${item.title} (${item.year}) — Official Trailer`;
    elements.trailerIframe.src = `https://www.youtube-nocookie.com/embed/${trailerId}?autoplay=1&rel=0`;

    if (elements.trailerWatchMovieBtn) {
      elements.trailerWatchMovieBtn.href = getWatchMovieUrl(item);
      elements.trailerWatchMovieBtn.title = `Watch ${item.title} on Movy.sx`;
      elements.trailerWatchMovieBtn.onclick = (e) => handleWatchMovieClick(e, item, elements.trailerWatchMovieBtn);
    }

    elements.trailerModal.classList.remove('hidden');
  }

  function closeTrailerModal() {
    elements.trailerModal.classList.add('hidden');
    elements.trailerIframe.src = '';
  }

  // ==========================================================================
  // Share Modal
  // ==========================================================================
  function openShareModal() {
    const shareUrl = window.location.origin + window.location.pathname;
    elements.shareLinkInput.value = shareUrl;

    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(shareUrl)}&margin=10`;
    elements.shareQrCodeImg.src = qrUrl;

    elements.shareModal.classList.remove('hidden');
  }

  function openShareModalForMovie(item) {
    const shareUrl = `${window.location.origin}${window.location.pathname}?q=${encodeURIComponent(item.title)}`;
    elements.shareLinkInput.value = shareUrl;

    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(shareUrl)}&margin=10`;
    elements.shareQrCodeImg.src = qrUrl;

    elements.shareModal.classList.remove('hidden');
  }

  function closeShareModal() {
    elements.shareModal.classList.add('hidden');
  }

  function copyShareLink() {
    const url = elements.shareLinkInput.value;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url);
    } else {
      const inp = document.createElement('input');
      inp.value = url;
      document.body.appendChild(inp);
      inp.select();
      document.execCommand('copy');
      document.body.removeChild(inp);
    }
    showToast('Feed link copied to clipboard! Paste it to your friends.');
  }

  function triggerNativeShare() {
    const shareUrl = elements.shareLinkInput.value;
    const text = `🍿 Check out our friends' movie recommendations and see who loved/liked what on CineMatch!`;
    if (navigator.share) {
      navigator.share({ title: "CineMatch — Friends' Movies", text, url: shareUrl }).catch(() => {});
    } else {
      copyShareLink();
    }
  }

  // ==========================================================================
  // Event Listeners Setup
  // ==========================================================================
  function setupEventListeners() {
    function updateFilterBadge() {
      const hasFilter = (state.activeFilterFriend && state.activeFilterFriend !== 'all') ||
                        (state.activeSort && state.activeSort !== 'newest') ||
                        (state.sentimentFilter && state.sentimentFilter !== 'all');
      if (elements.filterActiveBadge) {
        elements.filterActiveBadge.classList.toggle('hidden', !hasFilter);
      }
      if (elements.filterToggleBtn && elements.filterExpandPanel) {
        const isPanelOpen = !elements.filterExpandPanel.classList.contains('hidden');
        elements.filterToggleBtn.classList.toggle('active', hasFilter || isPanelOpen);
      }
    }

    elements.brandHomeBtn.addEventListener('click', () => {
      elements.feedFilterInput.value = '';
      state.searchQuery = '';
      if (elements.searchClearBtn) elements.searchClearBtn.classList.add('hidden');
      if (elements.searchExpandPanel) elements.searchExpandPanel.classList.add('hidden');
      if (elements.searchToggleBtn) {
        elements.searchToggleBtn.classList.remove('active');
        elements.searchToggleBtn.setAttribute('aria-expanded', 'false');
      }
      if (elements.filterExpandPanel) elements.filterExpandPanel.classList.add('hidden');
      elements.friendSelectFilter.value = 'all';
      state.activeFilterFriend = 'all';
      elements.sortSelectFilter.value = 'newest';
      state.activeSort = 'newest';
      state.sentimentFilter = 'all';
      if (elements.sentimentFilterBar) {
        elements.sentimentFilterBar.querySelectorAll('.sentiment-tab-btn').forEach(b => {
          b.classList.toggle('active', b.dataset.sentiment === 'all');
          b.setAttribute('aria-selected', b.dataset.sentiment === 'all' ? 'true' : 'false');
        });
      }
      updateFilterBadge();
      renderFeed();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    // View Mode Toggle (Cards vs Compact)
    if (elements.viewCardsBtn && elements.viewCompactBtn) {
      elements.viewCardsBtn.addEventListener('click', () => {
        state.viewMode = 'cards';
        elements.viewCardsBtn.classList.add('active');
        elements.viewCardsBtn.setAttribute('aria-selected', 'true');
        elements.viewCompactBtn.classList.remove('active');
        elements.viewCompactBtn.setAttribute('aria-selected', 'false');
        renderFeed();
      });

      elements.viewCompactBtn.addEventListener('click', () => {
        state.viewMode = 'compact';
        elements.viewCompactBtn.classList.add('active');
        elements.viewCompactBtn.setAttribute('aria-selected', 'true');
        elements.viewCardsBtn.classList.remove('active');
        elements.viewCardsBtn.setAttribute('aria-selected', 'false');
        renderFeed();
      });
    }

    // Sentiment Filter Tabs (All / Most Loved / Most Hated / Begged)
    if (elements.sentimentFilterBar) {
      elements.sentimentFilterBar.querySelectorAll('.sentiment-tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          elements.sentimentFilterBar.querySelectorAll('.sentiment-tab-btn').forEach(b => {
            b.classList.remove('active');
            b.setAttribute('aria-selected', 'false');
          });
          btn.classList.add('active');
          btn.setAttribute('aria-selected', 'true');
          state.sentimentFilter = btn.dataset.sentiment || 'all';
          updateFilterBadge();
          renderFeed();
        });
      });
    }

    // Search Toggle Button (Expand/Collapse on tap)
    if (elements.searchToggleBtn && elements.searchExpandPanel) {
      elements.searchToggleBtn.addEventListener('click', () => {
        const isHidden = elements.searchExpandPanel.classList.contains('hidden');
        if (isHidden) {
          elements.searchExpandPanel.classList.remove('hidden');
          elements.searchToggleBtn.classList.add('active');
          elements.searchToggleBtn.setAttribute('aria-expanded', 'true');
          elements.feedFilterInput.focus();
        } else {
          if (!state.searchQuery) {
            elements.searchExpandPanel.classList.add('hidden');
            elements.searchToggleBtn.classList.remove('active');
            elements.searchToggleBtn.setAttribute('aria-expanded', 'false');
          } else {
            elements.feedFilterInput.focus();
          }
        }
      });
    }

    // Search Clear Button
    if (elements.searchClearBtn) {
      elements.searchClearBtn.addEventListener('click', () => {
        elements.feedFilterInput.value = '';
        state.searchQuery = '';
        elements.searchClearBtn.classList.add('hidden');
        elements.searchExpandPanel.classList.add('hidden');
        if (elements.searchToggleBtn) {
          elements.searchToggleBtn.classList.remove('active');
          elements.searchToggleBtn.setAttribute('aria-expanded', 'false');
        }
        renderFeed();
      });
    }

    // Filter Toggle Button (Expand/Collapse on tap)
    if (elements.filterToggleBtn && elements.filterExpandPanel) {
      elements.filterToggleBtn.addEventListener('click', () => {
        const isHidden = elements.filterExpandPanel.classList.contains('hidden');
        elements.filterExpandPanel.classList.toggle('hidden');
        elements.filterToggleBtn.setAttribute('aria-expanded', isHidden ? 'true' : 'false');
        updateFilterBadge();
      });
    }

    if (elements.themeToggleBtn) {
      elements.themeToggleBtn.addEventListener('click', toggleTheme);
    }

    if (elements.feedSyncBtn) {
      elements.feedSyncBtn.addEventListener('click', async () => {
        showToast('Refreshing recommendations from friends... 🍿');
        await loadRecommendations(false);
        showToast(state.isServerConnected ? 'Sync complete! ✨' : 'Could not reach server. Using offline data.');
      });
    }

    elements.userProfileBtn.addEventListener('click', promptChangeName);
    elements.namePromptForm.addEventListener('submit', handleNamePromptSubmit);

    if (elements.heroAddRecommendBtn) {
      elements.heroAddRecommendBtn.addEventListener('click', openAddRecModal);
    }
    if (elements.emptyStateRecommendBtn) {
      elements.emptyStateRecommendBtn.addEventListener('click', openAddRecModal);
    }
    elements.closeAddRecBtn.addEventListener('click', closeAddRecModal);

    if (elements.recSearchClearBtn) {
      elements.recSearchClearBtn.addEventListener('click', () => {
        elements.recMovieSearchInput.value = '';
        elements.recSearchClearBtn.classList.add('hidden');
        renderCuratedSuggestions();
        elements.recMovieSearchInput.focus();
      });
    }

    if (elements.recChangeMovieBtn) {
      elements.recChangeMovieBtn.addEventListener('click', backToMovieSearch);
    }

    elements.recMovieSearchInput.addEventListener('input', (e) => {
      handleRecMovieSearch(e.target.value);
    });

    elements.submitRecommendationBtn.addEventListener('click', submitRecommendation);

    elements.feedFilterInput.addEventListener('input', (e) => {
      state.searchQuery = e.target.value.trim();
      if (elements.searchClearBtn) {
        elements.searchClearBtn.classList.toggle('hidden', !state.searchQuery);
      }
      if (elements.searchToggleBtn) {
        elements.searchToggleBtn.classList.add('active');
      }
      renderFeed();
    });

    elements.friendSelectFilter.addEventListener('change', (e) => {
      state.activeFilterFriend = e.target.value;
      updateFilterBadge();
      renderFeed();
    });

    elements.sortSelectFilter.addEventListener('change', (e) => {
      state.activeSort = e.target.value;
      updateFilterBadge();
      renderFeed();
    });

    elements.closeSimilarBtn.addEventListener('click', () => elements.similarMoviesModal.classList.add('hidden'));
    elements.similarMoviesModal.addEventListener('click', (e) => {
      if (e.target === elements.similarMoviesModal) elements.similarMoviesModal.classList.add('hidden');
    });

    elements.closeTrailerBtn.addEventListener('click', closeTrailerModal);
    elements.trailerModal.addEventListener('click', (e) => {
      if (e.target === elements.trailerModal) closeTrailerModal();
    });

    if (elements.shareAppHeaderBtn) {
      elements.shareAppHeaderBtn.addEventListener('click', openShareModal);
    }
    elements.closeShareBtn.addEventListener('click', closeShareModal);
    elements.shareModal.addEventListener('click', (e) => {
      if (e.target === elements.shareModal) closeShareModal();
    });
    elements.copyShareLinkBtn.addEventListener('click', copyShareLink);
    elements.nativeShareBtn.addEventListener('click', triggerNativeShare);

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeAddRecModal();
        closeTrailerModal();
        closeShareModal();
        elements.similarMoviesModal.classList.add('hidden');
      }
    });
  }

  function formatPosterUrl(poster, id) {
    if (poster && poster.startsWith('http')) return poster;
    if (id && id.startsWith('tt')) return `https://images.metahub.space/poster/small/${id}/img`;
    return '';
  }

  function showToast(msg) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `<span>${escapeHtml(msg)}</span>`;
    elements.toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('toast-leave');
      setTimeout(() => {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
      }, 200);
    }, 2800);
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
