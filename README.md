# Kevin Ray Scott Portfolio

Static personal portfolio website for Kevin Ray Scott (雷凯文 / LEI KAIWEN), built with [Zola](https://www.getzola.org/) and the [Kodama theme](https://github.com/adfaure/kodama-theme).

The site is designed as a clean academic and professional portfolio for internship, job, and future PhD or research applications. It includes a homepage, project experience page, about page, blog/notes section, and contact page.

Blog bookmark and share controls are lightweight frontend interactions. Blog likes use a Cloudflare Pages Function at `/api/likes` with a D1 database binding, so public like counts can update across browsers and devices after deployment. The visitor's browser still uses `localStorage` only to avoid repeated likes from the same browser.

## Local Setup on macOS

Install the required tools:

```sh
brew install zola git
```

Open the project root:

```sh
cd /Users/kevin/PycharmProjects/TensorCat/ray-kevin-portfolio
```

## Required Tools

- Zola
- Git

Check that they are available:

```sh
zola --version
git --version
```

## Run Locally

```sh
zola serve
```

Zola will print a local URL, usually `http://127.0.0.1:1111/`.

## Check and Build

```sh
zola check
zola build
```

The production static site is generated in:

```text
public
```

## Cloudflare Pages Deployment

Use these settings for Cloudflare Pages:

```text
Build command: zola build
Build output directory: public
```

Deployment steps:

1. Push this project to GitHub.
2. Open the Cloudflare Dashboard.
3. Go to **Workers & Pages**.
4. Select **Create application**.
5. Select **Pages**.
6. Select **Connect to Git**.
7. Select the GitHub repository.
8. Set build command to `zola build`.
9. Set build output directory to `public`.
10. Add environment variable if Cloudflare requires it:

```text
ZOLA_VERSION = 0.22.1
```

11. Deploy.
12. After deployment, copy the generated `*.pages.dev` URL.
13. If the URL is not `https://kevinrayscott.pages.dev/`, update `base_url` in `config.toml` and push again.

After Cloudflare Pages creates the real URL, update `base_url` in `config.toml` if the final URL is different.

## Cloudflare D1 Blog Likes

The blog like counter is backed by a small Cloudflare Pages Function:

```text
functions/api/likes.js
```

The function expects one D1 binding. Use this binding name:

```text
DB
```

Recommended setup in Cloudflare Dashboard:

1. Open **Cloudflare Dashboard**.
2. Go to **Workers & Pages**.
3. Open the Pages project for this portfolio.
4. Create a D1 database, for example `ray-kevin-portfolio-likes`.
5. Open the Pages project's settings.
6. Add a D1 database binding.
7. Set the binding variable name to `DB`.
8. Select the D1 database you created.
9. Save and redeploy the Pages project.

The function automatically creates the `blog_likes` table if it does not exist. The initial counts are seeded from the current blog note defaults the first time each post is requested.

Behavior:

- `GET /api/likes?posts=post-a,post-b` returns public counts.
- `POST /api/likes` with `{ "postId": "post-a", "action": "like" }` increments that post count.
- `POST /api/likes` with `{ "postId": "post-a", "action": "unlike" }` decrements that post count without going below zero.
- Open blog pages refresh cloud counts on load, when the tab becomes visible again, and about every 30 seconds while visible.
- If D1 is not bound yet, the page gracefully falls back to the static Markdown count and local browser state.

## Base URL Reminder

The current temporary Cloudflare Pages base URL is:

```text
https://kevinrayscott.pages.dev/
```

If the final Cloudflare Pages URL or a custom domain changes, update `base_url` in `config.toml` before building or deploying.

## GitHub Preparation

If this project is not already committed to GitHub, run:

```bash
cd /Users/kevin/PycharmProjects/TensorCat/ray-kevin-portfolio
git init
git add .
git commit -m "Build Kevin Ray Scott portfolio website"
git branch -M main
git remote add origin https://github.com/KevinRayScottUM/ray-kevin-portfolio.git
git push -u origin main
```

If Git is already initialized, skip `git init`. If a remote already exists, check it with:

```bash
git remote -v
```

Then commit and push with:

```bash
git add .
git commit -m "Update Kevin Ray Scott portfolio for Cloudflare Pages"
git push
```
