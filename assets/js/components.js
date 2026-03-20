/**
 * @file components.js
 * @brief Loads and injects reusable HTML components to eliminate duplication.
 * 
 * @details This script handles loading HTML fragments (footer, header, etc.)
 * and injecting them into pages, reducing code duplication across the site.
 * Simply include this script in your HTML and add the corresponding
 * placeholder element with id="component-footer", id="component-header", etc.
 * 
 * Usage:
 *   <div id="component-footer"></div> <!-- Will auto-load from assets/footer.html -->
 *   <script src="assets/js/components.js"></script>
 */

/**
 * @brief Loads a component HTML file and injects it into the DOM.
 * 
 * @param {string} componentName - Component name (e.g., 'footer', 'header')
 * @param {string} targetSelector - CSS selector for target element to inject into
 * @param {string} basePath - Base path prefix for fetching component files (default: '/assets/')
 * 
 * @returns {Promise<void>}
 */
async function loadComponent(componentName, targetSelector, basePath = '/assets/') {
    try {
        const response = await fetch(`${basePath}${componentName}.html`);
        if (!response.ok) {
            console.warn(`Component not found: ${componentName} at ${basePath}${componentName}.html`);
            return;
        }
        const html = await response.text();
        const target = document.querySelector(targetSelector);
        if (target) {
            target.innerHTML = html;
        } else {
            console.warn(`Target selector not found: ${targetSelector}`);
        }
    } catch (error) {
        console.error(`Error loading component ${componentName}:`, error);
    }
}

/**
 * @brief Auto-loads all components when DOM is ready.
 * 
 * @details Looks for elements with id="component-{name}" where {name}.html exists.
 * Supported components: footer, header, etc.
 * 
 * Usage:
 *   Add <div id="component-footer"></div> to your HTML
 *   Script will auto-load from /assets/footer.html
 */
document.addEventListener('DOMContentLoaded', async function () {
    const components = ['footer', 'header'];

    for (const component of components) {
        const selector = `#component-${component}`;
        if (document.querySelector(selector)) {
            const basePath = document.currentScript?.dataset.basePath || '/assets/';
            await loadComponent(component, selector, basePath);
        }
    }
});
