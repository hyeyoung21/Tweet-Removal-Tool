/**
 * TweetRemovalTool — v1.0
 *
 * A user-assisted, browser-based utility for reviewing and managing
 * posts from the currently authenticated Twitter/X account.
 *
 * ARCHITECTURE OVERVIEW
 * - Operates entirely within the active browser session (no external services).
 * - Adds a sidebar interface for review, selection, and execution.
 * - Encapsulated within an IIFE to maintain local scope and prevent duplicate instances.
 *
 * TECHNICAL APPROACH
 * - Reads active GraphQL operation IDs and endpoints from JavaScript bundles
 *   already loaded by the official web client.
 * - Reuses the existing authentication context (cookies, headers) present
 *   in the browser session; no credentials are collected or stored.
 * - Retrieves tweet data via the same internal endpoints utilised by the
 *   platform's own web interface.
 *
 * SAFETY & USER CONTROL
 * - All actions are explicitly initiated by the user via clearly visible UI controls.
 * - Items are stored locally in memory for review prior to action.
 * - Destructive operations require manual confirmation from the user.
 * - Does not modify, intercept, or override Twitter/X client behaviour.
 */


// This tool operates as an interactive browser extension requiring manual user input.
// It adds a sidebar UI element to the page but does not modify, intercept, or override
// Twitter/X's client-side code. It only issues the same network requests that the official
// web interface issues in response to user actions.

