"""
generate-sites.py
=================
Static site generator for the /blog section.

Reads data.json and generates one .html file per post plus a rendered
index.html. All page templates are defined in this script — no external
template files needed.

Post content is fetched and rendered client-side by marked.js. Everything
else (title, meta tags, OG tags, canonical URL, tags, author, date) is
pre-baked into the HTML at generation time.

Usage
-----
    python generate-sites.py              # generate all
    python generate-sites.py --clean      # delete generated files, then generate
    python generate-sites.py --list       # list posts from data.json and exit
    python generate-sites.py --post riscv-env-setup   # regenerate one post by slug
"""

import argparse
import json
import re
import sys
from datetime import datetime
from pathlib import Path


BASE_DIR      = Path(__file__).parent
DATA_FILE     = BASE_DIR / "data.json"
POSTS_DIR     = BASE_DIR / "posts"
SITE_BASE_URL = "https://syedtaha.dev"

COMMON_HEAD = """\
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, user-scalable=no" />
    <meta name="author" content="Syed Taha">

    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link rel="preconnect" href="https://cdn.jsdelivr.net">

    <link href="https://fonts.googleapis.com/css2?family=Oswald:wght@700&family=Open+Sans:wght@400;700&display=swap"
        rel="stylesheet">
    <link rel="stylesheet" href="../assets/css/main.css" />
    <link rel="stylesheet" href="../assets/css/notes.css" />

    <link rel="icon" type="image/png" sizes="16x16" href="/favicons/favicon-16x16.webp">
    <link rel="icon" type="image/png" sizes="32x32" href="/favicons/favicon-32x32.webp">
    <link rel="icon" type="image/png" sizes="48x48" href="/favicons/favicon-48x48.webp">
    <link rel="icon" type="image/png" sizes="64x64" href="/favicons/favicon-64x64.webp">
    <link rel="icon" type="image/png" sizes="192x192" href="/favicons/android-chrome-192x192.webp">
    <link rel="apple-touch-icon" sizes="180x180" href="/favicons/apple-touch-icon.webp">

    <script async src="https://www.googletagmanager.com/gtag/js?id=G-V2HDCTFNV6"></script>
    <script>
        window.dataLayer = window.dataLayer || [];
        function gtag() {{ dataLayer.push(arguments); }}
        gtag('js', new Date());
        gtag('config', 'G-V2HDCTFNV6');
    </script>"""

COMMON_SCRIPTS = """\
    <script defer src="../assets/js/jquery.min.js"></script>
    <script defer src="../assets/js/jquery.scrolly.min.js"></script>
    <script defer src="../assets/js/jquery.dropotron.min.js"></script>
    <script defer src="../assets/js/jquery.scrollex.min.js"></script>
    <script defer src="../assets/js/browser.min.js"></script>
    <script defer src="../assets/js/breakpoints.min.js"></script>
    <script defer src="../assets/js/util.js"></script>
    <script defer src="../assets/js/main.js"></script>
    <script defer src="/assets/js/components.js"></script>"""


def _h(value: str) -> str:
    """Escape a string for safe injection into HTML text content."""
    return value.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def _ha(value: str) -> str:
    """Escape a string for safe injection into an HTML attribute value."""
    return value.replace("&", "&amp;").replace('"', "&quot;").replace("<", "&lt;")


