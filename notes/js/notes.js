/**
 * @file notes.js
 * @brief Handles data loading, pagination, markdown rendering, and navigation
 *        for the /notes section of my website.
 *
 * @details
 * The file is structured around three classes:
 *
 *  - PostCard   — static helper that builds the post card HTML template.
 *                 Eliminates the duplication that existed between the list
 *                 and filtered-results renderers.
 *
 *  - IndexPage  — owns everything on index.html: the paginated post list,
 *                 pagination controls, and the three sidebar widgets
 *                 (recent posts, categories, tag cloud).
 *
 *  - PostPage   — owns everything on post.html: meta tags, post header,
 *                 markdown fetching/rendering, and the table of contents.
 *
 * Entry point is the DOMContentLoaded listener at the bottom, which fetches
 * data.json and instantiates the appropriate class based on the current URL.
 *
 * Expected data.json shape:
 * @code
 * {
 *   "posts": [
 *     {
 *       "id": 1,
 *       "title": "...",
 *       "date": "YYYY-MM-DD",
 *       "category": "...",
 *       "tags": ["..."],
 *       "excerpt": "...",
 *       "filename": "1-post-slug.md",
 *       "featured_image": "images/post-1/cover.webp",  // optional
 *       "author": "...",
 *       "readTime": 5
 *     },
 *     ...
 *   ]
 * }
 * @endcode
 */


/**
 * @class PostCard
 * @brief Static factory for the post card HTML template.
 *
 * @details Centralises the card markup so that IndexPage.renderList() and
 * IndexPage.renderFiltered() both produce identical cards without duplicating
 * the template string.
 */
class PostCard {
    /**
     * @brief Builds the HTML string for a single post card.
     *
     * @param {Object} post - A post object from data.json.
     * @returns {string} An <article> HTML string ready for injection.
     */
    static build(post) {
        // Format the date once for reuse inside the template
        const date = new Date(post.date).toLocaleDateString('en-US', {
            year: 'numeric', month: 'long', day: 'numeric'
        });

        return `
            <article style="margin-bottom: 2rem; padding: 0 1rem 2rem 1rem; border-bottom: 1px solid #ddd;">
                ${post.featured_image ? `
                    <a href="/notes/post.html?id=${post.id}" class="image fit" style="display: block; margin-bottom: 1rem;">
                        <img src="/notes/${post.featured_image}" alt="${post.title}" style="width: 100%; height: auto; border-radius: 5px;">
                    </a>
                ` : ''}
                <h3>
                    <a href="/notes/post.html?id=${post.id}" style="color: inherit; text-decoration: none;">
                        ${post.title}
                    </a>
                </h3>
                <div style="font-size: 0.9rem; color: #666; margin-bottom: 0.5rem; display: flex; flex-wrap: wrap; gap: 0; align-items: center;">
                    <span>${date}</span>
                    <span style="margin: 0 0.5rem;">|</span>
                    <span><strong>${post.category}</strong></span>
                    <span style="margin: 0 0.5rem;">|</span>
                    <span>${post.readTime} min read</span>
                </div>
                <p>${post.excerpt}</p>
                <a href="/notes/post.html?id=${post.id}" class="button small">Read More</a>
            </article>
        `;
    }
}

/**
 * @class IndexPage
 * @brief Controls all rendering on the notes index page.
 *
 * @details Owns the paginated post list, pagination controls, and the three
 * sidebar widgets: recent posts, categories, and tag cloud. Filtering by
 * category or tag replaces the paginated list with a flat filtered view.
 */
class IndexPage {
    /**
     * @brief Constructs the IndexPage and kicks off all render passes.
     *
     * @param {Object[]} posts - The full sorted posts array from data.json.
     *                           Expected to be pre-sorted newest-first.
     */
    constructor(posts) {
        /** @type {Object[]} Full posts array, sorted newest-first. */
        this.posts = posts;

        /** @type {number} Number of posts shown per page. */
        this.postsPerPage = 5;

        // Read the current page from the URL query param, defaulting to 1
        const urlParams = new URLSearchParams(window.location.search);
        /** @type {number} Currently active page number. */
        this.currentPage = parseInt(urlParams.get('page')) || 1;

        // Render all sections of the index page
        this.renderList();
        this.renderFeatured();
        this.renderCategories();
        this.renderTags();
    }

