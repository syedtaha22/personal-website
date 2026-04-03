/**
 * @file index.js
 * @brief Sidebar population, pagination, and filtering for the static
 *        index page.
 *
 * @details Post cards are pre-rendered into the HTML by generate-sites.py,
 * so this file does not render the main post list. It handles:
 *
 *  - Sidebar widgets: recent posts, categories, tag cloud
 *  - Pagination controls: prev/next buttons and page label
 *  - Filtering: replaces the pre-rendered cards with a filtered subset
 *    when the user clicks a category or tag link
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
 *       "featured_image": "images/post-1/cover.webp",
 *       "author": "...",
 *       "readTime": 5
 *     }
 *   ]
 * }
 * @endcode
 */


/**
 * @brief Derives the absolute URL for a post from its markdown filename.
 *
 * @details Strips the leading numeric prefix and .md extension to produce
 * a slug, then builds an absolute /blog/ path. Mirrors slug_from_filename()
 * in generate-sites.py so URLs always match the generated files.
 *
 * @param {string} filename - Markdown filename from data.json (e.g. "1-riscv-env-setup.md").
 * @returns {string} Absolute URL to the static post page (e.g. "/blog/riscv-env-setup.html").
 *
 * @example
 * postUrl("1-riscv-env-setup.md")  // -> "/blog/riscv-env-setup.html"
 * postUrl("10-some-post.md")       // -> "/blog/some-post.html"
 */
function postUrl(filename) {
    const slug = filename
        .replace(/\.md$/, '')   // Drop .md extension
        .replace(/^\d+-/, '');  // Drop leading "N-" numeric prefix
    return `/blog/${slug}.html`;
}


/**
 * @class PostCard
 * @brief Static factory for a post card HTML string.
 *
 * @details Only used when rendering a filtered subset of posts (by category
 * or tag). The main list is pre-rendered by generate-sites.py, so this
 * class is not called during a normal page load — only on filter activation.
 */
class PostCard {
    /**
     * @brief Builds the HTML string for a single post card.
     *
     * @param {Object} post - A post object from data.json.
     * @returns {string} An <article> HTML string ready for injection.
     */
    static build(post) {
        const url = postUrl(post.filename);
        const date = new Date(post.date).toLocaleDateString('en-US', {
            year: 'numeric', month: 'long', day: 'numeric'
        });

        return `
            <article style="margin-bottom: 2rem; padding: 0 1rem 2rem 1rem; border-bottom: 1px solid #ddd;">
                ${post.featured_image ? `
                    <a href="${url}" class="image fit" style="display: block; margin-bottom: 1rem;">
                        <img src="/blog/${post.featured_image}" alt="${post.title}"
                             style="width: 100%; height: auto; border-radius: 5px;">
                    </a>
                ` : ''}
                <h3>
                    <a href="${url}" style="color: inherit; text-decoration: none;">
                        ${post.title}
                    </a>
                </h3>
                <div style="font-size: 0.9rem; color: #666; margin-bottom: 0.5rem;
                            display: flex; flex-wrap: wrap; gap: 0; align-items: center;">
                    <span>${date}</span>
                    <span style="margin: 0 0.5rem;">|</span>
                    <span><strong>${post.category}</strong></span>
                    <span style="margin: 0 0.5rem;">|</span>
                    <span>${post.readTime} min read</span>
                </div>
                <p>${post.excerpt}</p>
                <a href="${url}" class="button small">Read More</a>
            </article>
        `;
    }
}


/**
 * @class IndexPage
 * @brief Controls sidebar widgets, pagination, and filtering on the index page.
 *
 * @details The post list is already baked into the HTML by generate-sites.py.
 * This class handles everything around it: the three sidebar widgets, the
 * pagination controls, and the filtered view rendered on category/tag click.
 */
class IndexPage {
    /**
     * @brief Constructs the IndexPage and kicks off all render passes.
     *
     * @param {Object[]} posts - Full posts array from data.json, pre-sorted
     *                           newest-first by the entry point.
     */
    constructor(posts) {
        /** @type {Object[]} Full posts array, sorted newest-first. */
        this.posts = posts;

        /** @type {number} Number of posts shown per page. */
        this.postsPerPage = 5;

        // Read current page from URL query param, defaulting to 1
        const urlParams = new URLSearchParams(window.location.search);

        /** @type {number} Currently active page number. */
        this.currentPage = parseInt(urlParams.get('page')) || 1;

        this.renderFeatured();
        this.renderCategories();
        this.renderTags();
        this.renderPagination();
    }

    /**
     * @brief Updates the pagination controls below the post list.
     *
     * @details Computes total pages from the full post count, updates the
     * "Page X of Y" label, and wires the prev/next buttons to navigate
     * via `?page=N` query params.
     *
     * @returns {void}
     */
    renderPagination() {
        const totalPages = Math.ceil(this.posts.length / this.postsPerPage);

        document.getElementById('page-info').textContent =
            `Page ${this.currentPage} of ${totalPages}`;

        const prevBtn = document.getElementById('prev-btn');
        const nextBtn = document.getElementById('next-btn');

        // Disable at the boundaries to prevent navigating out of range
        prevBtn.disabled = this.currentPage === 1;
        nextBtn.disabled = this.currentPage === totalPages;

        prevBtn.onclick = () => {
            if (this.currentPage > 1) {
                this.currentPage--;
                window.location.href = `/blog/?page=${this.currentPage}`;
            }
        };

        nextBtn.onclick = () => {
            if (this.currentPage < totalPages) {
                this.currentPage++;
                window.location.href = `/blog/?page=${this.currentPage}`;
            }
        };
    }