class Post:
    """
    Represents a single post loaded from data.json.

    Parameters
    ----------
    data : dict
        A single post object from the ``posts`` array in data.json.

    Attributes
    ----------
    id : int
    title : str
    date : str
        Raw date string in ``YYYY-MM-DD`` format.
    category : str
    tags : list of str
    excerpt : str
    filename : str
        Markdown filename, e.g. ``1-riscv-env-setup.md``.
    author : str
    read_time : int
        Estimated reading time in minutes.
    featured_image : str or None
        Relative path from the blog root, e.g. ``images/post-1/cover.webp``.
    slug : str
        URL slug derived from the filename, e.g. ``riscv-env-setup``.
    """

    def __init__(self, data: dict):
        self.id             = data["id"]
        self.title          = data["title"]
        self.date           = data["date"]
        self.category       = data["category"]
        self.tags           = data["tags"]
        self.excerpt        = data["excerpt"]
        self.filename       = data["filename"]
        self.author         = data["author"]
        self.read_time      = data["readTime"]
        self.featured_image = data.get("featured_image")  # optional field

        # Derive slug by stripping leading "N-" prefix and .md extension
        stem       = Path(self.filename).stem
        self.slug  = re.sub(r"^\d+-", "", stem)

    @property
    def url(self) -> str:
        """Absolute URL to the generated static page."""
        return f"{SITE_BASE_URL}/blog/{self.slug}.html"

    @property
    def formatted_date(self) -> str:
        """Human-readable date string, e.g. ``March 29, 2026``."""
        try:
            dt = datetime.strptime(self.date, "%Y-%m-%d")
            day = dt.day  # Raw integer, no zero-padding
            month = dt.strftime("%B")
            year = dt.year
            return f"{month} {day}, {year}"
        except ValueError:
            return self.date

    @property
    def og_image(self) -> str:
        """Open Graph image URL — featured image if set, else the placeholder."""
        if self.featured_image:
            return f"{SITE_BASE_URL}/blog/{self.featured_image}"
        return f"{SITE_BASE_URL}/images/note-preview-ph.webp"

    @property
    def keywords(self) -> str:
        """Comma-separated tag list for the meta keywords tag."""
        return ", ".join(self.tags)

    @property
    def tags_html(self) -> str:
        """Rendered ``<span class="tag">`` chips for all tags."""
        return "".join(f'<span class="tag">{_h(t)}</span>' for t in self.tags)

    @property
    def featured_image_html(self) -> str:
        """Featured image block, or empty string if no image is set."""
        if not self.featured_image:
            return ""
        return (
            f'<a href="#" class="image fit">'
            f'<img src="/blog/{_ha(self.featured_image)}" alt="{_ha(self.title)}" />'
            f'</a>'
        )

    def card_html(self) -> str:
        """
        Build the post card HTML for the index page.

        Returns
        -------
        str
            An ``<article>`` HTML string ready for injection into
            ``#posts-container``.
        """
        post_url = f"/blog/{self.slug}.html"

        img_block = ""
        if self.featured_image:
            img_block = (
                f'<a href="{post_url}" class="image fit" style="display:block;margin-bottom:1rem;">'
                f'<img src="/blog/{_ha(self.featured_image)}" alt="{_ha(self.title)}" '
                f'style="width:100%;height:auto;border-radius:5px;"></a>'
            )

        return f"""
            <article style="margin-bottom:2rem;padding:0 1rem 2rem 1rem;border-bottom:1px solid #ddd;">
                {img_block}
                <h3>
                    <a href="{post_url}" style="color:inherit;text-decoration:none;">
                        {_h(self.title)}
                    </a>
                </h3>
                <div style="font-size:0.9rem;color:#666;margin-bottom:0.5rem;
                            display:flex;flex-wrap:wrap;gap:0;align-items:center;">
                    <span>{self.formatted_date}</span>
                    <span style="margin:0 0.5rem;">|</span>
                    <span><strong>{_h(self.category)}</strong></span>
                    <span style="margin:0 0.5rem;">|</span>
                    <span>{self.read_time} min read</span>
                </div>
                <p>{_h(self.excerpt)}</p>
                <a href="{post_url}" class="button small">Read More</a>
            </article>"""