    /**
     * @brief Renders the paginated post list into #posts-container.
     *
     * @details Slices `this.posts` for the current page, builds a PostCard
     * for each, and injects them. Calls renderPagination() afterwards to
     * wire up the prev/next controls.
     */
    renderList() {
        // Calculate slice boundaries for the current page
        const startIdx = (this.currentPage - 1) * this.postsPerPage;
        const endIdx = startIdx + this.postsPerPage;
        const paginated = this.posts.slice(startIdx, endIdx);

        const container = document.getElementById('posts-container');
        container.innerHTML = ''; // Clear previously rendered cards

        paginated.forEach(post => {
            container.innerHTML += PostCard.build(post);
        });

        this.renderPagination();
    }

    /**
     * @brief Updates the pagination controls below the post list.
     *
     * @details Computes total pages, updates the "Page X of Y" label, and
     * wires prev/next buttons to navigate via `?page=N` in the URL.
     */
    renderPagination() {
        const totalPages = Math.ceil(this.posts.length / this.postsPerPage);

        // Update the page counter label
        document.getElementById('page-info').textContent = `Page ${this.currentPage} of ${totalPages}`;

        const prevBtn = document.getElementById('prev-btn');
        const nextBtn = document.getElementById('next-btn');

        // Disable buttons at the boundaries to prevent going out of range
        prevBtn.disabled = this.currentPage === 1;
        nextBtn.disabled = this.currentPage === totalPages;

        prevBtn.onclick = () => {
            if (this.currentPage > 1) {
                this.currentPage--;
                window.location.href = `/notes/index.html?page=${this.currentPage}`;
            }
        };

        nextBtn.onclick = () => {
            if (this.currentPage < totalPages) {
                this.currentPage++;
                window.location.href = `/notes/index.html?page=${this.currentPage}`;
            }
        };
    }

    /**
     * @brief Renders the "Recent Posts" sidebar widget into #featured-posts.
     *
     * @details Shows the 3 most recent posts. Since `this.posts` is already
     * sorted newest-first, this is just a slice of the first 3 entries.
     */
    renderFeatured() {
        const container = document.getElementById('featured-posts');
        const featured = this.posts.slice(0, 3); // Top 3 = most recent

        let html = '<ul style="list-style: none; padding: 0;">';
        featured.forEach(post => {
            const date = new Date(post.date).toLocaleDateString('en-US', {
                month: 'short', day: 'numeric'
            });
            html += `
                <li style="margin-bottom: 1rem;">
                    <a href="/notes/post.html?id=${post.id}" style="color: #007acc; text-decoration: none; font-weight: 500; display: block; margin-bottom: 0.3rem;">
                        ${post.title}
                    </a>
                    <small style="color: #999;">${date}</small>
                </li>
            `;
        });
        html += '</ul>';
        container.innerHTML = html;
    }

    /**
     * @brief Renders the categories sidebar widget into #categories-list.
     *
     * @details Counts posts per category, then renders an alphabetically
     * sorted list of links that call filterByCategory() on click.
     */
    renderCategories() {
        const container = document.getElementById('categories-list');
        const counts = {}; // { categoryName: postCount }

        // Tally posts per category
        this.posts.forEach(post => {
            counts[post.category] = (counts[post.category] || 0) + 1;
        });

        let html = '';
        // Render in alphabetical order
        Object.keys(counts).sort().forEach(category => {
            html += `
                <li style="margin-bottom: 0.5rem;">
                    <a href="#" onclick="filterByCategory('${category}'); return false;" style="color: #007acc; text-decoration: none;">
                        ${category} <span style="color: #999;">(${counts[category]})</span>
                    </a>
                </li>
            `;
        });
        container.innerHTML = html;
    }

    /**
     * @brief Renders the tag cloud sidebar widget into #tags-cloud.
     *
     * @details Counts tag frequency across all posts, sorts by frequency
     * descending, and renders the top 12. Font size and opacity scale with
     * frequency to give visual weight to more common tags.
     */
    renderTags() {
        const container = document.getElementById('tags-cloud');
        const counts = {}; // { tagName: occurrenceCount }

        // Aggregate tag counts across all posts
        this.posts.forEach(post => {
            post.tags.forEach(tag => {
                counts[tag] = (counts[tag] || 0) + 1;
            });
        });

        // Sort by frequency descending, cap at 12 to keep the cloud readable
        const sorted = Object.entries(counts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 12);

        let html = '<div style="display: flex; flex-wrap: wrap; gap: 0.5rem;">';
        sorted.forEach(([tag, count]) => {
            const size = count > 2 ? '1.1em' : '0.9em'; // Larger font for frequent tags
            html += `
                <a href="#" onclick="filterByTag('${tag}'); return false;"
                   style="color: #007acc; text-decoration: none; font-size: ${size}; opacity: ${0.7 + (count * 0.1)};">
                    ${tag}
                </a>
            `;
        });
        html += '</div>';
        container.innerHTML = html;
    }

