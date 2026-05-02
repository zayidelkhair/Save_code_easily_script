

(function() {
    // ---------------- Language detection cache ----------------
    const langCache = new WeakMap();   // element → detected language

    // ---------- Language patterns (optimised) ----------
    const langPatterns = {
        'cpp': { patterns: [/std::/, /cout/, /#include\s*<[^>]*>/, /class\s+\w+\s*{/, /public:\s*\n/, /->\w+\(\)/] },
        'c': { patterns: [/printf\(/, /scanf\(/, /#include\s*<[^>]*\.h>/, /malloc\(/, /int\s+main\s*\(\s*void\s*\)/] },
        'python': { patterns: [/def\s+\w+\s*\([^)]*\):/, /import\s+\w+/, /from\s+\w+\s+import/, /print\(/, /if\s+__name__\s*==\s*['"]__main__['"]/] },
        'javascript': { patterns: [/function\s+\w+\s*\([^)]*\)\s*{/, /const\s+\w+\s*=/, /let\s+\w+\s*=/, /document\./, /console\.log\(/, /=>\s*{/] },
        'typescript': { patterns: [/interface\s+\w+\s*{/, /type\s+\w+\s*=/, /:\s*(string|number|boolean|any)\b/, /<[A-Z]\w*>/] },
        'java': { patterns: [/public\s+class\s+\w+/, /System\.out\./, /import\s+java\./, /@Override/] },
        'html': { patterns: [/<(!DOCTYPE|html|head|body|div|span|a|p|h\d)/i, /<\/\w+>/, /class=["']/] },
        'css': { patterns: [/^[\s]*[\w.#-]+\s*{/m, /:\s*\w+;/, /@media\s/, /@import\s/] },
        'sql': { patterns: [/SELECT\s+.+\s+FROM/i, /INSERT\s+INTO/i, /UPDATE\s+\w+\s+SET/i, /CREATE\s+TABLE/i] },
        'bash': { patterns: [/#!/, /echo\s+/, /read\s+/, /if\s+\[/, /export\s+\w+=/] },
        'php': { patterns: [/<\?php/, /\$_GET|\$_POST/, /echo\s+['"]/] },
        'ruby': { patterns: [/def\s+\w+\s*$/, /end$/m, /puts\s+/, /require\s+['"]/] },
        'go': { patterns: [/package\s+\w+/, /func\s+\w+\s*\([^)]*\)/, /import\s+\(/, /:=/] },
        'rust': { patterns: [/fn\s+\w+\s*\([^)]*\)\s*{/, /let\s+mut\s+/, /println!/, /->\s+\w+/] }
    };

    function detectLanguageFromContent(code, maxLength = 3000) {
        if (!code) return 'text';
        // Only analyse first maxLength chars for performance
        const snippet = code.slice(0, maxLength);
        const scores = {};
        for (let lang in langPatterns) {
            let score = 0;
            for (let pattern of langPatterns[lang].patterns) {
                const match = snippet.match(pattern);
                score += (match ? (Array.isArray(match) ? match.length : 1) : 0);
            }
            scores[lang] = score;
        }
        let bestLang = 'text';
        let bestScore = 0;
        for (let lang in scores) {
            if (scores[lang] > bestScore) {
                bestScore = scores[lang];
                bestLang = lang;
            }
        }
        return bestScore >= 1 ? bestLang : 'text';
    }

    const langToExt = {
        'cpp': 'cpp', 'c++': 'cpp', 'cc': 'cpp', 'cxx': 'cpp',
        'c': 'c', 'h': 'h',
        'python': 'py', 'py': 'py',
        'javascript': 'js', 'js': 'js',
        'typescript': 'ts', 'ts': 'ts',
        'java': 'java',
        'html': 'html', 'htm': 'html',
        'css': 'css',
        'sql': 'sql',
        'bash': 'sh', 'shell': 'sh',
        'php': 'php',
        'ruby': 'rb',
        'go': 'go',
        'rust': 'rs',
        'json': 'json',
        'xml': 'xml',
        'yaml': 'yml',
        'markdown': 'md',
        'text': 'txt'
    };

    function getExtension(lang) {
        lang = lang.toLowerCase().trim();
        if (langToExt[lang]) return langToExt[lang];
        if (lang === 'c++') return 'cpp';
        return 'txt';
    }

    // ---------------- Find code blocks ---------------- 
    function findCodeBlocks(container = document) {
        const blocks = [];
        container.querySelectorAll('pre code').forEach(codeEl => {
            let lang = '';
            const classMatch = codeEl.className.match(/(?:language|lang)-([a-zA-Z0-9+#]+)/);
            if (classMatch) lang = classMatch[1];
            if (!lang && codeEl.parentElement) {
                const parentClass = codeEl.parentElement.className.match(/(?:language|lang)-([a-zA-Z0-9+#]+)/);
                if (parentClass) lang = parentClass[1];
            }
            blocks.push({ element: codeEl, languageFromAttr: lang || 'text' });
        });
        container.querySelectorAll('[data-language], [data-lang]').forEach(el => {
            const lang = el.getAttribute('data-language') || el.getAttribute('data-lang');
            const codeEl = el.querySelector('code, pre') || el;
            if (codeEl && !blocks.some(b => b.element === codeEl)) {
                blocks.push({ element: codeEl, languageFromAttr: lang || 'text' });
            }
        });
        container.querySelectorAll('pre:not(:has(code))').forEach(pre => {
            const text = pre.innerText;
            if (text && text.length > 50 && (text.includes('\n') || text.includes('    '))) {
                blocks.push({ element: pre, languageFromAttr: 'text' });
            }
        });
        // Remove duplicates
        const unique = [];
        const seen = new Set();
        for (const block of blocks) {
            if (!seen.has(block.element)) {
                seen.add(block.element);
                unique.push(block);
            }
        }
        return unique;
    }

    // Get language with caching (WeakMap based on element)
    function getLanguageForBlock(block) {
        // If we already computed it, return cached value
        if (langCache.has(block.element)) {
            return langCache.get(block.element);
        }
        let lang = 'text';
        if (block.languageFromAttr && block.languageFromAttr !== 'text') {
            lang = block.languageFromAttr;
        } else {
            const code = block.element.innerText || block.element.textContent;
            lang = detectLanguageFromContent(code);
        }
        langCache.set(block.element, lang);
        return lang;
    }

    // ---------------- Save a single code block ---------------- 
    async function saveCode(block) {
        const code = block.element.innerText || block.element.textContent;
        let detectedLang = getLanguageForBlock(block);
        let finalLang = detectedLang;
        const change = confirm(`Detected: ${finalLang}\nOK to save as ${finalLang}? (Cancel to change)`);
        if (!change) {
            const newLang = prompt('Enter language (cpp, python, js, etc.):', finalLang);
            if (!newLang) return;
            finalLang = newLang;
        }
        const ext = getExtension(finalLang);
        const defaultName = `code_${finalLang}`;
        let fileName = prompt('File name (without extension):', defaultName);
        if (!fileName) return;
        if (!fileName.includes('.')) fileName = `${fileName}.${ext}`;
        const blob = new Blob([code], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showToast(`✅ Saved: ${fileName}`, '#4CAF50');
    }

    // ---------------- UI Components ---------------- 
    let statusDiv = null;
    let blockPanel = null;
    let panelVisible = false;

    function createFloatingUI() {
        if (statusDiv) statusDiv.remove();
        statusDiv = document.createElement('div');
        statusDiv.id = 'codeSaverStatus';
        statusDiv.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: rgba(0,0,0,0.8);
            backdrop-filter: blur(8px);
            color: white;
            padding: 6px 12px;
            border-radius: 40px;
            font-family: system-ui, -apple-system, sans-serif;
            font-size: 13px;
            z-index: 10001;
            display: flex;
            gap: 8px;
            align-items: center;
            box-shadow: 0 2px 12px rgba(0,0,0,0.3);
            border: 1px solid rgba(255,255,255,0.2);
        `;
        const toggleBtn = document.createElement('button');
        toggleBtn.textContent = '☰ LIST';
        toggleBtn.style.cssText = `
            background: #4CAF50;
            border: none;
            color: white;
            border-radius: 30px;
            padding: 4px 12px;
            cursor: pointer;
            font-size: 12px;
            font-weight: bold;
        `;
        toggleBtn.onclick = () => toggleBlockPanel();
        statusDiv.appendChild(toggleBtn);
        document.body.appendChild(statusDiv);
    }

    function toggleBlockPanel() {
        if (panelVisible) {
            if (blockPanel) blockPanel.remove();
            panelVisible = false;
        } else {
            panelVisible = true;
            buildBlockPanelAsync();       // starts async building
        }
    }

    // Build the list panel in a non‑blocking way (chunked rendering)
    function buildBlockPanelAsync() {
        if (blockPanel) blockPanel.remove();
        const blocks = findCodeBlocks();
        if (blocks.length === 0) {
            showToast('No code blocks found', '#ff9800');
            panelVisible = false;
            return;
        }

        // Create panel skeleton with loading indicator
        blockPanel = document.createElement('div');
        blockPanel.style.cssText = `
            position: fixed;
            top: 80px;
            right: 20px;
            width: 380px;
            max-height: 65vh;
            background: #1e1e1e;
            border-radius: 16px;
            box-shadow: 0 8px 28px rgba(0,0,0,0.5);
            z-index: 10003;
            overflow-y: auto;
            font-family: system-ui, -apple-system, sans-serif;
            font-size: 13px;
            border: 1px solid #444;
            backdrop-filter: blur(8px);
            background: rgba(30,30,30,0.96);
            display: flex;
            flex-direction: column;
        `;

        // Sticky header
        const header = document.createElement('div');
        header.style.cssText = 'padding: 12px 16px; border-bottom: 1px solid #444; display: flex; justify-content: space-between; align-items: center; position: sticky; top:0; background: inherit; backdrop-filter: blur(8px);';
        header.innerHTML = `<span style="font-weight:600;">📋 Code Blocks (${blocks.length})</span><span style="cursor:pointer; font-size:18px;" id="closePanelBtn">✖</span>`;
        blockPanel.appendChild(header);

        // Container for items
        const listContainer = document.createElement('div');
        listContainer.style.flex = '1';
        listContainer.style.overflowY = 'auto';
        blockPanel.appendChild(listContainer);

        // Show a temporary loading hint
        const loadingHint = document.createElement('div');
        loadingHint.textContent = '⏳ Loading blocks…';
        loadingHint.style.padding = '16px';
        loadingHint.style.color = '#aaa';
        loadingHint.style.textAlign = 'center';
        listContainer.appendChild(loadingHint);

        document.body.appendChild(blockPanel);

        // Close button
        const closeBtn = document.getElementById('closePanelBtn');
        if (closeBtn) closeBtn.onclick = () => toggleBlockPanel();

        // Render blocks in chunks to keep the UI responsive
        const CHUNK_SIZE = 15;   // items per frame
        let index = 0;
        const total = blocks.length;

        // Remove loading hint when first items are added
        function addChunk() {
            const batchEnd = Math.min(index + CHUNK_SIZE, total);
            // Remove loading hint if it's still there (only once)
            if (index === 0 && loadingHint.parentNode) loadingHint.remove();

            for (let i = index; i < batchEnd; i++) {
                const block = blocks[i];
                const lang = getLanguageForBlock(block);   // cached after first call
                const preview = (block.element.innerText || block.element.textContent).substring(0, 70).replace(/\n/g, ' ');
                const item = document.createElement('div');
                item.style.cssText = 'padding: 10px 16px; border-bottom: 1px solid #333; cursor: pointer; transition: 0.1s; display: flex; align-items: center; gap: 10px;';
                item.onmouseenter = () => item.style.backgroundColor = '#2a2a2a';
                item.onmouseleave = () => item.style.backgroundColor = 'transparent';
                item.innerHTML = `
                    <span style="background:#4CAF50; color:white; padding:2px 8px; border-radius:20px; font-size:10px; font-weight:bold; min-width:45px; text-align:center;">${lang}</span>
                    <span style="flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:#ccc;">${preview}</span>
                    <button class="gotoBtn" style="background:#2196F3; border:none; color:white; border-radius:20px; padding:4px 10px; cursor:pointer; font-size:11px;">↓ jump</button>
                `;
                const gotoBtn = item.querySelector('.gotoBtn');
                gotoBtn.onclick = (e) => {
                    e.stopPropagation();
                    scrollToBlock(block.element);
                    toggleBlockPanel();
                };
                item.onclick = () => {
                    scrollToBlock(block.element);
                    toggleBlockPanel();
                };
                listContainer.appendChild(item);
            }
            index = batchEnd;

            if (index < total) {
                // Schedule next chunk
                requestAnimationFrame(addChunk);
            }
        }

        requestAnimationFrame(addChunk);
    }

    function scrollToBlock(element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        const originalOutline = element.style.outline;
        element.style.outline = '3px solid #ffeb3b';
        element.style.transition = 'outline 0.2s';
        setTimeout(() => { element.style.outline = originalOutline; }, 1000);
    }

    function showToast(msg, bg = '#2196F3') {
        const toast = document.createElement('div');
        toast.textContent = msg;
        toast.style.cssText = `
            position: fixed;
            bottom: 80px;
            right: 20px;
            background: ${bg};
            color: white;
            padding: 8px 16px;
            border-radius: 40px;
            font-family: system-ui, sans-serif;
            font-size: 13px;
            z-index: 10002;
            box-shadow: 0 2px 12px rgba(0,0,0,0.2);
            animation: fadeIn 0.2s ease;
        `;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 2500);
    }

    // ---------------- Save button on each code block ---------------- 
    function addSaveButton(block) {
        const container = block.element.parentElement;
        if (!container || container.querySelector('.code-saver-tag')) return;
        if (getComputedStyle(container).position === 'static') container.style.position = 'relative';
        const tag = document.createElement('div');
        tag.className = 'code-saver-tag';
        const lang = getLanguageForBlock(block);   // use cached
        tag.innerHTML = `
            <span style="background:#2d2d2d; color:#eee; padding:4px 8px; border-radius:6px 0 0 6px; font-size:11px; font-family:monospace;">${lang}</span>
            <button style="background:#4CAF50; color:white; border:none; padding:4px 10px; border-radius:0 6px 6px 0; cursor:pointer; font-size:12px; font-weight:bold;">💾 Save</button>
        `;
        tag.style.cssText = `
            position: absolute;
            top: 6px;
            right: 6px;
            z-index: 1000;
            display: flex;
            gap: 0;
            font-size: 12px;
            border-radius: 6px;
            overflow: hidden;
            box-shadow: 0 2px 8px rgba(0,0,0,0.2);
            opacity: 0.85;
            transition: opacity 0.2s;
        `;
        tag.onmouseenter = () => tag.style.opacity = '1';
        tag.onmouseleave = () => tag.style.opacity = '0.85';
        tag.querySelector('button').onclick = (e) => {
            e.stopPropagation();
            saveCode(block);
        };
        container.appendChild(tag);
    }

    // ---------------- Background watcher (NO auto‑refresh while panel open) ----------------
    function scanAndAdd(container = document) {
        const blocks = findCodeBlocks(container);
        blocks.forEach(block => addSaveButton(block));
        // Pre‑cache language for all blocks found (so list panel is instant later)
        blocks.forEach(block => getLanguageForBlock(block));

        // 🔥 FIX: do NOT refresh the panel if it's already open – stops blinking
        if (panelVisible) return;
    }

    let observer = null;
    function startWatcher() {
        scanAndAdd(document);
        observer = new MutationObserver(mutations => {
            for (const m of mutations) {
                if (m.addedNodes.length) {
                    for (const node of m.addedNodes) {
                        if (node.nodeType === 1) {
                            scanAndAdd(node);
                        }
                    }
                }
            }
            // No panel refresh here – only re‑build when user opens the panel
        });
        observer.observe(document.body, { childList: true, subtree: true });
    }

    // Add fade-in animation
    const style = document.createElement('style');
    style.textContent = `@keyframes fadeIn { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }`;
    document.head.appendChild(style);

    // ---------------- Start ---------------- 
    createFloatingUI();
    startWatcher();
    showToast(`✨ Ready — code blocks: ${findCodeBlocks().length}. Click ☰ LIST`, '#2196F3');
})();