class Generator:
    """
    Builds static HTML files for the blog section.

    Parameters
    ----------
    posts : list of Post
        All posts to generate, pre-loaded from data.json.

    Examples
    --------
    Load posts and run a full build::

        posts = SiteData(DATA_FILE).posts
        Generator(posts).build_all()

    Regenerate a single post by slug::

        Generator(posts).build_post(slug="riscv-env-setup")
    """

    def __init__(self, posts: list):
        self.posts = posts

    def _write(self, path: Path, content: str) -> None:
        """
        Write content to a file and print a confirmation.

        Parameters
        ----------
        path : Path
            Destination file path.
        content : str
            HTML content to write.
        """
        path.write_text(content, encoding="utf-8")
        print(f"  wrote: {path.relative_to(BASE_DIR.parent)}")

    def build_all(self) -> None:
        """Generate all post pages and the index page."""
        print(f"Generating {len(self.posts)} post page(s)...\n")
        for post in self.posts:
            self._write(BASE_DIR / f"{post.slug}.html", self._post_html(post))

        print()
        self._write(BASE_DIR / "index.html", self._index_html())
        print(f"\nDone. {len(self.posts)} post(s) + index generated.")

    def build_post(self, slug: str) -> None:
        """
        Regenerate a single post by slug.

        Parameters
        ----------
        slug : str
            The post's URL slug, e.g. ``riscv-env-setup``.

        Raises
        ------
        SystemExit
            If no post with the given slug is found.
        """
        match = next((p for p in self.posts if p.slug == slug), None)
        if not match:
            available = ", ".join(p.slug for p in self.posts)
            sys.exit(f"ERROR: no post with slug '{slug}'. Available: {available}")

        self._write(BASE_DIR / f"{match.slug}.html", self._post_html(match))

    def clean(self) -> None:
        """
        Delete all previously generated .html files from the blog root.

        Only removes files that correspond to a known post slug or
        ``index.html`` — does not touch any other files.
        """
        targets = [BASE_DIR / "index.html"] + [
            BASE_DIR / f"{p.slug}.html" for p in self.posts
        ]
        removed = 0
        for path in targets:
            if path.exists():
                path.unlink()
                print(f"  deleted: {path.name}")
                removed += 1

        if removed == 0:
            print("Nothing to clean.")

    def _post_html(self, post: Post) -> str:
        """
        Build the complete HTML for a single post page.

        All metadata is pre-baked. The markdown body is fetched and
        rendered client-side by ``post.js`` + ``marked.js``.

        Parameters
        ----------
        post : Post
            The post to render.

        Returns
        -------
        str
            Complete HTML document as a string.
        """
        return f"""<!DOCTYPE HTML>
<html lang="en">

<head>
{COMMON_HEAD}

    <title>{_h(post.title)}</title>
    <meta name="description" content="{_ha(post.excerpt)}">
    <meta name="keywords" content="{_ha(post.keywords)}">
    <link rel="canonical" href="{post.url}">

    <meta property="og:type"        content="article" />
    <meta property="og:title"       content="{_ha(post.title)}" />
    <meta property="og:description" content="{_ha(post.excerpt)}" />
    <meta property="og:image"       content="{_ha(post.og_image)}" />
    <meta property="og:url"         content="{_ha(post.url)}" />
</head>

<body class="is-preload">
    <div id="page-wrapper">

        <header id="header">
            <h1 id="logo"><a href="/">Syed Taha</a></h1>
            <nav id="nav">
                <ul>
                    <li><a href="/">Home</a></li>
                    <li><a href="/projects.html">Projects</a></li>
                    <li><a href="/outside.html">Outside</a></li>
                    <li><a href="/blog/" class="button primary">My Blog</a></li>
                </ul>
            </nav>
        </header>

        <div id="main" class="wrapper style1">
            <div class="container">

                <header class="major">
                    <h2>{_h(post.title)}</h2>
                    <p>{_h(post.excerpt)}</p>
                    <div class="post-meta">
                        <span><span>{_h(post.author)}</span></span>
                        <span><span>{post.formatted_date}</span></span>
                        <span><span>{_h(post.category)}</span></span>
                        <span><span>{post.read_time}</span> mins</span>
                    </div>
                    <div class="post-tags">{post.tags_html}</div>
                </header>

                <div class="row gtr-150">
                    <div class="col-8 col-12-medium">
                        <div id="featured-image-container">{post.featured_image_html}</div>
                        <section id="content">
                            <article class="post-content" id="post-content"></article>
                        </section>
                    </div>

                    <div class="col-4 col-12-medium">
                        <section id="toc-sidebar">
                            <div id="toc-title">Table of Contents</div>
                            <div id="toc-content"></div>
                        </section>
                    </div>
                </div>
            </div>
        </div>

        <div id="component-footer"></div>

    </div>

{COMMON_SCRIPTS}

    <script defer src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
    <script defer src="js/post.js" data-filename="{post.filename}"></script>

</body>

</html>
"""

    def _index_html(self) -> str:
        """
        Build the complete index.html.

        Post cards are pre-rendered into the HTML. The sidebar widgets
        (featured, categories, tags) and pagination are populated at runtime
        by ``index.js``, which fetches ``data.json``.

        Returns
        -------
        str
            Complete HTML document as a string.
        """
        # Sort newest-first before rendering cards
        sorted_posts = sorted(self.posts, key=lambda p: p.date, reverse=True)
        cards = "".join(p.card_html() for p in sorted_posts)

        return f"""<!DOCTYPE HTML>
<html lang="en">

<head>
{COMMON_HEAD}

    <title>Blog - Syed Taha</title>
    <meta name="description" content="Hello! I'm Syed Taha — this is where I write about things I build, figure out, or find interesting. Mostly systems programming, machine learning, and low-level computing.">
    <meta name="keywords" content="Syed Taha, systems programming, RISC-V, machine learning, low-level computing, high-performance computing, technical writing, blog">
    <link rel="canonical" href="{SITE_BASE_URL}/blog/">
</head>

<body class="is-preload">
    <div id="page-wrapper">

        <header id="header">
            <h1 id="logo" style="display:flex; gap:1.5rem; align-items:center; padding-left:0.5rem;">
                <a href="https://github.com/syedtaha22" class="icon brands fa-github" title="GitHub"><span class="label">GitHub</span></a>
                <a href="https://www.linkedin.com/in/syetaha/" class="icon brands fa-linkedin-in" title="LinkedIn"><span class="label">LinkedIn</span></a>
                <a href="/syedtaha.pdf" class="icon solid fa-file-pdf" title="Resume"><span class="label">Resume</span></a>
            </h1>
            <nav id="nav">
                <ul>
                    <li><a href="/">Home</a></li>
                    <li><a href="/projects.html">Projects</a></li>
                    <li><a href="/outside.html">Outside</a></li>
                </ul>
            </nav>
        </header>

        <div id="main" class="wrapper style1">
            <div class="container">
                <header class="major">
                    <h2>My Blog</h2>
                    <p>Things I've built, learned, or figured out along the way.</p>
                </header>

                <div class="row gtr-150">
                    <!-- Sidebar — populated at runtime by index.js -->
                    <div class="col-4 col-12-medium">
                        <section id="sidebar">
                            <section>
                                <h3>Featured</h3>
                                <div id="featured-posts"></div>
                            </section>
                            <hr />
                            <section>
                                <h3>Categories</h3>
                                <ul id="categories-list" style="list-style: none; padding: 0;"></ul>
                            </section>
                            <hr />
                            <section>
                                <h3>Tags</h3>
                                <div id="tags-cloud"></div>
                            </section>
                        </section>
                    </div>

                    <!-- Post list — cards pre-rendered by this script -->
                    <div class="col-8 col-12-medium imp-medium">
                        <section id="content">
                            <div id="posts-container">
{cards}
                            </div>

                            <!-- Pagination wired up by index.js -->
                            <div id="pagination" style="display:flex;justify-content:center;align-items:center;gap:15px;margin-top:30px;">
                                <button id="prev-btn" class="button" style="cursor:pointer;" disabled>&larr; Previous</button>
                                <span id="page-info" style="font-weight:bold;"></span>
                                <button id="next-btn" class="button" style="cursor:pointer;">Next &rarr;</button>
                            </div>
                        </section>
                    </div>
                </div>
            </div>
        </div>

        <div id="component-footer"></div>

    </div>

{COMMON_SCRIPTS}

    <script defer src="js/index.js"></script>

</body>

</html>
"""