    /**
     * @brief Filters and displays only posts belonging to the given category.
     *
     * @param {string} category - Category name to filter by.
     */
    filterByCategory(category) {
        const filtered = this.posts.filter(post => post.category === category);
        this.renderFiltered(filtered, `Category: ${category}`);
    }

    /**
     * @brief Filters and displays only posts tagged with the given tag.
     *
     * @param {string} tag - Tag to filter by.
     */
    filterByTag(tag) {
        const filtered = this.posts.filter(post => post.tags.includes(tag));
        this.renderFiltered(filtered, `Tag: ${tag}`);
    }

    /**
     * @brief Renders a filtered subset of posts into #posts-container.
     *
     * @details Replaces the normal paginated list with a flat list of matching
     * posts. Hides pagination controls and appends a "Clear Filter" button.
     *
     * @param {Object[]} filtered - Array of matching post objects.
     * @param {string}   label    - Filter description shown in the page-info
     *                              element (e.g. "Category: AI").
     */
    renderFiltered(filtered, label) {
        // Sort the filtered subset newest-first
        filtered.sort((a, b) => new Date(b.date) - new Date(a.date));

        const container = document.getElementById('posts-container');
        container.innerHTML = '';

        if (filtered.length === 0) {
            container.innerHTML = `<p>No posts found for ${label}.</p>`;
            document.getElementById('pagination').style.display = 'none';
            return;
        }

        // Hide normal pagination — filtered results are shown all at once
        document.getElementById('pagination').style.display = 'none';
        document.getElementById('page-info').textContent = `${label} (${filtered.length} posts)`;

        // Reuse PostCard.build() — same card template as the main list
        filtered.forEach(post => {
            container.innerHTML += PostCard.build(post);
        });

        // Append a button to reset the filter and return to the full index
        const clearBtn = document.createElement('div');
        clearBtn.innerHTML = `<a href="/notes/" class="button">Clear Filter</a>`;
        container.appendChild(clearBtn);
    }
}


/**
 * @class PostPage
 * @brief Controls all rendering on a single post page.
 *
 * @details Populates meta tags, post header fields, featured image, markdown
 * content, and the sidebar table of contents.
 */
class PostPage {
    /**
     * @brief Constructs the PostPage, validates the URL id, and begins rendering.
     *
     * @param {Object[]} posts - The full posts array from data.json.
     */
    constructor(posts) {
        /** @type {Object[]} Full posts array from data.json. */
        this.posts = posts;

        const urlParams = new URLSearchParams(window.location.search);
        const postId = parseInt(urlParams.get('id'));

        // Find post by ID property (not array index, since array may be sorted)
        const post = this.posts.find(p => p.id === postId);

        // Validate: post must exist
        if (!post) {
            document.getElementById('post-content').innerHTML =
                '<h2>Post not found</h2><p><a href="/notes/">Back to notes</a></p>';
            return;
        }

        this.render(post, postId);
    }