    /**
     * @brief Renders the "Recent Posts" sidebar widget into #featured-posts.
     *
     * @details Shows the 3 most recent posts. Since this.posts is already
     * sorted newest-first, this is a simple slice of the first 3 entries.
     *
     * @returns {void}
     */
    renderFeatured() {
        const container = document.getElementById('featured-posts');
        const featured = this.posts.slice(0, 3);

        let html = '<ul style="list-style: none; padding: 0;">';
        featured.forEach(post => {
            const date = new Date(post.date).toLocaleDateString('en-US', {
                month: 'short', day: 'numeric'
            });
            html += `
                <li style="margin-bottom: 1rem;">
                    <a href="${postUrl(post.filename)}"
                       style="color: #007acc; text-decoration: none; font-weight: 500;
                              display: block; margin-bottom: 0.3rem;">
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
     * sorted list of links that trigger filterByCategory() on click.
     *
     * @returns {void}
     */
    renderCategories() {
        const container = document.getElementById('categories-list');
        const counts = {}; // { categoryName: postCount }

        this.posts.forEach(post => {
            counts[post.category] = (counts[post.category] || 0) + 1;
        });

        let html = '';
        Object.keys(counts).sort().forEach(category => {
            html += `
                <li style="margin-bottom: 0.5rem;">
                    <a href="#"
                       onclick="filterByCategory('${category}'); return false;"
                       style="color: #007acc; text-decoration: none;">
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
     * descending, then renders the top 12. Font size and opacity scale with
     * frequency to give visual weight to more common tags.
     *
     * @returns {void}
     */
    renderTags() {
        const container = document.getElementById('tags-cloud');
        const counts = {}; // { tagName: occurrenceCount }

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
                <a href="#"
                   onclick="filterByTag('${tag}'); return false;"
                   style="color: #007acc; text-decoration: none;
                          font-size: ${size}; opacity: ${0.7 + (count * 0.1)};">
                    ${tag}
                </a>
            `;
        });
        html += '</div>';
        container.innerHTML = html;
    }

    /**
     * @brief Filters the post list to only show posts in the given category.
     *
     * @param {string} category - Category name to filter by.
     * @returns {void}
     */
    filterByCategory(category) {
        const filtered = this.posts.filter(post => post.category === category);
        this.renderFiltered(filtered, `Category: ${category}`);
    }

    /**
     * @brief Filters the post list to only show posts tagged with the given tag.
     *
     * @param {string} tag - Tag to filter by.
     * @returns {void}
     */
    filterByTag(tag) {
        const filtered = this.posts.filter(post => post.tags.includes(tag));
        this.renderFiltered(filtered, `Tag: ${tag}`);
    }

    /**
     * @brief Renders a filtered subset of posts into #posts-container.
     *
     * @details Replaces the pre-rendered card list with a flat filtered list,
     * hides pagination controls, and appends a "Clear Filter" button to
     * return to the full unfiltered index.
     *
     * @param {Object[]} filtered - Array of matching post objects.
     * @param {string}   label    - Filter description shown in the page-info
     *                             element, e.g. "Category: AI".
     * @returns {void}
     */
    renderFiltered(filtered, label) {
        filtered.sort((a, b) => new Date(b.date) - new Date(a.date));

        const container = document.getElementById('posts-container');
        container.innerHTML = '';

        if (filtered.length === 0) {
            container.innerHTML = `<p>No posts found for ${label}.</p>`;
            document.getElementById('pagination').style.display = 'none';
            return;
        }

        // Hide pagination — filtered results are shown all at once
        document.getElementById('pagination').style.display = 'none';
        document.getElementById('page-info').textContent =
            `${label} (${filtered.length} posts)`;

        filtered.forEach(post => {
            container.innerHTML += PostCard.build(post);
        });

        // Append a button to reset the filter and return to the full index
        const clearBtn = document.createElement('div');
        clearBtn.innerHTML = `<a href="/blog/" class="button">Clear Filter</a>`;
        container.appendChild(clearBtn);
    }
}


/**
 * @brief Global IndexPage instance.
 *
 * @details Exposed globally so the inline onclick handlers injected by
 * renderCategories() and renderTags() can reach the IndexPage instance.
 *
 * @type {IndexPage|null}
 */
let indexPage = null;

/**
 * @brief Bootstraps the index page after the DOM is ready.
 *
 * @details Fetches data.json, sorts posts newest-first, then constructs
 * an IndexPage to populate the sidebar widgets and pagination controls.
 *
 * @returns {Promise<void>}
 */
document.addEventListener('DOMContentLoaded', async function () {
    try {
        const response = await fetch('/blog/data.json');
        const data = await response.json();

        // Sort all posts by date descending once, upfront
        data.posts.sort((a, b) => new Date(b.date) - new Date(a.date));

        indexPage = new IndexPage(data.posts);
    } catch (error) {
        console.error('index.js: failed to load data.json:', error);
    }
});

/**
 * @brief Global shim — forwards category filter clicks to the IndexPage instance.
 *
 * @details Required because the links rendered by renderCategories() use
 * inline onclick handlers which call into global scope.
 *
 * @param {string} category - Category name to filter by.
 * @returns {void}
 */
function filterByCategory(category) {
    indexPage?.filterByCategory(category);
}

/**
 * @brief Global shim — forwards tag filter clicks to the IndexPage instance.
 *
 * @details Same pattern as filterByCategory(). Inline onclick handlers in
 * the tag cloud require a global entry point.
 *
 * @param {string} tag - Tag to filter by.
 * @returns {void}
 */
function filterByTag(tag) {
    indexPage?.filterByTag(tag);
}