class SiteData:
    """
    Loads and validates ``data.json``.

    Parameters
    ----------
    path : Path
        Path to ``data.json``.

    Attributes
    ----------
    posts : list of Post
        All posts parsed from the file.

    Raises
    ------
    SystemExit
        If the file is missing or contains invalid JSON.
    """

    def __init__(self, path: Path):
        if not path.exists():
            sys.exit(f"ERROR: data.json not found at {path}")

        try:
            with path.open(encoding="utf-8") as f:
                raw = json.load(f)
        except json.JSONDecodeError as e:
            sys.exit(f"ERROR: data.json is not valid JSON: {e}")

        self.posts = [Post(p) for p in raw["posts"]]


def build_cli() -> argparse.ArgumentParser:
    """
    Build the command-line argument parser.

    Returns
    -------
    argparse.ArgumentParser
        Configured parser with all supported flags and arguments.
    """
    parser = argparse.ArgumentParser(
        description="Static site generator for the /blog section.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=(
            "Examples:\n"
            "  python generate-sites.py                        # generate all\n"
            "  python generate-sites.py --clean                # delete generated files\n"
                        "  python generate-sites.py --list                 # list posts and exit\n"
            "  python generate-sites.py --post riscv-env-setup # one post only\n"
        ),
    )
    parser.add_argument(
        "--clean",
        action="store_true",
        help="Delete previously generated files and exit.",
    )
    parser.add_argument(
        "--list",
        action="store_true",
        help="Print all posts from data.json and exit without generating.",
    )
    parser.add_argument(
        "--post",
        metavar="SLUG",
        help="Regenerate only the post with this slug (e.g. riscv-env-setup).",
    )
    return parser


def main() -> None:
    args = build_cli().parse_args()
    data = SiteData(DATA_FILE)
    gen  = Generator(data.posts)

    if args.list:
        # Print a table of all posts and exit
        print(f"{'ID':<4} {'Slug':<40} {'Date':<14} Title")
        print("-" * 90)
        for p in sorted(data.posts, key=lambda p: p.date, reverse=True):
            print(f"{p.id:<4} {p.slug:<40} {p.date:<14} {p.title}")
        return

    if args.clean:
        print("Cleaning previously generated files...")
        gen.clean()
        return

    if args.post:
        gen.build_post(slug=args.post)
    else:
        gen.build_all()


if __name__ == "__main__":
    main()