    /**
     * @brief Renders all content and metadata for the post page.
     *
     * @details Fills meta tags, post header fields, optional featured image,
     * and fetches + renders the markdown file. Calls renderTOC() after
     * markdown is injected so headings are present in the DOM.
     *
     * @param {Object} post   - The post object from data.json.
     * @param {number} postId - 1-based post ID, used in the canonical URL.
     */
    async render(post, postId) {
        // --- Page-level meta tags ---
        document.getElementById('page-title').textContent = `${post.title} - Notes - Syed Taha`;
        document.getElementById('meta-description').content = post.excerpt;
        document.getElementById('meta-keywords').content = post.tags.join(', ');
        document.getElementById('canonical-link').href = `/notes/post.html?id=${postId}`;

        // --- Post header fields ---
        document.getElementById('post-title').textContent = post.title;
        document.getElementById('post-excerpt').textContent = post.excerpt;
        document.getElementById('post-author').textContent = post.author;
        document.getElementById('post-date').textContent =
            new Date(post.date).toLocaleDateString('en-US', {
                year: 'numeric', month: 'long', day: 'numeric'
            });
        document.getElementById('post-category').textContent = post.category;
        document.getElementById('post-readtime').textContent = post.readTime;

        // Render each tag as an inline <span> chip
        document.getElementById('post-tags-container').innerHTML =
            post.tags.map(tag => `<span class="tag">${tag}</span>`).join('');

        // Inject featured image only if the post defines one
        if (post.featured_image) {
            document.getElementById('featured-image-container').innerHTML =
                `<a href="#" class="image fit"><img src="/notes/${post.featured_image}" alt="${post.title}" /></a>`;
        }

        // --- Markdown content ---
        try {
            const response = await fetch(`/notes/posts/${post.filename}`);
            let markdown = await response.text();

            // Strip the leading h1 — it's already rendered as the page title,
            // so including it in the markdown body would duplicate it
            markdown = markdown.replace(/^# .+\n\n/, '');

            // Convert to HTML via the marked library and inject into the DOM
            document.getElementById('post-content').innerHTML = marked.marked(markdown);

            // TOC must be built after markdown is in the DOM so headings exist
            this.renderTOC();
        } catch (error) {
            console.error('Error loading post content:', error);
            document.getElementById('post-content').innerHTML = '<p>Error loading content.</p>';
        }
    }

    /**
     * @brief Builds and injects the table of contents into #toc-content.
     *
     * @details Queries all h1/h2 elements in #post-content, assigns IDs to
     * any that lack one, then builds a nested <ul> mirroring the heading
     * hierarchy. Each entry links to its heading via anchor.
     *
     * Renders a "No sections" placeholder if no headings are found.
     */
    renderTOC() {
        const contentElement = document.getElementById('post-content');
        const headings = contentElement.querySelectorAll('h1, h2');

        if (headings.length === 0) {
            document.getElementById('toc-content').innerHTML =
                '<p style="font-size: 0.9rem; color: #999;">No sections</p>';
            return;
        }

        // Assign stable anchor IDs to headings that don't already have one
        let headingIndex = 0;
        headings.forEach(heading => {
            if (!heading.id) {
                headingIndex++;
                heading.id = `heading-${headingIndex}`;
            }
        });

        let tocHTML = '<ul>';
        let currentLevel = 1;
        let openLists = [1]; // Stack tracking currently open <ul> nesting levels

        headings.forEach(heading => {
            const level = parseInt(heading.tagName[1]); // Numeric level from 'H1'/'H2'
            const text = heading.textContent;
            const id = heading.id;

            if (level > currentLevel) {
                // Heading is deeper — open nested <ul> levels until we reach it
                while (currentLevel < level) {
                    tocHTML += '<ul>';
                    openLists.push(level);
                    currentLevel++;
                }
            } else if (level < currentLevel) {
                // Heading is shallower — close open <ul> levels until we reach it
                while (currentLevel > level) {
                    tocHTML += '</ul>';
                    openLists.pop();
                    currentLevel--;
                }
            }

            tocHTML += `<li><a href="#${id}">${text}</a></li>`;
        });

        // Close any <ul> levels still open after the last heading
        while (openLists.length > 1) {
            tocHTML += '</ul>';
            openLists.pop();
        }

        tocHTML += '</ul>';
        document.getElementById('toc-content').innerHTML = tocHTML;
    }
}


// 
// ENTRY POINT
// 

/**
 * @brief Global IndexPage instance, set when on the index page.
 *
 * @details Exposed globally so the inline onclick handlers in the sidebar
 * (filterByCategory, filterByTag) can reach the IndexPage instance.
 *
 * @type {IndexPage|null}
 */
let indexPage = null;

/**
 * @brief Bootstraps the page after the DOM is ready.
 *
 * @details Fetches data.json, sorts posts newest-first, then constructs either
 * an IndexPage or a PostPage depending on the current URL.
 */
document.addEventListener('DOMContentLoaded', async function () {
    try {
        const response = await fetch('/notes/data.json');
        const data = await response.json();

        // Sort all posts by date descending once, upfront
        data.posts.sort((a, b) => new Date(b.date) - new Date(a.date));

        if (window.location.pathname.includes('post.html')) {
            new PostPage(data.posts);
        } else {
            indexPage = new IndexPage(data.posts);
        }
    } catch (error) {
        console.error('Error loading data:', error);
        // Replace the entire page body with a user-facing error message
        document.body.innerHTML =
            '<div style="padding: 2rem; text-align: center;"><h2>Error loading content</h2><p>Please try refreshing the page.</p></div>';
    }
});

/**
 * @brief Global shim — forwards category filter clicks to the IndexPage instance.
 *
 * @details The category links rendered by IndexPage.renderCategories() use
 * inline onclick="filterByCategory(...)" which requires a global function.
 * This shim bridges the global scope to the class instance.
 *
 * @param {string} category - Category name to filter by.
 */
function filterByCategory(category) {
    indexPage?.filterByCategory(category);
}

/**
 * @brief Global shim — forwards tag filter clicks to the IndexPage instance.
 *
 * @details Same pattern as filterByCategory(). Inline onclick handlers in the
 * tag cloud require a global entry point.
 *
 * @param {string} tag - Tag to filter by.
 */
function filterByTag(tag) {
    indexPage?.filterByTag(tag);
}