(function() {
    // Prevent multiple instances of the sidebar from being added
    if (document.getElementById('trt-sidebar')) return;

    // UI Definition: Contains the CSS and HTML structure for the sidebar
    const HTML_TEMPLATE = `
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');
        #trt-sidebar { position: fixed; top: 0; right: 0; width: 450px; height: 100vh; background: rgba(0,0,0,0.95); color: #fff; z-index: 999999; font-family: Inter, -apple-system, sans-serif; display: flex; flex-direction: column; border-left: 1px solid #333; backdrop-filter: blur(15px); box-shadow: -10px 0 30px rgba(0,0,0,0.8); }
        .trt-header { padding: 24px; border-bottom: 1px solid #2f3336; }
        .trt-title-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; }
        .trt-title { font-size: 16px; font-weight: 700; letter-spacing: 0.5px; color: #1d9bf0; text-transform: uppercase; }
        #trt-status { font-size: 12px; color: #71767b; font-family: ui-monospace, monospace; }
        .trt-close { background: #202327; border: none; color: #fff; width: 32px; height: 32px; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: 0.2s; }
        .trt-close:hover { background: #f4212e; }
        .trt-content { flex: 1; overflow-y: auto; padding: 0; scrollbar-width: thin; scrollbar-color: #333 transparent; }
        .trt-content-inner { padding: 0 16px; }
        .trt-stats-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; margin: 16px 0; }
        .trt-stat-card { background: rgba(22,24,28,0.8); border: 1px solid #2f3336; padding: 12px 4px; border-radius: 12px; text-align: center; }
        .trt-stat-val { display: block; font-size: 18px; font-weight: 700; }
        .trt-stat-lbl { display: block; font-size: 9px; color: #71767b; text-transform: uppercase; margin-top: 2px; }
        .trt-sticky-controls { position: sticky; top: 0; background: rgba(0,0,0,0.9); z-index: 10; padding: 16px 0; backdrop-filter: blur(8px); border-bottom: 1px solid #2f3336; margin-bottom: 16px; }
        .trt-input-group { margin: 16px 0; }
        .trt-label { display: block; font-size: 12px; font-weight: 600; margin-bottom: 8px; color: #71767b; }
        .trt-input { width: 100%; padding: 12px; background: #16181c; border: 1px solid #2f3336; border-radius: 8px; color: #fff; font-size: 14px; box-sizing: border-box; }
        .trt-btn { width: 100%; padding: 12px; border: none; border-radius: 99px; font-weight: 700; font-size: 13px; cursor: pointer; transition: 0.2s; display: flex; align-items: center; justify-content: center; gap: 6px; }
        .trt-btn-blue { background: #1d9bf0; color: #fff; }
        .trt-btn-red { background: #f4212e; color: #fff; }
        .trt-btn-purge { background: #7a0912; color: #fff; margin-top: 8px; border: 1px solid #f4212e; }
        .trt-btn-stop { background: #ffd400; color: #000; margin-top: 8px; }
        .trt-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .trt-btn-outline { background: transparent; border: 1px solid #536471; color: #fff; font-size: 11px; padding: 8px; }
        #trt-list-items { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; padding-bottom: 20px; }
        .trt-card { background: #16181c; border: 1px solid #2f3336; border-radius: 12px; padding: 12px; display: flex; flex-direction: column; justify-content: space-between; min-height: 160px; transition: 0.2s; }
        .trt-card:hover { border-color: #444; background: #1c1f23; }
        .trt-card-meta { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
        .trt-id-badge { font-size: 9px; color: #fff; font-family: ui-monospace, monospace; background: #000; padding: 4px 8px; border-radius: 4px; border: 1px solid #333; letter-spacing: 0.5px; }
        .trt-checkbox { width: 18px; height: 18px; cursor: pointer; accent-color: #1d9bf0; }
        .trt-card-date-container { margin-bottom: 8px; }
        .trt-card-date { font-size: 11px; color: #1d9bf0; font-weight: 700; }
        .trt-card-time { font-size: 10px; color: #71767b; font-weight: 400; display: block; margin-top: 1px; }
        .trt-card-body { line-height: 1.4; font-size: 12px; color: #e7e9ea; display: -webkit-box; -webkit-line-clamp: 4; -webkit-box-orient: vertical; overflow: hidden; word-break: break-word; margin-bottom: 10px; }
        .trt-view-btn { font-size: 10px; background: #2f3336; color: #fff; border: none; border-radius: 4px; padding: 4px 8px; cursor: pointer; text-decoration: none; display: inline-block; text-align: center; font-weight: 600; transition: 0.2s; align-self: flex-start; }
        .trt-footer { padding: 20px; border-top: 1px solid #2f3336; background: #000; }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
        .trt-pulse { color: #1d9bf0; animation: pulse 2s infinite; font-weight: bold; }
        .trt-error-text { color: #f4212e; font-weight: bold; }
    </style>
    <div class="trt-header">
        <div class="trt-title-row">
            <div class="trt-title">Tweet Removal Tool</div>
            <button class="trt-close" id="trt-close-btn">&times;</button>
        </div>
        <div id="trt-status">System Standby</div>
    </div>
    <div class="trt-content">
        <div class="trt-content-inner">
            <!-- Setup View: Account Identification -->
            <div id="trt-setup-ui">
                <div class="trt-input-group">
                    <span class="trt-label">Account Handle</span>
                    <input type="text" id="trt-handle" class="trt-input" placeholder="Scanning..." readonly>
                </div>
                <div class="trt-input-group">
                    <span class="trt-label">Account UID</span>
                    <input type="text" id="trt-uid" class="trt-input" placeholder="Scanning..." readonly>
                </div>
                <button class="trt-btn trt-btn-blue" id="trt-init-btn">Initialise Search</button>
            </div>
            <!-- List View: Displaying Retrieved Tweets -->
            <div id="trt-list-ui" style="display:none;">
                <div class="trt-sticky-controls">
                    <div class="trt-stats-grid">
                        <div class="trt-stat-card"><span class="trt-stat-val" id="trt-current-count">0</span><span class="trt-stat-lbl">Found</span></div>
                        <div class="trt-stat-card"><span class="trt-stat-val" id="trt-count">0</span><span class="trt-stat-lbl">Selected</span></div>
                        <div class="trt-stat-card"><span class="trt-stat-val" id="trt-deleted-count">0</span><span class="trt-stat-lbl">Deleted</span></div>
                    </div>
                    <div style="display:flex; gap:6px; margin-top:8px; justify-content:center;">
                        <button class="trt-btn trt-btn-outline" id="trt-select-all-btn">Select All</button>
                        <button class="trt-btn trt-btn-outline" id="trt-load-more">Load More</button>
                        <button class="trt-btn trt-btn-outline" id="trt-screen-btn" title="Collect your tweets currently visible on the X page">From Screen</button>
                        <button class="trt-btn trt-btn-outline" id="trt-top-btn">↑ Top</button>
                    </div>
                </div>
                <div id="trt-list-items"></div>
            </div>
        </div>
    </div>
    <!-- Footer: Batch Actions -->
    <div class="trt-footer" id="trt-actions" style="display:none;">
        <button class="trt-btn trt-btn-red" id="trt-delete-btn">Delete Selected Items</button>
        <div style="display:flex; gap:6px;">
            <button class="trt-btn trt-btn-purge" id="trt-purge-api-btn">🔁 API Auto Delete</button>
            <button class="trt-btn trt-btn-purge" id="trt-purge-screen-btn">🖥 Screen Auto Delete</button>
        </div>
    </div>
    `;

    /**
     * GraphQLEndpointResolution 
     * Reads X.com's loaded JavaScript bundles to find the active GraphQL query IDs
     * and the Bearer token already present in the authenticated session.
     */
    class GraphQLEndpointResolution {
        constructor() {
            this.registry = new Map();
            this.bearer = null;
            this.patterns = {
                // Regex to find the hardcoded Bearer token in X's source code
                bearer: /"Bearer\s([a-zA-Z0-9%._-]+)"/,
                // Regex to find GraphQL operation definitions (ID + Name)
                operation: /queryId:"([a-zA-Z0-9_-]+)",operationName:"([a-zA-Z0-9_-]+)"/g
            };
        }

        /**
         * Orchestrates the resolution process by reading inline and external scripts
         * already loaded by the official web client.
         */
        async discover() {
            const scripts = Array.from(document.querySelectorAll('script'));
            const external = scripts.filter(s => s.src).map(s => s.src);
            const inline = scripts.filter(s => !s.src).map(s => s.textContent);

            // Scan inline scripts first (faster)
            inline.forEach(text => this.scanText(text));

            // Prioritise the 'main' bundle where endpoints are usually defined
            const sortedExternal = external.sort((a, b) => a.includes('main.') ? -1 : 0);

            for (const url of sortedExternal) {
                // Exit early if we found our key endpoints and token
                if (this.registry.has('DeleteTweet') && this.registry.has('UserTweets') && this.bearer) break;
                try {
                    const response = await fetch(url);
                    const text = await response.text();
                    this.scanText(text);
                } catch (e) { /* Silent fail for cross-origin or network issues */ }
            }
            return { bearer: this.bearer, endpoints: Object.fromEntries(this.registry) };
        }

        /**
         * Reads a string of code for Bearer tokens and GraphQL operations
         * already present in the loaded JavaScript.
         */
        scanText(text) {
            if (!this.bearer) {
                const bMatch = text.match(this.patterns.bearer);
                if (bMatch) this.bearer = `Bearer ${bMatch[1]}`;
            }
            let match;
            this.patterns.operation.lastIndex = 0; // Reset regex state
            while ((match = this.patterns.operation.exec(text)) !== null) {
                this.registry.set(match[2], {
                    queryId: match[1],
                    endpoint: `/i/api/graphql/${match[1]}/${match[2]}`
                });
            }
        }
    }

    /**
     * TweetRemovalTool
     * Main controller class for UI management, API interaction, and state.
     */
    class TweetRemovalTool {
        constructor() {
            this.discovery = new GraphQLEndpointResolution();
            const identity = this.resolveIdentity();
            
            // Authentication state extracted from current session
            this.auth = {
                bearer: null,
                // Reuse CSRF token from cookies (required for POST requests)
                csrf: document.cookie.match(/ct0=([^;]+)/)?.[1],
                uid: identity.uid,
                handle: identity.handle,
                endpoints: {}
            };

            // Standard feature flags used by the X web client for GraphQL queries
            this.apiConfig = {
                features: {"rweb_video_screen_enabled":false,"profile_label_improvements_pcf_label_in_post_enabled":true,"responsive_web_profile_redirect_enabled":false,"rweb_tipjar_consumption_enabled":true,"verified_phone_label_enabled":false,"creator_subscriptions_tweet_preview_api_enabled":true,"responsive_web_graphql_timeline_navigation_enabled":true,"responsive_web_graphql_skip_user_profile_image_extensions_enabled":false,"premium_content_api_read_enabled":false,"communities_web_enable_tweet_community_results_fetch":true,"c9s_tweet_anatomy_moderator_badge_enabled":true,"responsive_web_grok_analyze_button_fetch_trends_enabled":false,"responsive_web_grok_analyze_post_followups_enabled":true,"responsive_web_jetfuel_frame":true,"responsive_web_grok_share_attachment_enabled":true,"responsive_web_grok_annotations_enabled":false,"articles_preview_enabled":true,"responsive_web_edit_tweet_api_enabled":true,"graphql_is_translatable_rweb_tweet_is_translatable_enabled":true,"view_counts_everywhere_api_enabled":true,"longform_notetweets_consumption_enabled":true,"responsive_web_twitter_article_tweet_consumption_enabled":true,"tweet_awards_web_tipping_enabled":false,"responsive_web_grok_show_grok_translated_post":false,"responsive_web_grok_analysis_button_from_backend":true,"post_ctas_fetch_enabled":true,"creator_subscriptions_quote_tweet_preview_enabled":false,"freedom_of_speech_not_reach_fetch_enabled":true,"standardized_nudges_misinfo":true,"tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled":true,"longform_notetweets_rich_text_read_enabled":true,"longform_notetweets_inline_media_enabled":true,"responsive_web_grok_image_annotation_enabled":true,"responsive_web_grok_imagine_annotation_enabled":true,"responsive_web_grok_community_note_auto_translation_is_enabled":false,"responsive_web_enhance_cards_enabled":false},
                fieldToggles: {"withArticlePlainText":false}
            };

            // Application state
            this.state = { 
                vault: new Map(),     // Retrieved tweets (ID -> Data)
                queue: new Set(),     // IDs selected for deletion
                deleted: new Set(),   // IDs successfully deleted
                isFetching: false,    // Guard against concurrent fetch calls
                isPurging: false,     // Auto "delete until 0" mode running
                stopRequested: false, // User pressed Stop during auto mode
                nextCursor: null,     // Bottom cursor of the last loaded page
                lastLoadResponse: null
            };
        }

        /**
         * Attempts to find the current user's ID and handle from Cookies 
         * and the internal Redux/Initial state window object.
         */
        resolveIdentity() {
            let uid = document.cookie.match(/twid=u%3D(\d+)/)?.[1];
            let handle = "Unknown";
            try {
                // Check X's internal state object first
                if (window.__INITIAL_STATE__?.session?.user_id === uid) {
                    const entities = window.__INITIAL_STATE__.entities?.users?.entities;
                    if (entities && entities[uid]) {
                        handle = entities[uid].screen_name;
                    }
                }
                // Fallback: Scrape from the UI sidebar profile link
                if (handle === "Unknown") {
                    const profileLink = document.querySelector('a[data-testid="AppTabBar_Profile_Link"]');
                    if (profileLink) {
                        handle = profileLink.getAttribute('href').replace('/', '');
                    }
                }
            } catch (e) { console.warn("TRT Identity Resolve Error:", e); }
            return { uid, handle };
        }

        escape(str) {
            return String(str).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
        }

        // Helper for DOM access
        get(id) { return document.getElementById(id); }

        /**
         * Bootstraps the tool: Builds UI and begins endpoint resolution.
         */
        async start() {
            this.buildUI();
            this.log("Analysing Registry...");
            const disc = await this.discovery.discover();
            this.auth.bearer = disc.bearer;
            this.auth.endpoints = disc.endpoints;

            if (this.auth.bearer && this.auth.endpoints['UserTweets'] && this.auth.endpoints['DeleteTweet']) {
                this.log("Security Verified");
                this.get('trt-uid').value = this.auth.uid || "Not Detected";
                this.get('trt-handle').value = this.auth.handle !== "Unknown" ? `@${this.auth.handle}` : "Unknown (Using UID)";
            } else {
                this.log("<span class='trt-error-text'>Registry Error: Incomplete Discovery</span>");
            }
        }

        /**
         * Clears all local data and UI items.
         */
        flushState() {
            this.state.vault.clear();
            this.state.queue.clear();
            this.state.deleted.clear();
            const itemsList = this.get('trt-list-items');
            if (itemsList) itemsList.innerHTML = '';
        }

        /**
         * Inserts the HTML template into the DOM and binds event listeners.
         */
        buildUI() {
            const panel = document.createElement('div');
            panel.id = 'trt-sidebar';
            panel.innerHTML = HTML_TEMPLATE;
            document.body.appendChild(panel);

            // Button bindings
            this.get('trt-init-btn').onclick = () => this.fetchTweets();
            this.get('trt-load-more').onclick = () => { this.flushState(); this.fetchTweets(); };
            this.get('trt-delete-btn').onclick = () => this.executeDeletion();
            this.get('trt-purge-api-btn').onclick = () => this.purgeAll('api');
            this.get('trt-purge-screen-btn').onclick = () => this.purgeAll('screen');
            this.get('trt-close-btn').onclick = () => { this.flushState(); panel.remove(); };
            this.get('trt-select-all-btn').onclick = () => this.toggleSelectAll();
            this.get('trt-screen-btn').onclick = async () => {
                this.get('trt-screen-btn').disabled = true;
                try { await this.scanScreen(true); } finally { this.get('trt-screen-btn').disabled = this.state.isPurging; }
            };
            this.get('trt-top-btn').onclick = () => {
                const container = document.querySelector('.trt-content');
                if (container) container.scrollTo({ top: 0, behavior: 'smooth' });
            };
        }

        /**
         * Updates the status text in the header.
         */
        log(msg) {
            const el = this.get('trt-status');
            if (el) el.innerHTML = msg.includes("ing") ? `<span class="trt-pulse">●</span> ${msg}` : msg;
        }

        /**
         * Fetches user tweets using the resolved GraphQL endpoint.
         */
        /**
         * Fetches user tweets using the resolved GraphQL endpoint.
         * X often returns a nearly-empty first page (only cursors, or only
         * tombstones of recently deleted tweets) even though older tweets exist.
         * So if a page yields nothing, follow the bottom cursor a few pages deeper.
         */
        async fetchTweets(maxPages = 15) {
            if (this.state.isFetching || !this.auth.bearer || !this.auth.uid) return false;
            this.state.isFetching = true;
            this.log(`Scanning API for @${this.auth.handle}...`);

            let cursor = null;
            try {
                for (let page = 1; page <= maxPages; page++) {
                    const res = await this.fetchPage(cursor);
                    if (res !== true) return res; // false or 'ratelimited'

                    if (this.state.vault.size > 0) break;          // got something → done
                    const next = this.state.nextCursor;
                    if (!next || next === cursor) break;          // reached the end
                    cursor = next;
                    this.log(`Page ${page} empty — checking older page...`);
                    await this.sleep(800);
                }
                this.log(this.state.vault.size ? "Scan Complete" : "Scan Complete — 0 found (see console)");
                return true;
            } finally {
                this.state.isFetching = false;
            }
        }

        /**
         * Fetches one page of UserTweets. Returns true / false / 'ratelimited'.
         */
        async fetchPage(cursor) {
            const variables = { 
                userId: this.auth.uid, 
                count: 40, 
                includePromotedContent: true, 
                withQuickPromoteEligibilityTweetFields: true, 
                withVoice: true 
            };
            if (cursor) variables.cursor = cursor;

            const target = this.auth.endpoints['UserTweets'];
            const url = `https://x.com${target.endpoint}?variables=${encodeURIComponent(JSON.stringify(variables))}&features=${encodeURIComponent(JSON.stringify(this.apiConfig.features))}&fieldToggles=${encodeURIComponent(JSON.stringify(this.apiConfig.fieldToggles))}`;

            try {
                const r = await fetch(url, { 
                    headers: { 
                        "authorization": this.auth.bearer, 
                        "x-csrf-token": this.auth.csrf, 
                        "x-twitter-active-user": "yes" 
                    }
                });
                const remaining = r.headers.get('x-rate-limit-remaining');
                const reset = Number(r.headers.get('x-rate-limit-reset'));
                if (remaining !== null) {
                    console.log(`[TRT] UserTweets rate limit: ${remaining} left, resets ${reset ? new Date(reset * 1000).toLocaleTimeString() : '?'}`);
                }
                if (r.status === 429) {
                    this.state.lastLoadResponse = r;
                    this.log("<span class='trt-error-text'>Rate Limited (Load)</span>");
                    return 'ratelimited';
                }
                if (!r.ok) {
                    const body = await r.text().catch(() => '');
                    console.error(`[TRT] UserTweets HTTP ${r.status}`, body);
                    this.log(`<span class='trt-error-text'>Fetch Failed: HTTP ${r.status} (see console)</span>`);
                    return false;
                }
                const data = await r.json();
                console.log('[TRT] raw response:', data); // inspect here in DevTools
                if (data.errors?.length) console.warn('[TRT] GraphQL errors:', data.errors);
                this.parseResponse(data);
                return true;
            } catch (e) { 
                console.error('[TRT] Fetch error:', e);
                this.log("<span class='trt-error-text'>Fetch Failed (see console)</span>"); 
                return false;
            }
        }

        /**
         * Deeply walks the nested GraphQL response object to find tweet results.
         * GraphQL responses for timelines are deeply nested and vary in structure.
         */
        parseResponse(obj) {
            let seen = 0;
            const extract = (result) => {
                if (!result) return;
                // Restricted/limited tweets wrap the real tweet one level deeper
                if (result.__typename === 'TweetWithVisibilityResults' && result.tweet) result = result.tweet;
                const legacy = result.legacy;
                if (!legacy) return; // TweetTombstone, TweetUnavailable, etc.
                seen++;

                const userId = legacy.user_id_str || result.core?.user_results?.result?.rest_id;
                const tweetId = result.rest_id || legacy.id_str;
                // Long posts (Premium) keep the full text in note_tweet
                const text = result.note_tweet?.note_tweet_results?.result?.text || legacy.full_text || '';

                // Verify ownership: only add if the tweet belongs to the authenticated user
                if (tweetId && String(userId) === String(this.auth.uid)) {
                    this.state.vault.set(tweetId, {
                        id: tweetId,
                        text,
                        date: legacy.created_at,
                        timestamp: legacy.created_at ? new Date(legacy.created_at).getTime() : 0
                    });
                }
            };

            this.state.nextCursor = null;
            const walker = (o) => {
                if (!o || typeof o !== 'object') return;
                if (o.cursorType === 'Bottom' && o.value) {
                    this.state.nextCursor = o.value;
                    return;
                }
                // Covers both normal entries (entry.content.itemContent)
                // and thread/conversation modules (entry.content.items[].item.itemContent)
                if (o.itemContent?.tweet_results) {
                    extract(o.itemContent.tweet_results.result);
                    return;
                }
                Object.keys(o).forEach(k => walker(o[k]));
            };

            walker(obj);
            console.log(`[TRT] tweet objects in response: ${seen}, kept (owned by ${this.auth.uid}): ${this.state.vault.size}, next cursor: ${this.state.nextCursor ? 'yes' : 'none'}`);
            this.renderList();
        }

        /**
         * Generates and updates the card UI for all items in the vault.
         */
        renderList() {
            this.get('trt-setup-ui').style.display = 'none';
            this.get('trt-list-ui').style.display = 'block';
            this.get('trt-actions').style.display = 'block';
            
            const list = this.get('trt-list-items');
            if (!list) return;
            
            // Sort by timestamp descending (newest first)
            const sortedItems = Array.from(this.state.vault.values())
                .sort((a, b) => b.timestamp - a.timestamp);

            list.innerHTML = sortedItems.map(item => {
                const dateObj = item.date ? new Date(item.date) : null;
                const formattedDateTime = dateObj
                ? `${dateObj.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }).toUpperCase()} · ${dateObj.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}`
                : 'Unknown Date';

                return `
                <div class="trt-card" id="card-${item.id}">
                    <div>
                        <div class="trt-card-meta">
                            <span class="trt-id-badge">${item.id}</span>
                            <input type="checkbox" class="trt-checkbox" data-tid="${item.id}" ${this.state.queue.has(item.id) ? 'checked' : ''}>
                        </div>
                        <div class="trt-card-date-container">
                        <div class="trt-card-date">${formattedDateTime}</div>
                        </div>
                        <div class="trt-card-body">${this.escape(item.text)}</div>
                    </div>
                    <a href="https://x.com/i/status/${item.id}" target="_blank" class="trt-view-btn">View Live</a>
                </div>
                `;
            }).join('');

            // Bind checkbox changes to the queue state
            list.querySelectorAll('.trt-checkbox').forEach(cb => {
                cb.onchange = (e) => {
                    const id = e.target.dataset.tid;
                    e.target.checked ? this.state.queue.add(id) : this.state.queue.delete(id);
                    this.updateCounters();
                };
            });
            this.updateCounters();
        }

        /**
         * Updates UI labels with current state counts.
         */
        updateCounters() {
            const cur = this.get('trt-current-count');
            const sel = this.get('trt-count');
            const del = this.get('trt-deleted-count');
            const btn = this.get('trt-delete-btn');

            if (cur) cur.innerText = this.state.vault.size;
            if (sel) sel.innerText = this.state.queue.size;
            if (del) del.innerText = this.state.deleted.size;
            
            const purging = this.state.isPurging;
            ['trt-load-more', 'trt-select-all-btn', 'trt-screen-btn'].forEach(id => {
                const b = this.get(id);
                if (b) b.disabled = purging;
            });

            if (btn) {
                btn.disabled = purging || this.state.queue.size === 0;
                btn.style.opacity = btn.disabled ? "0.5" : "1";
                btn.innerText = `Delete ${this.state.queue.size} Selected Items`;
            }
        }

        /**
         * Selects or deselects all currently visible items.
         */
        toggleSelectAll() {
            const cbs = document.querySelectorAll('.trt-checkbox');
            const allChecked = Array.from(cbs).every(c => c.checked);
            cbs.forEach(c => {
                c.checked = !allChecked;
                const id = c.dataset.tid;
                !allChecked ? this.state.queue.add(id) : this.state.queue.delete(id);
            });
            this.updateCounters();
        }

        /**
         * Processes the deletion queue sequentially with artificial delays 
         * to avoid overwhelming the platform and to align with normal interactive usage patterns.
         * All deletions require explicit user confirmation before execution.
         */
        async executeDeletion() {
            const target = this.auth.endpoints['DeleteTweet'];
            if (!target) return this.log("<span class='trt-error-text'>Delete Endpoint Missing</span>");
            
            // Final user confirmation
            if (!confirm(`Confirm: Delete ${this.state.queue.size} posts permanently?`)) return;
            
            for (let id of Array.from(this.state.queue)) {
                this.log(`Executing deletion: ${id}...`);
                await this.deleteOne(id, target);
                // Rate-limiting safety: 600ms delay between operations
                await this.sleep(600);
            }
            this.log("Batch Complete");
        }

        sleep(ms) { return new Promise(res => setTimeout(res, ms)); }

        /**
         * Fallback when the API returns 0 but tweets are still visible on the profile.
         * Reads tweet IDs straight from the X page (the "Posts" tab).
         * Only tweets whose permalink belongs to your own handle are collected,
         * so other people's tweets you reposted are skipped.
         * With autoScroll, scrolls the X page down to load more before giving up.
         */
        async scanScreen(autoScroll = false, maxCollect = Infinity) {
            const handle = (this.auth.handle || '').replace(/^@/, '').toLowerCase();
            if (!handle) { this.log("<span class='trt-error-text'>Handle unknown</span>"); return 0; }

            const collect = () => {
                let added = 0;
                document.querySelectorAll('article[data-testid="tweet"]').forEach(article => {
                    // The timestamp link is the tweet's own permalink: /{handle}/status/{id}
                    const timeLink = article.querySelector('a[href*="/status/"] time')?.closest('a');
                    const m = timeLink?.getAttribute('href')?.match(/^\/([^/]+)\/status\/(\d+)/);
                    if (!m || m[1].toLowerCase() !== handle) return;
                    const id = m[2];
                    if (this.state.deleted.has(id) || this.state.vault.has(id)) return;
                    const dt = timeLink.querySelector('time')?.getAttribute('datetime');
                    this.state.vault.set(id, {
                        id,
                        text: article.querySelector('[data-testid="tweetText"]')?.innerText || '(no text / media only)',
                        date: dt,
                        timestamp: dt ? Date.parse(dt) : 0
                    });
                    added++;
                });
                return added;
            };

            let total = collect();
            if (autoScroll) {
                // X only renders tweets near the viewport; scroll to make it load more
                let idleRounds = 0;
                while (idleRounds < 3 && !this.state.stopRequested && this.state.vault.size < maxCollect) {
                    window.scrollBy(0, window.innerHeight * 2);
                    this.log(`Scanning screen... ${this.state.vault.size} found`);
                    await this.sleep(1800);
                    const added = collect();
                    total += added;
                    idleRounds = added ? 0 : idleRounds + 1;
                }
            }
            console.log(`[TRT] screen scan: +${total} (handle @${handle})`);
            this.renderList();
            this.log(total ? `Screen Scan: ${total} found` : "Screen Scan: 0 found");
            return total;
        }

        /**
         * Waits for a rate-limit window to reset, using X's reset header if present.
         * Can be interrupted by the Stop button.
         */
        async waitForRateLimit(response) {
            const reset = Number(response?.headers?.get('x-rate-limit-reset'));
            let waitMs = reset ? reset * 1000 - Date.now() + 2000 : 60000;
            waitMs = Math.min(Math.max(waitMs, 15000), 15 * 60 * 1000); // 15s ~ 15min
            const until = Date.now() + waitMs;
            while (Date.now() < until && !this.state.stopRequested) {
                this.log(`Rate limited — waiting ${Math.ceil((until - Date.now()) / 1000)}s...`);
                await this.sleep(1000);
            }
        }

        /**
         * Deletes a single tweet. Retries on rate limit (429).
         * Returns true on success, false otherwise.
         */
        async deleteOne(id, target, attempt = 0) {
            try {
                const r = await fetch(`https://x.com${target.endpoint}`, {
                    method: 'POST',
                    headers: { 
                        "authorization": this.auth.bearer, 
                        "x-csrf-token": this.auth.csrf, 
                        "content-type": "application/json" 
                    },
                    body: JSON.stringify({ 
                        variables: { tweet_id: id, dark_request: false }, 
                        queryId: target.queryId 
                    })
                });

                if (r.status === 429 && attempt < 3 && !this.state.stopRequested) {
                    await this.waitForRateLimit(r);
                    if (this.state.stopRequested) return false;
                    return this.deleteOne(id, target, attempt + 1);
                }

                // GraphQL can return 200 with an errors array, so check the body too
                let body = null;
                try { body = await r.json(); } catch (_) {}
                const gqlFailed = body?.errors?.length && !body?.data?.delete_tweet;

                if (r.ok && !gqlFailed) {
                    this.state.deleted.add(id);
                    this.state.vault.delete(id);
                    this.state.queue.delete(id);
                    // Remove the card from UI immediately
                    document.getElementById(`card-${id}`)?.remove();
                    this.updateCounters();
                    return true;
                }
                console.warn("Deletion failed:", id, r.status, body?.errors);
            } catch (e) {
                console.error("Deletion Error:", e);
            }
            return false;
        }

        /**
         * Auto mode: Load -> delete everything loaded -> Load again ...
         * Repeats until a Load returns 0 tweets. Pressing the button again stops it.
         */
        /**
         * Auto delete, two independent modes:
         *  - 'api'    : Load via UserTweets API -> delete all -> reload ... until API returns 0
         *  - 'screen' : Read your tweets from the X page (scrolling) -> delete -> scroll on ...
         *               until no more of your tweets appear on screen
         * Clicking the running mode's button again stops it.
         */
        async purgeAll(mode) {
            // Click while running = Stop
            if (this.state.isPurging) {
                this.state.stopRequested = true;
                this.log("Stopping...");
                return;
            }

            const target = this.auth.endpoints['DeleteTweet'];
            if (!target) return this.log("<span class='trt-error-text'>Delete Endpoint Missing</span>");

            const isApi = mode === 'api';
            const msg = isApi
                ? "API AUTO DELETE\n\n" +
                  "API로 트윗을 불러와서 전부 삭제하는 것을 Load 결과가 0개가 될 때까지 반복합니다.\n"
                : "SCREEN AUTO DELETE\n\n" +
                  "X 페이지(프로필 게시물 탭)를 자동으로 스크롤하며 화면에 보이는 내 트윗을 삭제합니다.\n" +
                  "더 이상 내 트윗이 나오지 않을 때까지 반복합니다. 이 탭을 열어둔 채로 두세요.\n";
            if (!confirm(msg + "삭제된 트윗은 복구할 수 없습니다. 진행할까요?")) return;

            const buttons = {
                api:    { el: this.get('trt-purge-api-btn'),    label: '🔁 API Auto Delete' },
                screen: { el: this.get('trt-purge-screen-btn'), label: '🖥 Screen Auto Delete' }
            };
            const setRunning = (running) => {
                this.state.isPurging = running;
                for (const [key, b] of Object.entries(buttons)) {
                    if (!b.el) continue;
                    const active = running && key === mode;
                    b.el.className = `trt-btn ${active ? 'trt-btn-stop' : 'trt-btn-purge'}`;
                    b.el.innerText = active ? '⏹ Stop' : b.label;
                    b.el.disabled = running && !active; // the other mode is locked while running
                }
                this.updateCounters();
            };

            this.state.stopRequested = false;
            setRunning(true);
            if (!isApi) window.scrollTo(0, 0);

            let round = 0;
            let emptyStreak = 0;
            let finalMsg = "Auto Delete Finished";

            try {
                while (!this.state.stopRequested) {
                    round++;
                    // Clear only the current list; keep the Deleted counter
                    this.state.vault.clear();
                    this.state.queue.clear();

                    if (isApi) {
                        this.log(`Round ${round}: Loading (API)...`);
                        const fetched = await this.fetchTweets();
                        if (fetched === 'ratelimited') {
                            await this.waitForRateLimit(this.state.lastLoadResponse);
                            round--;
                            continue;
                        }
                        if (!fetched) {
                            finalMsg = "<span class='trt-error-text'>Stopped: Load Failed</span>";
                            break;
                        }
                    } else {
                        this.log(`Round ${round}: Scanning screen...`);
                        // Collect up to ~40 per round so deletion starts without scrolling forever
                        await this.scanScreen(true, 40);
                    }
                    if (this.state.stopRequested) break;

                    if (this.state.vault.size === 0) {
                        // Empty result can be transient (API sparse page / screen still loading)
                        emptyStreak++;
                        if (emptyStreak >= 2) {
                            finalMsg = `✅ Done — 0 found (${this.state.deleted.size} deleted)`;
                            break;
                        }
                        this.log("0 found — double-checking...");
                        await this.sleep(3000);
                        continue;
                    }
                    emptyStreak = 0;

                    const ids = Array.from(this.state.vault.keys());
                    let deletedThisRound = 0;
                    for (let i = 0; i < ids.length; i++) {
                        if (this.state.stopRequested) break;
                        this.log(`Round ${round}: Deleting ${i + 1}/${ids.length} (total ${this.state.deleted.size})...`);
                        if (await this.deleteOne(ids[i], target)) deletedThisRound++;
                        await this.sleep(600);
                    }

                    // Safety: if nothing could be deleted this round, stop instead of looping.
                    if (deletedThisRound === 0 && !this.state.stopRequested) {
                        finalMsg = `<span class='trt-error-text'>Stopped: ${ids.length} item(s) could not be deleted</span>`;
                        break;
                    }

                    await this.sleep(1500);
                }
                if (this.state.stopRequested) finalMsg = `Stopped by user (${this.state.deleted.size} deleted)`;
            } finally {
                this.state.stopRequested = false;
                setRunning(false);
                this.log(finalMsg);
            }
        }
    }

    // Instantiate and start the tool
    new TweetRemovalTool().start();
})();